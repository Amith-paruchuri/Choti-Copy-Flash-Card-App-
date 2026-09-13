import { describe, expect, it } from "vitest";

import {
  MAX_NODE_ALPHA,
  MAX_NODE_R,
  MIN_NODE_ALPHA,
  MIN_NODE_R,
  reviewChannels,
} from "@/lib/graph/node-size";

describe("reviewChannels", () => {
  it("puts zero-review cards at the floor of both channels", () => {
    const c = reviewChannels([0, 2, 5, 40]);
    expect(c.radius(0)).toBe(MIN_NODE_R);
    expect(c.opacity(0)).toBe(MIN_NODE_ALPHA);
    expect(c.t(0)).toBe(0);
  });

  it("puts the most-reviewed card at the ceiling of both channels", () => {
    const c = reviewChannels([0, 1, 3, 7]);
    expect(c.radius(7)).toBeCloseTo(MAX_NODE_R);
    expect(c.opacity(7)).toBeCloseTo(MAX_NODE_ALPHA);
    expect(c.t(7)).toBeCloseTo(1);
  });

  it("keeps the whole small range distinguishable — 3 and 7 are NOT the same size", () => {
    // the exact case that was collapsing under p90 + hard clamp
    const c = reviewChannels([0, 1, 1, 2, 2, 3, 3, 4, 6, 7]);
    const r3 = c.radius(3);
    const r7 = c.radius(7);
    expect(r7 - r3).toBeGreaterThan(3); // clearly different radii
    expect(r3).toBeLessThan(MAX_NODE_R - 1);
    // monotonic across every count present
    for (const [a, b] of [
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 6],
      [6, 7],
    ]) {
      expect(c.radius(a)).toBeLessThan(c.radius(b));
      expect(c.opacity(a)).toBeLessThan(c.opacity(b));
    }
  });

  it("is log-shaped and outlier-resistant — a 300× card doesn't flatten a 30× card", () => {
    const c = reviewChannels([0, 5, 12, 30, 300]);
    // log1p(30)/log1p(300) ≈ 0.60 → still well up the range
    expect(c.t(30)).toBeGreaterThan(0.5);
    expect(c.radius(30)).toBeGreaterThan(
      MIN_NODE_R + (MAX_NODE_R - MIN_NODE_R) * 0.5,
    );
    expect(c.radius(300)).toBeCloseTo(MAX_NODE_R);
  });

  it("size and opacity move together (same underlying t)", () => {
    const c = reviewChannels([0, 2, 5, 20]);
    for (const a of [0, 1, 3, 8, 20]) {
      const t = c.t(a);
      expect(c.radius(a)).toBeCloseTo(
        MIN_NODE_R + (MAX_NODE_R - MIN_NODE_R) * t,
      );
      expect(c.opacity(a)).toBeCloseTo(
        MIN_NODE_ALPHA + (MAX_NODE_ALPHA - MIN_NODE_ALPHA) * t,
      );
    }
  });

  it("handles an all-unreviewed graph without NaN", () => {
    const c = reviewChannels([0, 0, 0]);
    expect(c.radius(0)).toBe(MIN_NODE_R);
    expect(c.opacity(0)).toBe(MIN_NODE_ALPHA);
    expect(Number.isNaN(c.radius(0))).toBe(false);
  });

  it("handles an empty graph", () => {
    const c = reviewChannels([]);
    expect(c.radius(0)).toBe(MIN_NODE_R);
    expect(c.t(5)).toBe(0);
  });
});
