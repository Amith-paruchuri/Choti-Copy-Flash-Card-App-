import type { SubscriptionTier } from "@/types/database";

export interface TierState {
  subscriptionTier: SubscriptionTier;
  trialEndsAt: string | null;
}

/**
 * The tier that actually governs access right now, computed live rather than
 * stored — a trial lapsing needs no cron job to "end" it, and nothing in
 * `profiles` is ever rewritten just because time passed. An active paid
 * subscription always wins; otherwise an unexpired trial reads as
 * `trialing`; everything else (an expired trial, or a lapsed/past-due
 * subscription past any trial window) falls back to `free`.
 */
export function effectiveTier(
  state: TierState,
  now: Date = new Date(),
): SubscriptionTier {
  if (state.subscriptionTier === "pro") return "pro";
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
 * only while not already on a real paid subscription. Takes the EFFECTIVE
 * tier (as returned by `effectiveTier`), which is safe here because it's
 * `'pro'` if and only if the raw stored tier is `'pro'` — same condition the
 * database function checks.
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
