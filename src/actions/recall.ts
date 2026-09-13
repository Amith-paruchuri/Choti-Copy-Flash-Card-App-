"use server";

import { requireUser } from "@/lib/auth/session";
import { getRecallCards } from "@/lib/queries/recall";
import type { FlashcardWithSubject } from "@/lib/queries/flashcards";

/** Reroll the recall strip without a full page navigation. */
export async function shuffleRecall(
  limit?: number,
): Promise<FlashcardWithSubject[]> {
  await requireUser();
  return getRecallCards(limit);
}
