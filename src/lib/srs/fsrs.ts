/**
 * The one place that touches `ts-fsrs`. FSRS-6 with library-default weights;
 * weights become tunable once there's review history to optimise against.
 *
 * Pure — safe to import on the server (scheduling) and the client (projected
 * interval labels on the rating buttons).
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
  type ReviewLog,
} from "ts-fsrs";

export { Rating, State };
export type RatingValue = 1 | 2 | 3 | 4; // Again · Hard · Good · Easy

/** Our `card_memory` row shape. `null` ⇒ a card never reviewed (state New). */
export interface CardMemory {
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  last_review: string | null;
}

const scheduler = fsrs(
  generatorParameters({ enable_fuzz: true, enable_short_term: true }),
);

function toCard(memory: CardMemory | null, now: Date): Card {
  if (!memory) return createEmptyCard(now);
  return {
    due: new Date(memory.due),
    stability: memory.stability,
    difficulty: memory.difficulty,
    elapsed_days: memory.elapsed_days,
    scheduled_days: memory.scheduled_days,
    learning_steps: memory.learning_steps,
    reps: memory.reps,
    lapses: memory.lapses,
    state: memory.state as State,
    last_review: memory.last_review ? new Date(memory.last_review) : undefined,
  };
}

function fromCard(card: Card): CardMemory {
  return {
    state: card.state,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps ?? 0,
    reps: card.reps,
    lapses: card.lapses,
    last_review: card.last_review
      ? new Date(card.last_review).toISOString()
      : null,
  };
}

export interface AppliedRating {
  memory: CardMemory;
  log: ReviewLog;
}

/** Advance a card's state by one rating. */
export function applyRating(
  memory: CardMemory | null,
  rating: RatingValue,
  now: Date = new Date(),
): AppliedRating {
  const { card, log } = scheduler.next(
    toCard(memory, now),
    now,
    rating as Grade,
  );
  return { memory: fromCard(card), log };
}

/** Predicted probability of recalling the card right now — the confidence signal. */
export function retrievability(
  memory: CardMemory | null,
  now: Date = new Date(),
): number {
  if (!memory || memory.reps === 0) return 0;
  return scheduler.get_retrievability(toCard(memory, now), now, false) as number;
}

/**
 * The FSRS forgetting curve for a hypothetical card: predicted recall
 * probability `elapsedDays` after its last review, given stability `S`. Runs
 * through the real configured scheduler so it always matches the app's FSRS
 * parameters. Pure — powers the "your forgetting curve" chart.
 */
export function projectRecall(stability: number, elapsedDays: number): number {
  if (!(stability > 0)) return elapsedDays <= 0 ? 1 : 0;
  const anchor = new Date(0);
  const card: Card = {
    ...createEmptyCard(anchor),
    state: State.Review,
    stability,
    difficulty: 5,
    reps: 1,
    last_review: anchor,
  };
  const at = new Date(anchor.getTime() + Math.max(0, elapsedDays) * 86_400_000);
  return scheduler.get_retrievability(card, at, false) as number;
}

/** A wrong quiz answer is an FSRS "Again"; a correct one is "Good" (never Easy). */
export function ratingForQuiz(correct: boolean): RatingValue {
  return (correct ? Rating.Good : Rating.Again) as RatingValue;
}

export function isDue(
  memory: CardMemory | null,
  now: Date = new Date(),
): boolean {
  if (!memory) return true;
  return new Date(memory.due).getTime() <= now.getTime();
}

function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo`;
  const yr = day / 365;
  return `${yr < 2 ? yr.toFixed(1) : Math.round(yr)}y`;
}

/** Interval label for each rating button ("<1m", "4d", "2mo"), from `now`. */
export function projectIntervals(
  memory: CardMemory | null,
  now: Date = new Date(),
): Record<RatingValue, string> {
  const rec = scheduler.repeat(toCard(memory, now), now);
  const at = (r: Grade) =>
    formatInterval(rec[r].card.due.getTime() - now.getTime());
  return {
    1: at(Rating.Again),
    2: at(Rating.Hard),
    3: at(Rating.Good),
    4: at(Rating.Easy),
  };
}
