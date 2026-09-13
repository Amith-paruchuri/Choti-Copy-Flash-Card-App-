/**
 * "Mastery %" — a DISPLAY-ONLY score for the concept map. It answers "how well
 * have I actually learned this over time", which is a different question from
 * FSRS's "what should I study today".
 *
 * Built from rating history, not time-decayed retrievability: it rises as FSRS
 * stability compounds under Good/Easy ratings and drops on lapses, but it does
 * NOT fall just because a card is overdue. Nothing here touches scheduling —
 * `buildReviewSession`, due dates and the recall strip keep using
 * `retrievability` / `isDue` exactly as before.
 *
 * Pure and client-safe.
 */
import type { CardMemory } from "@/lib/srs/fsrs";

/** Days of FSRS stability that read as "fully learned". */
export const STABILITY_CEIL = 75;
/** Mastery points removed per lapse … */
export const LAPSE_PENALTY = 12;
/** … capped here, so a rocky history dents the score without burying a card
 * that has genuinely recovered. */
export const LAPSE_PENALTY_MAX = 40;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * 0–100 for a card that's been reviewed at least once; `null` for a New card
 * (never attempted — rendered in muted grey, not on the red→green gradient).
 */
export function masteryPct(memory: CardMemory | null): number | null {
  if (!memory || memory.reps === 0) return null;
  const base =
    100 * clamp(Math.sqrt(Math.max(0, memory.stability) / STABILITY_CEIL), 0, 1);
  const penalty = Math.min(LAPSE_PENALTY_MAX, memory.lapses * LAPSE_PENALTY);
  return clamp(Math.round(base - penalty), 0, 100);
}
