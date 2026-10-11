import "server-only";

import { startOfUtcWeek } from "@/lib/billing/limits";
import type { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** How many PDF/image imports this account has created since Monday 00:00 UTC. */
export async function getWeeklyImportUsage(supabase: Supa): Promise<number> {
  const { count } = await supabase
    .from("imports")
    .select("*", { count: "exact", head: true })
    .in("kind", ["pdf", "image"])
    .gte("created_at", startOfUtcWeek().toISOString());
  return count ?? 0;
}
