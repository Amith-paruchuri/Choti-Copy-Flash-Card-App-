import { describe, expect, it } from "vitest";

import { projectRecall } from "@/lib/srs/fsrs";
import { buildForgettingCurve, median } from "@/lib/srs/forgetting";

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("projectRecall", () => {
  it("is ~1 right after review and decays monotonically", () => {
    expect(projectRecall(10, 0)).toBeCloseTo(1, 2);
    expect(projectRecall(10, 30)).toBeLessThan(projectRecall(10, 10));
    expect(projectRecall(10, 200)).toBeLessThan(projectRecall(10, 30));
    expect(projectRecall(10, 200)).toBeLessThan(0.8);
  });

  it("crosses ~90% near t = stability (that's what stability means)", () => {
    expect(projectRecall(10, 10)).toBeGreaterThan(0.87);
    expect(projectRecall(10, 10)).toBeLessThan(0.93);
  });

  it("larger stability = slower forgetting", () => {
    expect(projectRecall(30, 15)).toBeGreaterThan(projectRecall(5, 15));
  });
});

describe("buildForgettingCurve", () => {
  const reviews = [
    // same-day / learning-step reviews are excluded
    { elapsedDays: 0, recalled: true },
    { elapsedDays: 0.5, recalled: false },
    // 1d bucket — 4 reviews, 3 recalled
    ...Array.from({ length: 3 }, () => ({ elapsedDays: 1, recalled: true })),
    { elapsedDays: 1, recalled: false },
    // 1wk bucket — 5 reviews, 2 recalled
    ...Array.from({ length: 2 }, () => ({ elapsedDays: 9, recalled: true })),
    ...Array.from({ length: 3 }, () => ({ elapsedDays: 9, recalled: false })),
    // 2 reviews in the 2–3d bucket — below MIN_BIN_SAMPLE, dropped
    { elapsedDays: 2, recalled: true },
    { elapsedDays: 3, recalled: true },
  ];

  it("bins by days-since-review and keeps only buckets with enough data", () => {
    const c = buildForgettingCurve(reviews, [8, 12, 10]);
    expect(c.sample).toBe(11); // 13 total − 2 same-day
    const labels = c.bins.map((b) => b.label);
    expect(labels).toEqual(["1d", "1wk"]);
    expect(c.bins[0].rate).toBeCloseTo(0.75); // 3/4
    expect(c.bins[1].rate).toBeCloseTo(0.4); // 2/5
  });

  it("builds a model curve from the median stability", () => {
    const c = buildForgettingCurve(reviews, [8, 12, 10]);
    expect(c.medianStability).toBe(10);
    expect(c.model[0].recall).toBeCloseTo(1, 2);
    expect(c.model.at(-1)!.recall).toBeLessThan(c.model[0].recall);
    expect(c.intervalAt90).toBeGreaterThan(5);
    expect(c.intervalAt90).toBeLessThan(20);
  });

  it("falls back to a floor stability when there's no data", () => {
    const c = buildForgettingCurve([], []);
    expect(c.bins).toHaveLength(0);
    expect(c.medianStability).toBeGreaterThan(0);
    expect(c.model.length).toBeGreaterThan(0);
  });
});
