/**
 * A confidence / mastery fraction (0–1) → a colour on the rose → violet → mint
 * ramp. Shared by the Progress subject bars and the mastery-comparison chart so
 * the two read the same. CSS tokens so both themes work.
 *   rose (--clay)   struggling
 *   violet (--highlight)  getting there
 *   mint (--sage)   solid
 */
export function scoreColor(fraction: number): string {
  if (fraction >= 0.66) return "var(--sage)";
  if (fraction >= 0.33) return "var(--highlight)";
  return "var(--clay)";
}
