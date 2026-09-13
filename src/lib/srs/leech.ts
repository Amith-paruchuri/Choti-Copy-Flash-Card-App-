/**
 * Leech detection. A card that keeps getting rated "Again" racks up lapses;
 * once it hits this many it's auto-suspended from review + quiz rotation
 * (matching Anki's default leech threshold) until the user reactivates it.
 */
export const LEECH_LAPSES = 8;

export function isLeech(lapses: number): boolean {
  return lapses >= LEECH_LAPSES;
}
