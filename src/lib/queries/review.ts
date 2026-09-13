import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listFlashcards, type FlashcardWithSubject } from "@/lib/queries/flashcards";
import { getStudyPacing, type StudyPacing } from "@/lib/queries/settings";
import { newCardBudget, suggestedSessionSize } from "@/lib/srs/pacing";
import { isDue, retrievability, type CardMemory } from "@/lib/srs/fsrs";
import type { CardMemoryRow } from "@/types/database";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Local midnight for `now` — the day boundary for pacing counts. */
function startOfLocalDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface TodayCounts {
  /** distinct cards touched today (any source) — progress toward the daily goal */
  reviewedToday: number;
  /** cards whose FIRST-EVER review happened today — counts against the new-card cap */
  newIntroducedToday: number;
}

/**
 * How much studying has happened today. Two cheap queries: everything reviewed
 * since local midnight, then which of those cards had never been reviewed
 * before today.
 */
async function getTodayCounts(
  supabase: Supabase,
  now: Date,
): Promise<TodayCounts> {
  const start = startOfLocalDay(now).toISOString();
  const { data: todayRows } = await supabase
    .from("review_events")
    .select("flashcard_id")
    .gte("reviewed_at", start);
  const todayIds = [...new Set((todayRows ?? []).map((r) => r.flashcard_id))];
  if (todayIds.length === 0) {
    return { reviewedToday: 0, newIntroducedToday: 0 };
  }
  const { data: priorRows } = await supabase
    .from("review_events")
    .select("flashcard_id")
    .in("flashcard_id", todayIds)
    .lt("reviewed_at", start);
  const seenBefore = new Set((priorRows ?? []).map((r) => r.flashcard_id));
  return {
    reviewedToday: todayIds.length,
    newIntroducedToday: todayIds.filter((id) => !seenBefore.has(id)).length,
  };
}

export interface ReviewItem {
  card: FlashcardWithSubject;
  memory: CardMemory | null;
}

/** Strip the row down to the FSRS fields. */
export function toMemory(row: CardMemoryRow): CardMemory {
  return {
    state: row.state,
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    last_review: row.last_review,
  };
}

export async function loadMemoryMap(): Promise<Map<string, CardMemory>> {
  const supabase = await createClient();
  const { data } = await supabase.from("card_memory").select("*");
  return new Map((data ?? []).map((r) => [r.flashcard_id, toMemory(r)]));
}

/** Flashcard ids the user has suspended as leeches — excluded from rotation. */
export async function loadSuspendedIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_memory")
    .select("flashcard_id")
    .eq("suspended", true);
  // Before migration 0014 the column doesn't exist — treat as "no leeches".
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.flashcard_id));
}

/** Priority for a study queue — higher = more worth seeing now. Shared by review + quiz. */
export function studyPriority(memory: CardMemory | null, now: Date): number {
  if (!memory || memory.reps === 0) return 2; // new cards: steady baseline
  const r = retrievability(memory, now);
  const overdueDays = Math.max(
    0,
    (now.getTime() - new Date(memory.due).getTime()) / 864e5,
  );
  return (
    (isDue(memory, now) ? 1.5 : 0) +
    (1 - r) * 3 +
    Math.min(memory.lapses, 5) * 0.8 +
    overdueDays * 0.05
  );
}

/** Subjects whose reviewed cards recall worst — the weak-area bias for smart sessions. */
function weakSubjectIds(
  items: ReviewItem[],
  now: Date,
): Set<string> {
  const bySubject = new Map<string, { sum: number; n: number }>();
  for (const i of items) {
    if (!i.memory || i.memory.reps === 0) continue;
    const acc = bySubject.get(i.card.subject_id) ?? { sum: 0, n: 0 };
    acc.sum += retrievability(i.memory, now);
    acc.n += 1;
    bySubject.set(i.card.subject_id, acc);
  }
  const ranked = [...bySubject.entries()]
    .filter(([, v]) => v.n >= 3)
    .map(([id, v]) => ({ id, mean: v.sum / v.n }))
    .sort((a, b) => a.mean - b.mean);
  // Bottom third, plus anything clearly shaky (mean recall < 70%).
  const cut = Math.max(1, Math.ceil(ranked.length / 3));
  return new Set(
    ranked.filter((r, i) => i < cut || r.mean < 0.7).map((r) => r.id),
  );
}

/**
 * Build a weighted review queue: due + shaky + repeatedly-missed first, then
 * backfill with the soonest-due so a "Review 20" always yields 20.
 *
 * New cards obey a PER-DAY cap (`user_settings.new_cards_per_day`, default 20)
 * tracked across every session that day — once the day's allowance is spent,
 * sessions backfill purely with due/review cards. Within the day's remaining
 * allowance a session still front-loads only ~⅓ new so a session isn't all
 * unseen material.
 *
 * `smart: true` (the one-tap "Start studying" session) additionally pulls
 * weakest-topic cards toward the front, even when they aren't strictly due.
 */
export async function buildReviewSession(
  limit: number,
  opts: { smart?: boolean } = {},
): Promise<ReviewItem[]> {
  const now = new Date();
  const supabase = await createClient();
  const [cards, memoryMap, suspended, pacing, today] = await Promise.all([
    listFlashcards(),
    loadMemoryMap(),
    loadSuspendedIds(),
    getStudyPacing(),
    getTodayCounts(supabase, now),
  ]);

  const items: ReviewItem[] = cards
    .filter((card) => !suspended.has(card.id))
    .map((card) => ({
      card,
      memory: memoryMap.get(card.id) ?? null,
    }));

  const weak = opts.smart ? weakSubjectIds(items, now) : new Set<string>();
  const score = (i: ReviewItem) =>
    studyPriority(i.memory, now) + (weak.has(i.card.subject_id) ? 1.5 : 0);

  const isNew = (i: ReviewItem) => !i.memory || i.memory.reps === 0;
  const due = items.filter((i) => isDue(i.memory, now) && !isNew(i));
  const fresh = items.filter(isNew);
  const later = items.filter((i) => !isDue(i.memory, now) && !isNew(i));

  const byScore = (a: ReviewItem, b: ReviewItem) => score(b) - score(a);
  const bySoonest = (a: ReviewItem, b: ReviewItem) =>
    new Date(a.memory?.due ?? 0).getTime() -
    new Date(b.memory?.due ?? 0).getTime();

  due.sort(byScore);
  // Smart mode floats weak non-due cards up; plain mode keeps soonest-due order.
  later.sort(opts.smart ? byScore : bySoonest);

  // The day's remaining new-card allowance, across all sessions so far.
  const remainingNew = pacing.newCardsPerDay - today.newIntroducedToday;
  const { soft, hard } = newCardBudget(limit, remainingNew);

  const queue: ReviewItem[] = [
    ...due,
    ...fresh.slice(0, soft),
    ...later,
    // leftover new cards backfill remaining slots, but never past the day's cap
    ...fresh.slice(soft, hard),
  ];
  return queue.slice(0, limit);
}

export interface DueCounts {
  /** due and became due since local midnight */
  dueToday: number;
  /** overdue 1-2 days */
  overdue1to2: number;
  /** overdue 3-6 days */
  overdue3to6: number;
  /** overdue 7-13 days */
  overdue7to13: number;
  /** overdue 14+ days — genuinely stale */
  overdue14plus: number;
  /** never-reviewed cards (uncapped count; the daily cap applies at session build) */
  fresh: number;
}

/** Sum of every overdue bucket — the old lump "carried over" total. */
export function totalOverdue(
  due: Pick<
    DueCounts,
    "overdue1to2" | "overdue3to6" | "overdue7to13" | "overdue14plus"
  >,
): number {
  return (
    due.overdue1to2 + due.overdue3to6 + due.overdue7to13 + due.overdue14plus
  );
}

/**
 * Cards ready for review right now, bucketed by how overdue they are so a
 * user can tell "a few days behind" apart from "genuinely stale" at a glance.
 */
export async function getDueCounts(): Promise<DueCounts> {
  const now = new Date();
  const dayStart = startOfLocalDay(now).getTime();
  const [cards, memoryMap, suspended] = await Promise.all([
    listFlashcards(),
    loadMemoryMap(),
    loadSuspendedIds(),
  ]);
  let dueToday = 0;
  let overdue1to2 = 0;
  let overdue3to6 = 0;
  let overdue7to13 = 0;
  let overdue14plus = 0;
  let fresh = 0;
  for (const card of cards) {
    if (suspended.has(card.id)) continue;
    const memory = memoryMap.get(card.id) ?? null;
    if (!memory || memory.reps === 0) {
      fresh += 1;
    } else if (isDue(memory, now)) {
      const dueDayStart = startOfLocalDay(new Date(memory.due)).getTime();
      const daysOverdue = Math.round((dayStart - dueDayStart) / 864e5);
      if (daysOverdue <= 0) dueToday += 1;
      else if (daysOverdue <= 2) overdue1to2 += 1;
      else if (daysOverdue <= 6) overdue3to6 += 1;
      else if (daysOverdue <= 13) overdue7to13 += 1;
      else overdue14plus += 1;
    }
  }
  return {
    dueToday,
    overdue1to2,
    overdue3to6,
    overdue7to13,
    overdue14plus,
    fresh,
  };
}

export interface DailyProgress {
  pacing: StudyPacing;
  due: DueCounts;
  /** distinct cards studied today (progress toward the goal) */
  reviewedToday: number;
  /** new cards already introduced today */
  newIntroducedToday: number;
  /** new cards that can still be introduced today (cap minus what's been introduced), bounded by how many exist */
  newAvailable: number;
  /** cards you could still study today: due backlog + as many new as the cap allows */
  availableToday: number;
  /** size to hand the "Start studying" session right now */
  suggestedSessionSize: number;
  /** true once a goal is set and today's distinct-card count has reached it */
  goalMet: boolean;
}

/** One call powering the dashboard "Start studying" banner + progress. */
export async function getDailyProgress(): Promise<DailyProgress> {
  const now = new Date();
  const supabase = await createClient();
  const [due, pacing, today] = await Promise.all([
    getDueCounts(),
    getStudyPacing(),
    getTodayCounts(supabase, now),
  ]);

  const remainingNew = Math.max(
    0,
    pacing.newCardsPerDay - today.newIntroducedToday,
  );
  const dueTotal = due.dueToday + totalOverdue(due);
  const newAvailable = Math.min(due.fresh, remainingNew);
  const availableToday = dueTotal + newAvailable;

  const target = pacing.dailyReviewTarget;
  const goalMet = target != null && today.reviewedToday >= target;

  return {
    pacing,
    due,
    reviewedToday: today.reviewedToday,
    newIntroducedToday: today.newIntroducedToday,
    newAvailable,
    availableToday,
    suggestedSessionSize: suggestedSessionSize({
      target,
      reviewedToday: today.reviewedToday,
      availableToday,
    }),
    goalMet,
  };
}
