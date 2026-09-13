import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildForgettingCurve,
  type ForgettingCurve,
} from "@/lib/srs/forgetting";

interface RawLog {
  elapsed_days?: number;
}

/**
 * The learner's personal forgetting curve: empirical recall rate by
 * days-since-last-review (from the FSRS review log) plus the FSRS model curve
 * for their median stability.
 */
export async function getForgettingCurve(): Promise<ForgettingCurve> {
  const supabase = await createClient();
  const [eventsRes, memRes] = await Promise.all([
    supabase
      .from("review_events")
      .select("rating, log")
      .order("reviewed_at", { ascending: false })
      .limit(4000),
    supabase.from("card_memory").select("stability, state"),
  ]);

  const reviews: { elapsedDays: number; recalled: boolean }[] = [];
  for (const e of eventsRes.data ?? []) {
    const log = e.log as RawLog | null;
    const elapsed =
      typeof log?.elapsed_days === "number" ? log.elapsed_days : 0;
    if (elapsed < 1) continue;
    // rating 1 = Again (forgot); 2–4 = recalled (with effort or better)
    reviews.push({ elapsedDays: elapsed, recalled: (e.rating as number) >= 2 });
  }

  const rows = memRes.data ?? [];
  // Cards actually in the Review state give the truest stability signal;
  // fall back to anything with a stability if there are none yet.
  let stabilities = rows
    .filter((r) => r.state === 2 && (r.stability as number) > 0)
    .map((r) => r.stability as number);
  if (stabilities.length === 0) {
    stabilities = rows
      .filter((r) => (r.stability as number) > 0)
      .map((r) => r.stability as number);
  }

  return buildForgettingCurve(reviews, stabilities);
}
