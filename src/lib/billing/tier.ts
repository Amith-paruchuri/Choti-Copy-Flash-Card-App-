import type { SubscriptionTier } from "@/types/database";

export interface TierState {
  subscriptionTier: SubscriptionTier;
  trialEndsAt: string | null;
  /** End of the current paid period — what a 'canceled' subscription still runs out. */
  currentPeriodEnd: string | null;
}

/**
 * The tier that actually governs access right now, computed live rather than
 * stored — neither a trial lapsing nor a cancellation taking effect needs a
 * cron job to "end" it, and nothing in `profiles` is ever rewritten just
 * because time passed. In order: an active paid subscription ('pro') always
 * wins; a 'canceled' subscription still reads as 'pro' until its current
 * paid period actually runs out (cancelling stops the NEXT charge, not the
 * period already paid for); otherwise an unexpired trial reads as
 * `trialing`; everything else (an expired trial, a lapsed cancellation, or
 * 'past_due') falls back to `free`.
 */
export function effectiveTier(
  state: TierState,
  now: Date = new Date(),
): SubscriptionTier {
  if (state.subscriptionTier === "pro") return "pro";
  if (
    state.subscriptionTier === "canceled" &&
    state.currentPeriodEnd &&
    new Date(state.currentPeriodEnd).getTime() > now.getTime()
  ) {
    return "pro";
  }
  if (
    state.trialEndsAt &&
    new Date(state.trialEndsAt).getTime() > now.getTime()
  ) {
    return "trialing";
  }
  return "free";
}

/**
 * Whether this account can still start its one trial — mirrors the
 * eligibility check inside `start_trial()` (migration 0022): a trial is
 * opt-in and one-shot, so this is true only before `trial_ends_at` has ever
 * been set (not "while active" — once used, used, even after it lapses) and
 * only while not currently getting Pro access from a subscription — active,
 * or canceled but still inside its paid period (effectiveTier covers both as
 * `'pro'`; the raw stored tier the database function checks is only ever
 * literally `'pro'`, but a canceled-with-time-left account reaching for a
 * trial on top of access it's already paying for is exactly as wrong, so
 * gating on the effective tier here is a strictly safer check, not a looser
 * one).
 */
export function canStartTrial(billing: {
  tier: SubscriptionTier;
  trialEndsAt: string | null;
}): boolean {
  return billing.trialEndsAt === null && billing.tier !== "pro";
}

/**
 * Whole days left in an active trial, for "ends in N days" copy — 0 on the
 * last day or once it's lapsed, never negative. Returns null when there's no
 * trial on record at all (nothing to count down).
 */
export function trialDaysRemaining(
  trialEndsAt: string | null,
  now: Date = new Date(),
): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 864e5));
}
