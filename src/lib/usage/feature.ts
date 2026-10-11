import "server-only";

import {
  checkLimit,
  type FeatureKey,
  type LimitCheck,
} from "@/lib/billing/limits";
import type { requireUser } from "@/lib/auth/session";

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Today's count for one feature. Returns 0 (not an error) if migration
 * 0024 (`feature_usage_daily`) hasn't been applied yet — same
 * defensive-migration convention used throughout this codebase (see
 * `getStudyPacing()`, `getUsageSummary()`).
 */
export async function getFeatureUsageToday(
  supabase: Supa,
  feature: FeatureKey,
): Promise<number> {
  const { data, error } = await supabase
    .from("feature_usage_daily")
    .select("count")
    .eq("day", todayUtc())
    .eq("feature", feature)
    .maybeSingle();
  if (error || !data) return 0;
  return data.count;
}

/**
 * Checks whether `amount` more of `feature` fits today's cap, WITHOUT
 * recording anything — call this before doing the AI work so the limit is
 * enforced up front, not after the (billable) call already happened. Fails
 * open (reports room available) if migration 0024 isn't applied yet, rather
 * than blocking every card/mnemonic/quiz generation in the app the moment
 * this code ships ahead of that migration.
 */
export async function checkFeatureLimit(
  supabase: Supa,
  feature: FeatureKey,
  cap: number,
  amount = 1,
): Promise<LimitCheck> {
  const used = await getFeatureUsageToday(supabase, feature);
  return checkLimit(used, cap, amount);
}

/**
 * Records `amount` more usage against today's counter for `feature`.
 * Best-effort: a tracking failure (including migration 0024 not applied
 * yet) must never surface as a user-facing error or block the feature that
 * triggered it — enforcement already happened in `checkFeatureLimit()`
 * before the AI call ran.
 */
export async function recordFeatureUsage(
  supabase: Supa,
  feature: FeatureKey,
  amount = 1,
): Promise<void> {
  try {
    await supabase.rpc("record_feature_usage", {
      p_feature: feature,
      p_amount: amount,
    });
  } catch {
    // non-fatal — see above
  }
}
