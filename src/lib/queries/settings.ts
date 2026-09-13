import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface StudyPacing {
  /** Max genuinely-new cards to introduce per day, across all sessions. */
  newCardsPerDay: number;
  /** Personal cards/day goal (due + new), or null when the user hasn't set one. */
  dailyReviewTarget: number | null;
}

export const DEFAULT_NEW_PER_DAY = 20;

/**
 * The caller's study-pacing settings, with sensible defaults when they've never
 * touched them — or when migration 0020 (`user_settings`) isn't applied yet.
 */
export async function getStudyPacing(): Promise<StudyPacing> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("new_cards_per_day, daily_review_target")
    .maybeSingle();

  if (error || !data) {
    return { newCardsPerDay: DEFAULT_NEW_PER_DAY, dailyReviewTarget: null };
  }
  return {
    newCardsPerDay: data.new_cards_per_day ?? DEFAULT_NEW_PER_DAY,
    dailyReviewTarget: data.daily_review_target ?? null,
  };
}
