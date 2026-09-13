/**
 * Pure pacing arithmetic for the review queue — Anki-style per-day new-card
 * limiting and daily-goal session sizing. No FSRS, no I/O.
 */

/**
 * How many new cards a single session may show, given the day's *remaining*
 * new-card allowance (`user_settings.new_cards_per_day` minus what's already
 * been introduced today).
 *   - `soft`: front-loaded near the top of the queue (~⅓ of the session) so a
 *     session isn't wall-to-wall unseen material
 *   - `hard`: the absolute ceiling for this session (leftover new cards may
 *     backfill empty slots up to here, never past the day's allowance)
 */
export function newCardBudget(
  limit: number,
  remainingNew: number,
): { soft: number; hard: number } {
  const capped = Math.max(0, remainingNew);
  return {
    soft: Math.min(capped, Math.max(1, Math.round(limit / 3))),
    hard: Math.min(capped, limit),
  };
}

/**
 * Size for the one-tap "Start studying" session. With a daily goal set and not
 * yet met, aim for the shortfall; otherwise a normal (or "review ahead")
 * session bounded by what's actually available.
 */
export function suggestedSessionSize(opts: {
  target: number | null;
  reviewedToday: number;
  availableToday: number;
}): number {
  const { target, reviewedToday, availableToday } = opts;
  if (target != null && reviewedToday < target) {
    return Math.max(1, target - reviewedToday);
  }
  return Math.max(1, Math.min(20, availableToday || 20));
}
