/**
 * Concept-map "review frequency" visual channels. How often a card has been
 * reviewed (review + quiz attempts) drives BOTH node radius AND fill opacity,
 * so the two reinforce each other: a heavily-drilled card is big and bold, a
 * barely-seen one is small and faint.
 *
 * Normalised against the *most-reviewed card in the current graph* on a
 * `log1p` curve (recomputed every load). log1p is naturally bounded and
 * outlier-resistant — one card reviewed 300× still leaves a card reviewed 30×
 * clearly distinguishable — so no hard clamp is needed and the whole real
 * range stays legible whether the busiest card has 3 reviews or 300.
 * Zero-review (New) cards sit at the floor of both channels so they stay
 * visible and clickable.
 */

export const MIN_NODE_R = 5;
export const MAX_NODE_R = 20;
export const MIN_NODE_ALPHA = 0.4;
export const MAX_NODE_ALPHA = 1;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export interface ReviewChannels {
  /** node radius, px */
  radius: (attempts: number) => number;
  /** fill opacity, 0–1 */
  opacity: (attempts: number) => number;
  /** the shared 0–1 position on the log1p curve (exposed for tests / reuse) */
  t: (attempts: number) => number;
}

/**
 * Build the radius + opacity functions for one graph from the attempt counts
 * of every node it contains.
 */
export function reviewChannels(
  attempts: number[],
  opts: {
    minR?: number;
    maxR?: number;
    minAlpha?: number;
    maxAlpha?: number;
  } = {},
): ReviewChannels {
  const {
    minR = MIN_NODE_R,
    maxR = MAX_NODE_R,
    minAlpha = MIN_NODE_ALPHA,
    maxAlpha = MAX_NODE_ALPHA,
  } = opts;

  const peak = attempts.length > 0 ? Math.max(0, ...attempts) : 0;
  const denom = Math.log1p(peak);

  const t = (a: number) =>
    denom > 0 ? clamp(Math.log1p(Math.max(0, a)) / denom, 0, 1) : 0;

  return {
    t,
    radius: (a) => lerp(minR, maxR, t(a)),
    opacity: (a) => lerp(minAlpha, maxAlpha, t(a)),
  };
}
