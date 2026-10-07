import "server-only";

import { effectiveTier } from "@/lib/billing/tier";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/types/database";

export interface AccountSummary {
  activeCards: number;
  reviewsAllTime: number;
  /** consecutive days ending today or yesterday with at least one review */
  streakDays: number;
}

const DAY = 864e5;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export interface BillingProfile {
  tier: SubscriptionTier;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
}

/**
 * The caller's subscription state — defaults to free if no row yet. `tier`
 * is the EFFECTIVE tier (trial-aware, see `effectiveTier()`), not the raw
 * stored `subscription_tier` — callers should never need to know about the
 * trial separately unless they want to render "ends on X" copy, which is
 * what `trialEndsAt` is for.
 */
export async function getBillingProfile(): Promise<BillingProfile> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("subscription_tier, current_period_end, trial_ends_at")
    .maybeSingle();
  const trialEndsAt = data?.trial_ends_at ?? null;
  return {
    tier: effectiveTier({
      subscriptionTier: data?.subscription_tier ?? "free",
      trialEndsAt,
    }),
    currentPeriodEnd: data?.current_period_end ?? null,
    trialEndsAt,
  };
}

/** Quick account-wide totals for the profile page. */
export async function getAccountSummary(): Promise<AccountSummary> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 120 * DAY).toISOString();

  const [cards, reviews, recent] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("review_events")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("review_events")
      .select("reviewed_at")
      .gte("reviewed_at", since),
  ]);

  const days = new Set(
    (recent.data ?? []).map((r) => dayKey(new Date(r.reviewed_at))),
  );
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let streakDays = 0;
  const start = days.has(dayKey(now))
    ? 0
    : days.has(dayKey(new Date(now.getTime() - DAY)))
      ? 1
      : -1;
  if (start >= 0) {
    for (let i = start; i < 120; i += 1) {
      if (days.has(dayKey(new Date(now.getTime() - i * DAY)))) streakDays += 1;
      else break;
    }
  }

  return {
    activeCards: cards.count ?? 0,
    reviewsAllTime: reviews.count ?? 0,
    streakDays,
  };
}
