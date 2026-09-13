import "server-only";

import { createClient } from "@/lib/supabase/server";
import { RECALL_COUNT } from "@/lib/constants";
import type { FlashcardWithSubject } from "@/lib/queries/flashcards";

/**
 * A weighted-random handful of the user's active flashcards for the
 * "quick recall" strip. Weighting lives in the `get_recall_cards` SQL
 * function (uniform today, error-weighted from Phase 6).
 */
export async function getRecallCards(
  limit = RECALL_COUNT,
): Promise<FlashcardWithSubject[]> {
  const supabase = await createClient();

  const { data: cards, error } = await supabase.rpc("get_recall_cards", {
    p_limit: limit,
  });
  if (error || !cards?.length) return [];

  const subjectIds = [...new Set(cards.map((c) => c.subject_id))];
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, color, icon")
    .in("id", subjectIds);

  const byId = new Map((subjects ?? []).map((s) => [s.id, s]));
  return cards.map((c) => ({
    ...c,
    subject: byId.get(c.subject_id) ?? null,
    imageUrls: [],
  }));
}
