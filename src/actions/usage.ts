"use server";

import { requireUser } from "@/lib/auth/session";
import { FEATURE, limitsForTier } from "@/lib/billing/limits";
import { trialDaysRemaining } from "@/lib/billing/tier";
import { getBillingProfile } from "@/lib/queries/account";
import { getFeatureUsageToday } from "@/lib/usage/feature";
import type { SubscriptionTier } from "@/types/database";

export interface FeatureUsageSnapshot {
  tier: SubscriptionTier;
  /** Days left in an active trial — null outside a trial. */
  trialDaysLeft: number | null;
  mnemonics: { used: number; cap: number };
  quizSets: { used: number; cap: number };
}

/**
 * Self-fetched by UI that's reused across many places in the component
 * tree (CardMnemonic, the quiz generation screen) — cheaper than threading
 * today's counts down through every parent that might render them.
 */
export async function getMyFeatureUsage(): Promise<FeatureUsageSnapshot> {
  const { supabase } = await requireUser();
  const { tier, trialEndsAt } = await getBillingProfile();
  const limits = limitsForTier(tier);

  const [mnemonicsUsed, quizSetsUsed] = await Promise.all([
    getFeatureUsageToday(supabase, FEATURE.mnemonics),
    getFeatureUsageToday(supabase, FEATURE.quizSets),
  ]);

  return {
    tier,
    trialDaysLeft:
      tier === "trialing" ? trialDaysRemaining(trialEndsAt) : null,
    mnemonics: { used: mnemonicsUsed, cap: limits.aiMnemonicsPerDay },
    quizSets: { used: quizSetsUsed, cap: limits.aiQuizSetsPerDay },
  };
}
