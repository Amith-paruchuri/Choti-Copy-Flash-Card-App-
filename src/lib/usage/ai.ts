import "server-only";

import type { requireUser } from "@/lib/auth/session";

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Records one AI-provider call against today's per-user usage counter.
 * Call this once, right after a `getAIProvider().xxx(...)` call succeeds —
 * a call that throws shouldn't count against the user's quota.
 *
 * Best-effort: usage tracking is observational (see `caps.ts` — enforcement
 * is soft-warn only, for now), so a tracking failure must never surface as
 * a user-facing error or block the feature that triggered it.
 */
export async function recordAiCall(supabase: Supa): Promise<void> {
  try {
    await supabase.rpc("record_ai_call");
  } catch {
    // non-fatal — see above
  }
}
