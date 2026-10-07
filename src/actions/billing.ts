"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { actionError, type ActionResult } from "@/actions/types";

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
 * Groundwork only — payments are not live. When a provider + keys are
 * configured this creates a Stripe Checkout Session / Razorpay order and
 * returns its URL; until then it reports that billing is disabled.
 *
 * TODO (when keys arrive):
 *  - stripe: `new Stripe(serverEnv.stripeSecretKey).checkout.sessions.create({
 *      mode: "subscription", line_items: [{ price: serverEnv.stripePricePro, quantity: 1 }],
 *      customer_email, success_url, cancel_url, subscription_data: { trial_period_days } })`
 *  - razorpay: create a subscription against a plan id, return short_url
 *  - persist customer_id on first checkout
 */
export async function startCheckout(): Promise<
  ActionResult<{ url: string }>
> {
  await requireUser();

  const provider = serverEnv.billingProvider;
  if (!provider) {
    return actionError(
      "Paid plans aren’t available yet — you’re on the free plan with no limits.",
    );
  }
  if (
    provider === "stripe" &&
    (!serverEnv.stripeSecretKey || !serverEnv.stripePricePro)
  ) {
    return actionError("Billing is configured but missing Stripe keys.");
  }
  if (
    provider === "razorpay" &&
    (!serverEnv.razorpayKeyId || !serverEnv.razorpayKeySecret)
  ) {
    return actionError("Billing is configured but missing Razorpay keys.");
  }

  // Real provider call goes here once keys + pricing are confirmed.
  return actionError("Checkout is not wired up yet.");
}
