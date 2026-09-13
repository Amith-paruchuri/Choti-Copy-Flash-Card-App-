import type { SubscriptionTier } from "@/types/database";

/**
 * Tier-based usage caps. Both resources are backed by a *shared* project-wide
 * budget (one Gemini/Grok API key, one Supabase Storage bucket for everyone),
 * so these numbers exist to keep the sum across all free users comfortably
 * under that shared ceiling — not to describe what any one user "should" use.
 *
 * AI calls/day: Google doesn't publish one fixed free-tier RPD number for the
 * configured model (`GEMINI_MODEL`) — their own docs point at the live quota
 * in AI Studio, and independent reports for flash-lite land somewhere in the
 * ~1,000–1,500 requests/day band for the whole project key. 40/user/day means
 * that shared ceiling isn't exhausted until 25-35+ free users each hit their
 * personal cap on the very same day — a comfortable margin at the app's
 * current scale, while still covering a real day's use (a big PDF import is
 * ~10-15 calls at today's import caps, plus a quiz session and a couple of
 * mnemonics/related-card lookups on top).
 *
 * Storage: Supabase's free plan ships 1 GB of bucket storage, shared the same
 * way. 30 MB/free-user keeps ~25 users at 100% utilization before the bucket
 * fills, which is generous headroom since the cap is a ceiling, not a typical
 * user's actual footprint (cards are mostly text; images are compressed to
 * ~1600px JPEG/WebP on upload).
 *
 * Pro/trialing gets a materially higher cap so the tier mechanism has
 * somewhere to go once billing goes live (it isn't yet — see `env.ts`).
 * `past_due`/`canceled` fall back to the free cap: lost paid access reverts
 * to free-tier behavior, same as the rest of the billing model.
 */
export const USAGE_CAPS = {
  free: { aiCallsPerDay: 40, storageBytes: 30 * 1024 * 1024 },
  pro: { aiCallsPerDay: 200, storageBytes: 300 * 1024 * 1024 },
} as const;

export interface TierCaps {
  aiCallsPerDay: number;
  storageBytes: number;
}

export function capsForTier(tier: SubscriptionTier | string): TierCaps {
  return tier === "pro" || tier === "trialing" ? USAGE_CAPS.pro : USAGE_CAPS.free;
}
