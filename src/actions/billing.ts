"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import {
  cancelSubscription as cancelRazorpaySubscription,
  createSubscription,
  fetchSubscription,
  verifyCheckoutSignature,
} from "@/lib/billing/razorpay";
import { shouldGrantProOnVerifiedCheckout } from "@/lib/billing/tier";
import { serverEnv } from "@/lib/env";
import { rateLimited } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, type ActionResult } from "@/actions/types";

const TOTAL_BILLING_CYCLES = 120; // 10 years of monthly cycles — Razorpay requires a finite count.

const TRIAL_DAYS = 15;

/**
 * Creates a Razorpay Subscription for the caller and returns what
 * Checkout.js needs to open its payment modal. This does NOT grant Pro —
 * `subscription_id`/`customer_id` are saved immediately (via the service-role
 * client, since end users have no write policy on `profiles`) so the webhook
 * can find this user later, but `subscription_tier` only ever changes inside
 * the webhook handler, which is the sole source of truth for paid access.
 */
export async function startCheckout(
  kind: "pro" | "trial" = "pro",
): Promise<ActionResult<{ subscriptionId: string; keyId: string }>> {
  const { user, supabase } = await requireUser();

  // Basic abuse guard: a double-click or a retry loop shouldn't be able to
  // spin up a pile of Razorpay subscriptions for one account.
  if (rateLimited(`checkout:${user.id}`, 3, 60_000)) {
    return actionError("Too many attempts — wait a minute and try again.");
  }

  if (serverEnv.billingProvider !== "razorpay") {
    return actionError(
      "Paid plans aren’t available yet — you’re on the free plan with no limits.",
    );
  }
  if (!serverEnv.razorpayKeyId || !serverEnv.razorpayKeySecret) {
    return actionError("Billing is configured but missing Razorpay keys.");
  }
  if (!serverEnv.razorpayPlanId) {
    return actionError(
      "Billing is configured but missing the Pro plan — run scripts/create-razorpay-plan.ts.",
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "subscription_tier, current_period_end, trial_ends_at, subscription_id",
    )
    .maybeSingle();
  const rawTier = profile?.subscription_tier ?? "free";
  const inGracePeriod =
    rawTier === "canceled" &&
    !!profile?.current_period_end &&
    new Date(profile.current_period_end).getTime() > Date.now();
  // Blocks whenever a LIVE Razorpay subscription object already exists for
  // this account — 'pro' (actively billing), 'past_due' (Razorpay is
  // already auto-retrying a failed charge on it), or a 'canceled' one still
  // inside its paid grace period. Letting any of these start a second
  // subscription risks two live subscriptions billing the same person.
  if (rawTier === "pro" || rawTier === "past_due" || inGracePeriod) {
    return actionError(
      rawTier === "past_due"
        ? "Your last payment didn't go through — Razorpay is retrying it automatically. Contact support if this continues."
        : "You already have an active Pro subscription.",
    );
  }

  // A trial that already has an autopay mandate will start charging on its
  // own at the end of the trial. A second subscription on top of it would
  // bill the same person twice, so point them at the existing one instead.
  if (
    rawTier === "trialing" &&
    profile?.subscription_id &&
    profile.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() > Date.now()
  ) {
    return actionError(
      "Your free trial is already set to start billing automatically when it ends.",
    );
  }

  // One trial per account, ever — used or lapsed counts.
  if (kind === "trial" && profile?.trial_ends_at) {
    return actionError("You've already used your free trial.");
  }
  const startAt =
    kind === "trial"
      ? Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60
      : undefined;

  let subscription;
  try {
    subscription = await createSubscription(
      serverEnv.razorpayKeyId,
      serverEnv.razorpayKeySecret,
      {
        planId: serverEnv.razorpayPlanId,
        totalCount: TOTAL_BILLING_CYCLES,
        startAt,
        notes: { user_id: user.id, kind },
      },
    );
  } catch (err) {
    return actionError(
      err instanceof Error ? err.message : "Couldn't start checkout.",
    );
  }

  const admin = createAdminClient();
  const { error: writeError } = await admin
    .from("profiles")
    .update({
      billing_provider: "razorpay",
      subscription_id: subscription.id,
      customer_id: subscription.customer_id,
    })
    .eq("user_id", user.id);
  if (writeError) {
    return actionError(
      "Checkout was created but couldn't be saved — please try again.",
    );
  }

  return {
    ok: true,
    data: { subscriptionId: subscription.id, keyId: serverEnv.razorpayKeyId },
  };
}

/**
 * Verifies the signature Checkout.js hands back on success. This proves the
 * callback genuinely came from Razorpay for THIS subscription — an HMAC
 * keyed on our own key secret, not something a client could forge — so once
 * it checks out we grant Pro immediately rather than leaving the account
 * stuck on "activating…" if the webhook is slow or never arrives (as
 * happened in testing: Razorpay's servers couldn't reach a dev tunnel that
 * wasn't configured yet). The grant is a single atomic, conditional UPDATE
 * (`.neq("subscription_tier", "pro")`) scoped to the caller's own row, so
 * calling this twice — or racing with the webhook, whichever lands first —
 * never does more than one write and never un-grants or overwrites anything.
 * The webhook remains the sole source of truth for everything AFTER initial
 * activation (renewal, cancellation, payment failure); this function never
 * touches `current_period_end` or any other field the webhook owns.
 */
export async function verifyCheckoutCallback(params: {
  paymentId: unknown;
  subscriptionId: unknown;
  signature: unknown;
}): Promise<ActionResult<{ verified: true }>> {
  const { user, supabase } = await requireUser();

  const { paymentId, subscriptionId, signature } = params;
  if (
    typeof paymentId !== "string" ||
    !paymentId ||
    typeof subscriptionId !== "string" ||
    !subscriptionId ||
    typeof signature !== "string" ||
    !signature
  ) {
    return actionError("Malformed checkout response.");
  }

  if (!serverEnv.razorpayKeySecret) {
    return actionError("Billing isn't configured.");
  }

  // Only valid for the subscription we ourselves just created for this
  // account — relies on RLS (profiles_select_own) to scope the lookup.
  // Also grabs the current tier so we know below whether a grant is even
  // needed, without a second round-trip.
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_id, subscription_tier")
    .maybeSingle();
  if (!profile?.subscription_id || profile.subscription_id !== subscriptionId) {
    return actionError("This checkout doesn't match your account.");
  }

  const valid = verifyCheckoutSignature(
    paymentId,
    subscriptionId,
    signature,
    serverEnv.razorpayKeySecret,
  );
  if (!valid) {
    return actionError(
      "Couldn't verify that payment — contact support if you were charged.",
    );
  }

  // Best-effort: if this write fails, the webhook still grants Pro on its
  // own once it lands, so a failure here isn't reported as an error — the
  // signature genuinely did verify, which is this function's actual promise.
  // The `.neq()` filter is the actual race-safety net (in case the webhook
  // lands between the read above and this write); shouldGrantProOnVerifiedCheckout
  // is just what decides whether to bother attempting the write at all.
  // Was this checkout for a trial (first charge in the future)? Ask Razorpay
  // rather than trusting the browser. If we can't tell, grant nothing here:
  // the webhook is the fallback for both trials and paid plans.
  let startAt: number | null = null;
  let isTrial = false;
  try {
    if (!serverEnv.razorpayKeyId) throw new Error("no key");
    const sub = await fetchSubscription(
      serverEnv.razorpayKeyId,
      serverEnv.razorpayKeySecret,
      subscriptionId,
    );
    isTrial = sub.notes?.kind === "trial";
    startAt = typeof sub.start_at === "number" ? sub.start_at : null;
  } catch {
    return { ok: true, data: { verified: true } };
  }

  if (isTrial) {
    if (startAt && startAt * 1000 > Date.now()) {
      const admin = createAdminClient();
      await admin
        .from("profiles")
        .update({
          subscription_tier: "trialing",
          trial_ends_at: new Date(startAt * 1000).toISOString(),
        })
        .eq("user_id", user.id)
        .is("trial_ends_at", null);
    }
    return { ok: true, data: { verified: true } };
  }

  if (shouldGrantProOnVerifiedCheckout(profile.subscription_tier)) {
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ subscription_tier: "pro" })
      .eq("user_id", user.id)
      .neq("subscription_tier", "pro");
  }

  return { ok: true, data: { verified: true } };
}

/**
 * Cancels at the end of the current paid cycle — access continues through
 * `current_period_end`, same grace period `effectiveTier()` already grants
 * any 'canceled' row. Updates `subscription_tier` immediately on a
 * successful Razorpay response (safe to apply eagerly: it only ever REDUCES
 * what the account is entitled to, unlike granting Pro, which stays
 * webhook-only) — the webhook's own `subscription.cancelled` handler will
 * also fire and is a no-op if this already ran.
 */
export async function cancelSubscription(): Promise<ActionResult<null>> {
  const { user, supabase } = await requireUser();

  if (rateLimited(`cancel:${user.id}`, 3, 60_000)) {
    return actionError("Too many attempts — wait a minute and try again.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_id")
    .maybeSingle();

  const tier = profile?.subscription_tier;
  const onTrial = tier === "trialing";
  if ((tier !== "pro" && !onTrial) || !profile?.subscription_id) {
    return actionError("No active subscription to cancel.");
  }
  if (!serverEnv.razorpayKeyId || !serverEnv.razorpayKeySecret) {
    return actionError("Billing isn't configured.");
  }

  try {
    await cancelRazorpaySubscription(
      serverEnv.razorpayKeyId,
      serverEnv.razorpayKeySecret,
      profile.subscription_id,
      // A trial has not been charged yet, so there is no paid period to run
      // out: cancel the mandate now. Access continues to the trial end date.
      !onTrial,
    );
  } catch (err) {
    return actionError(
      err instanceof Error ? err.message : "Couldn't cancel — try again.",
    );
  }

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ subscription_tier: "canceled" })
    .eq("user_id", user.id);

  revalidatePath("/account");
  revalidatePath("/billing");
  return { ok: true, data: null };
}
