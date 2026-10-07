"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import {
  cancelSubscription as cancelRazorpaySubscription,
  createSubscription,
  verifyCheckoutSignature,
} from "@/lib/billing/razorpay";
import { serverEnv } from "@/lib/env";
import { rateLimited } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, type ActionResult } from "@/actions/types";

const TOTAL_BILLING_CYCLES = 120; // 10 years of monthly cycles — Razorpay requires a finite count.

/**
 * Starts the caller's one 15-day no-card trial. Delegates the eligibility
 * check to `start_trial()` (migration 0022) — a single atomic DB update, so
 * there's no way to call this twice and extend/reset a trial already used.
 * A null return means the account already has a trial on record (active or
 * lapsed) or is already on a real paid subscription.
 */
export async function startTrial(): Promise<
  ActionResult<{ trialEndsAt: string }>
> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("start_trial");
  if (error) {
    return actionError("Couldn't start your trial — try again in a moment.");
  }
  if (!data) {
    return actionError("You've already used your trial, or you're on Pro.");
  }

  revalidatePath("/account");
  revalidatePath("/billing");
  return { ok: true, data: { trialEndsAt: data } };
}

/**
 * Creates a Razorpay Subscription for the caller and returns what
 * Checkout.js needs to open its payment modal. This does NOT grant Pro —
 * `subscription_id`/`customer_id` are saved immediately (via the service-role
 * client, since end users have no write policy on `profiles`) so the webhook
 * can find this user later, but `subscription_tier` only ever changes inside
 * the webhook handler, which is the sole source of truth for paid access.
 */
export async function startCheckout(): Promise<
  ActionResult<{ subscriptionId: string; keyId: string }>
> {
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
    .select("subscription_tier, current_period_end")
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

  let subscription;
  try {
    subscription = await createSubscription(
      serverEnv.razorpayKeyId,
      serverEnv.razorpayKeySecret,
      {
        planId: serverEnv.razorpayPlanId,
        totalCount: TOTAL_BILLING_CYCLES,
        notes: { user_id: user.id },
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
 * callback genuinely came from Razorpay for THIS subscription — it is
 * deliberately NOT used to grant Pro access by itself (a client-side
 * callback can be skipped, replayed, or the tab closed before it fires);
 * the webhook remains the sole writer of `subscription_tier`. On success the
 * UI shows "activating…" and waits for the webhook to land.
 */
export async function verifyCheckoutCallback(params: {
  paymentId: unknown;
  subscriptionId: unknown;
  signature: unknown;
}): Promise<ActionResult<{ verified: true }>> {
  const { supabase } = await requireUser();

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_id")
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

  if (profile?.subscription_tier !== "pro" || !profile.subscription_id) {
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
      true,
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
