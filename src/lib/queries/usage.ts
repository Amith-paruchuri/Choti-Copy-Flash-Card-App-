import "server-only";

import { effectiveTier } from "@/lib/billing/tier";
import { createClient } from "@/lib/supabase/server";
import { capsForTier } from "@/lib/usage/caps";
import type { SubscriptionTier } from "@/types/database";

export interface UsageSummary {
  tier: SubscriptionTier;
  aiCallsToday: number;
  aiCallsCap: number;
  storageBytes: number;
  storageCap: number;
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Today's AI-call count + live storage total for the signed-in user, against
 * their tier's caps. Storage is computed straight from `media_objects`
 * (0013) rather than tracked separately — see the 0021 migration comment.
 */
export async function getUsageSummary(): Promise<UsageSummary> {
  const supabase = await createClient();

  const [{ data: profile }, { data: usage }, { data: mediaRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("subscription_tier, trial_ends_at")
        .maybeSingle(),
      supabase
        .from("ai_usage_daily")
        .select("calls")
        .eq("day", todayUtc())
        .maybeSingle(),
      supabase.from("media_objects").select("bytes"),
    ]);

  const tier = effectiveTier({
    subscriptionTier: profile?.subscription_tier ?? "free",
    trialEndsAt: profile?.trial_ends_at ?? null,
  });
  const caps = capsForTier(tier);
  const storageBytes = (mediaRows ?? []).reduce(
    (sum, r) => sum + (r.bytes ?? 0),
    0,
  );

  return {
    tier,
    aiCallsToday: usage?.calls ?? 0,
    aiCallsCap: caps.aiCallsPerDay,
    storageBytes,
    storageCap: caps.storageBytes,
  };
}
