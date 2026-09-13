import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface RelatedCard {
  id: string;
  title: string | null;
  subjectId: string;
  subjectName: string | null;
  subjectColor: string | null;
  relation: string | null;
  source: "ai" | "manual";
}

/**
 * Related cards for each of `cardIds`, keyed by card id. One round trip.
 * Empty map if the `flashcard_links` table isn't there yet (migration 0017).
 */
export async function getRelatedForCards(
  cardIds: string[],
): Promise<Record<string, RelatedCard[]>> {
  if (cardIds.length === 0) return {};
  const supabase = await createClient();

  const idList = cardIds.join(",");
  const { data: links, error } = await supabase
    .from("flashcard_links")
    .select("flashcard_id, related_id, relation, source")
    .or(`flashcard_id.in.(${idList}),related_id.in.(${idList})`);
  if (error || !links?.length) return {};

  const want = new Set(cardIds);
  // card id → (other id → link meta)
  const perCard = new Map<
    string,
    Map<string, { relation: string | null; source: "ai" | "manual" }>
  >();
  const otherIds = new Set<string>();
  for (const l of links) {
    for (const [self, other] of [
      [l.flashcard_id, l.related_id],
      [l.related_id, l.flashcard_id],
    ] as const) {
      if (!want.has(self) || self === other) continue;
      const m = perCard.get(self) ?? new Map();
      if (!m.has(other)) m.set(other, { relation: l.relation, source: l.source });
      perCard.set(self, m);
      otherIds.add(other);
    }
  }
  if (otherIds.size === 0) return {};

  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, title, subject_id")
    .in("id", [...otherIds])
    .eq("is_active", true);
  const cardById = new Map((cards ?? []).map((c) => [c.id, c]));

  const subjectIds = [...new Set((cards ?? []).map((c) => c.subject_id))];
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, color")
    .in("id", subjectIds);
  const subjById = new Map((subjects ?? []).map((s) => [s.id, s]));

  const out: Record<string, RelatedCard[]> = {};
  for (const [selfId, others] of perCard) {
    const list: RelatedCard[] = [];
    for (const [otherId, meta] of others) {
      const c = cardById.get(otherId);
      if (!c) continue;
      const s = subjById.get(c.subject_id);
      list.push({
        id: c.id,
        title: c.title,
        subjectId: c.subject_id,
        subjectName: s?.name ?? null,
        subjectColor: s?.color ?? null,
        relation: meta.relation,
        source: meta.source,
      });
    }
    if (list.length) out[selfId] = list;
  }
  return out;
}

/** Related cards for one card (either direction). */
export async function getRelatedCards(
  flashcardId: string,
): Promise<RelatedCard[]> {
  const map = await getRelatedForCards([flashcardId]);
  return map[flashcardId] ?? [];
}
