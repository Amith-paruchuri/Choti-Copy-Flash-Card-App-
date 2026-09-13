import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listFlashcards, type FlashcardWithSubject } from "@/lib/queries/flashcards";

export interface Leech {
  card: FlashcardWithSubject;
  lapses: number;
  suspendedAt: string | null;
}

/**
 * Cards the user has suspended as leeches — repeatedly missed, pulled from
 * review + quiz rotation until reactivated. Most recently suspended first.
 */
export async function listLeeches(): Promise<Leech[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("card_memory")
    .select("flashcard_id, lapses, suspended_at")
    .eq("suspended", true);

  if (error || !rows?.length) return []; // column absent → migration 0014 pending

  const meta = new Map(rows.map((r) => [r.flashcard_id, r]));
  const cards = await listFlashcards();

  return cards
    .filter((c) => meta.has(c.id))
    .map((card) => {
      const r = meta.get(card.id)!;
      return { card, lapses: r.lapses, suspendedAt: r.suspended_at };
    })
    .sort(
      (a, b) =>
        new Date(b.suspendedAt ?? 0).getTime() -
        new Date(a.suspendedAt ?? 0).getTime(),
    );
}

export async function countLeeches(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("card_memory")
    .select("flashcard_id", { count: "exact", head: true })
    .eq("suspended", true);
  if (error) return 0; // migration 0014 pending
  return count ?? 0;
}
