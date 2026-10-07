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
