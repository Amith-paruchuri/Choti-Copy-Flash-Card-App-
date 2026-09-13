import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSubjectTree, type SubjectNode } from "@/lib/queries/subjects";
import { listFlashcards } from "@/lib/queries/flashcards";
import { loadMemoryMap } from "@/lib/queries/review";
import { isDue, retrievability } from "@/lib/srs/fsrs";
import { masteryPct } from "@/lib/srs/mastery";
import { statusOf, type CardStatus } from "@/lib/srs/status";

export type { CardStatus };

export interface SubjectStat {
  id: string;
  name: string;
  parentId: string | null;
  path: string[];
  depth: number;
  color: string;
  icon: string | null;
  cards: number;
  /** Mean retrievability across the subtree's cards (unseen count as 0). */
  confidence: number;
  /**
   * Mean Mastery % (rating history — `@/lib/srs/mastery`) across the subtree's
   * *reviewed* cards. 0 when nothing's been reviewed. Doesn't decay with time.
   */
  mastery: number;
  mastered: number;
  struggling: number;
  learning: number;
  fresh: number;
  due: number;
  quizAnswered: number;
  quizCorrect: number;
}

export interface StatsOverview {
  totalCards: number;
  reviewedCards: number;
  mastered: number;
  struggling: number;
  learning: number;
  fresh: number;
  due: number;
  reviewsAllTime: number;
  studiedToday: number;
  streakDays: number;
  quizAnswered: number;
  quizCorrect: number;
  /** 7 most recent days, oldest first: review-event count per day. */
  week: { date: string; count: number }[];
  /** Every subject with cards, deepest-path first for a clean nested list. */
  subjects: SubjectStat[];
  /** Lowest-confidence subjects with enough cards to matter. */
  weakest: SubjectStat[];
}

const DAY = 864e5;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function getStats(): Promise<StatsOverview> {
  const now = new Date();
  const supabase = await createClient();

  const [tree, cards, memoryMap, eventsRes] = await Promise.all([
    getSubjectTree(),
    listFlashcards(),
    loadMemoryMap(),
    supabase
      .from("review_events")
      .select("flashcard_id, rating, source, reviewed_at")
      .order("reviewed_at", { ascending: false })
      .limit(5000),
  ]);
  const events = eventsRes.data ?? [];

  // ── per-card status + which subject it belongs to ────────────────────
  const cardsBySubject = new Map<string, typeof cards>();
  for (const card of cards) {
    const list = cardsBySubject.get(card.subject_id) ?? [];
    list.push(card);
    cardsBySubject.set(card.subject_id, list);
  }

  // quiz answers per card
  const quizByCard = new Map<string, { answered: number; correct: number }>();
  for (const e of events) {
    if (e.source !== "quiz") continue;
    const q = quizByCard.get(e.flashcard_id) ?? { answered: 0, correct: 0 };
    q.answered += 1;
    if (e.rating >= 3) q.correct += 1;
    quizByCard.set(e.flashcard_id, q);
  }

  // ── roll each subject's subtree up ──────────────────────────────────
  const subjectStats: SubjectStat[] = [];
  const rollUp = (node: SubjectNode): SubjectStat => {
    const stat: SubjectStat = {
      id: node.id,
      name: node.name,
      parentId: node.parent_id,
      path: node.path,
      depth: node.depth,
      color: node.color,
      icon: node.icon,
      cards: 0,
      confidence: 0,
      mastery: 0,
      mastered: 0,
      struggling: 0,
      learning: 0,
      fresh: 0,
      due: 0,
      quizAnswered: 0,
      quizCorrect: 0,
    };
    let confidenceSum = 0;
    let masterySum = 0;

    const own = cardsBySubject.get(node.id) ?? [];
    for (const card of own) {
      const memory = memoryMap.get(card.id) ?? null;
      const status = statusOf(memory, now);
      stat.cards += 1;
      confidenceSum += retrievability(memory, now);
      masterySum += masteryPct(memory) ?? 0;
      if (status === "mastered") stat.mastered += 1;
      else if (status === "struggling") stat.struggling += 1;
      else if (status === "learning") stat.learning += 1;
      else stat.fresh += 1;
      if (memory && memory.reps > 0 && isDue(memory, now)) stat.due += 1;
      const q = quizByCard.get(card.id);
      if (q) {
        stat.quizAnswered += q.answered;
        stat.quizCorrect += q.correct;
      }
    }

    for (const child of node.children) {
      const c = rollUp(child);
      stat.cards += c.cards;
      confidenceSum += c.confidence * c.cards;
      masterySum += c.mastery * (c.cards - c.fresh);
      stat.mastered += c.mastered;
      stat.struggling += c.struggling;
      stat.learning += c.learning;
      stat.fresh += c.fresh;
      stat.due += c.due;
      stat.quizAnswered += c.quizAnswered;
      stat.quizCorrect += c.quizCorrect;
    }

    const reviewed = stat.cards - stat.fresh;
    stat.confidence = stat.cards > 0 ? confidenceSum / stat.cards : 0;
    stat.mastery = reviewed > 0 ? masterySum / reviewed : 0;
    if (stat.cards > 0) subjectStats.push(stat);
    return stat;
  };
  for (const root of tree) rollUp(root);
  subjectStats.sort(
    (a, b) => a.path.join("/").localeCompare(b.path.join("/")),
  );

  // ── overview ────────────────────────────────────────────────────────
  let mastered = 0;
  let struggling = 0;
  let learning = 0;
  let fresh = 0;
  let due = 0;
  for (const card of cards) {
    const memory = memoryMap.get(card.id) ?? null;
    const status = statusOf(memory, now);
    if (status === "mastered") mastered += 1;
    else if (status === "struggling") struggling += 1;
    else if (status === "learning") learning += 1;
    else fresh += 1;
    if (memory && memory.reps > 0 && isDue(memory, now)) due += 1;
  }

  const perDay = new Map<string, number>();
  for (const e of events) {
    const k = e.reviewed_at.slice(0, 10);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const week: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * DAY);
    week.push({ date: dayKey(d), count: perDay.get(dayKey(d)) ?? 0 });
  }

  // streak: consecutive days ending today or yesterday with ≥1 review
  let streakDays = 0;
  const todayHas = (perDay.get(dayKey(now)) ?? 0) > 0;
  for (let i = todayHas ? 0 : 1; i < 400; i += 1) {
    const k = dayKey(new Date(now.getTime() - i * DAY));
    if ((perDay.get(k) ?? 0) > 0) streakDays += 1;
    else break;
  }

  let quizAnswered = 0;
  let quizCorrect = 0;
  for (const q of quizByCard.values()) {
    quizAnswered += q.answered;
    quizCorrect += q.correct;
  }

  const weakest = subjectStats
    .filter((s) => s.cards >= 3)
    .sort((a, b) => a.confidence - b.confidence)
    .slice(0, 6);

  return {
    totalCards: cards.length,
    reviewedCards: cards.length - fresh,
    mastered,
    struggling,
    learning,
    fresh,
    due,
    reviewsAllTime: events.length,
    studiedToday: perDay.get(dayKey(now)) ?? 0,
    streakDays,
    quizAnswered,
    quizCorrect,
    week,
    subjects: subjectStats,
    weakest,
  };
}
