import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listFlashcards } from "@/lib/queries/flashcards";
import { listSubjects } from "@/lib/queries/subjects";
import { loadMemoryMap } from "@/lib/queries/review";
import { expandSubjectScope } from "@/lib/queries/quiz";
import { masteryPct } from "@/lib/srs/mastery";

export interface GraphNode {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string | null;
  /** rating-history mastery 0–100, or null for a never-reviewed card */
  mastery: number | null;
  /** FSRS lapse count — drives the node's ring */
  lapses: number;
  /** review + quiz attempts logged for this card — drives node size */
  attempts: number;
}

/** One subject present among the nodes — the client clusters nodes by these. */
export interface GraphSubject {
  id: string;
  name: string;
  color: string | null;
  /** top-level ancestor (self when already top-level); groups siblings spatially */
  rootId: string;
}

export interface ConceptGraph {
  nodes: GraphNode[];
  subjects: GraphSubject[];
  /** true when the node set was capped */
  truncated: boolean;
}

const NODE_CAP = 400;

/** Walk parent_id to the top-level ancestor. Cycle-safe. */
function rootOf(
  id: string,
  parentById: Map<string, string | null>,
): string {
  const seen = new Set<string>();
  let cur = id;
  while (!seen.has(cur)) {
    seen.add(cur);
    const parent = parentById.get(cur);
    if (!parent || !parentById.has(parent)) return cur;
    cur = parent;
  }
  return cur;
}

/**
 * Build the concept map for a subject subtree (or the whole account when
 * `subjectId` is omitted). Nodes = flashcards; the client positions them in
 * clusters by subject branch (`subjects[].rootId`). No AI, no edges.
 *
 *   size   = review/quiz attempts (`review_events`)
 *   fill   = Mastery % from rating history (`@/lib/srs/mastery`)
 *   ring   = FSRS lapse count
 */
export async function getConceptGraph(
  subjectId?: string,
): Promise<ConceptGraph> {
  const supabase = await createClient();

  const [cards, memoryMap, allSubjects, scope] = await Promise.all([
    listFlashcards(),
    loadMemoryMap(),
    listSubjects(),
    subjectId
      ? expandSubjectScope([subjectId])
      : Promise.resolve<Set<string> | null>(null),
  ]);

  const inScope = cards.filter((c) => !scope || scope.has(c.subject_id));
  const cardIds = new Set(inScope.map((c) => c.id));

  // ── attempt counts (one row per review + quiz answer) ───────────────
  const attempts = new Map<string, number>();
  if (cardIds.size > 0) {
    const { data: events } = await supabase
      .from("review_events")
      .select("flashcard_id")
      .in("flashcard_id", [...cardIds]);
    for (const e of events ?? []) {
      attempts.set(e.flashcard_id, (attempts.get(e.flashcard_id) ?? 0) + 1);
    }
  }

  // ── node cap: keep the most-engaged, then most-recently-reviewed ────
  let ranked = inScope.map((c) => ({
    card: c,
    mem: memoryMap.get(c.id) ?? null,
    n: attempts.get(c.id) ?? 0,
  }));
  const truncated = ranked.length > NODE_CAP;
  if (truncated) {
    ranked = ranked
      .sort((a, b) => {
        if (b.n !== a.n) return b.n - a.n;
        const at = a.mem?.last_review ? Date.parse(a.mem.last_review) : 0;
        const bt = b.mem?.last_review ? Date.parse(b.mem.last_review) : 0;
        return bt - at;
      })
      .slice(0, NODE_CAP);
  }

  const nodes: GraphNode[] = ranked.map(({ card, mem, n }) => ({
    id: card.id,
    title: card.title || card.content.slice(0, 60),
    subjectId: card.subject_id,
    subjectName: card.subject?.name ?? null,
    mastery: masteryPct(mem),
    lapses: mem?.lapses ?? 0,
    attempts: n,
  }));

  // ── subjects present among the kept nodes, with their root ancestor ──
  const parentById = new Map(allSubjects.map((s) => [s.id, s.parent_id]));
  const subjectById = new Map(allSubjects.map((s) => [s.id, s]));
  const presentIds = new Set(nodes.map((n) => n.subjectId));
  const subjects: GraphSubject[] = [...presentIds].map((id) => {
    const s = subjectById.get(id);
    return {
      id,
      name: s?.name ?? "—",
      color: s?.color ?? null,
      rootId: rootOf(id, parentById),
    };
  });

  return { nodes, subjects, truncated };
}
