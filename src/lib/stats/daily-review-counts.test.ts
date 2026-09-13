import { describe, expect, it } from "vitest";

import {
  autoWindow,
  dailyReviewCounts,
  type DailyCount,
} from "@/lib/stats/daily-review-counts";
import type { HeatmapDay } from "@/lib/queries/activity";

function mkWeeks(days: (HeatmapDay | null)[]): { weeks: (HeatmapDay | null)[][] } {
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return { weeks };
}

describe("dailyReviewCounts", () => {
  it("flattens the week grid in chronological order", () => {
    const days: HeatmapDay[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      count: i,
    }));
    const out = dailyReviewCounts(mkWeeks(days), 30);
    expect(out).toHaveLength(14);
    expect(out[0].date).toBe("2026-09-01");
    expect(out[13].date).toBe("2026-09-14");
  });

  it("drops trailing null cells (future days in the current week)", () => {
    const days: (HeatmapDay | null)[] = [
      { date: "2026-09-01", count: 3 },
      { date: "2026-09-02", count: 0 },
      null,
      null,
    ];
    const out = dailyReviewCounts(mkWeeks(days), 30);
    expect(out).toEqual([
      { date: "2026-09-01", count: 3 },
      { date: "2026-09-02", count: 0 },
    ]);
  });

  it("takes only the trailing N days when the grid is wider", () => {
    const days: HeatmapDay[] = Array.from({ length: 40 }, (_, i) => ({
      date: `day-${i}`,
      count: i,
    }));
    const out = dailyReviewCounts(mkWeeks(days), 30);
    expect(out).toHaveLength(30);
    expect(out[0].date).toBe("day-10");
    expect(out[29].date).toBe("day-39");
  });

  it("returns an empty array for an all-future (empty) grid", () => {
    const out = dailyReviewCounts(mkWeeks([null, null, null]), 30);
    expect(out).toEqual([]);
  });
});

function series(counts: number[]): DailyCount[] {
  return counts.map((count, i) => ({ date: `day-${i}`, count }));
}

describe("autoWindow", () => {
  it("defaults to 7 when activity goes back further than a week", () => {
    // 90 days of history, active throughout — plenty older than 7 days.
    const s = series(Array.from({ length: 90 }, () => 1));
    expect(autoWindow(s)).toBe(7);
  });

  it("trims to since-first-activity when that's more recent than 7 days ago", () => {
    // 90 days of zeros, then activity starting 3 days ago (last 3 entries).
    const s = series([...Array(87).fill(0), 5, 2, 1]);
    expect(autoWindow(s)).toBe(3);
  });

  it("shows just today when activity started today", () => {
    const s = series([...Array(89).fill(0), 4]);
    expect(autoWindow(s)).toBe(1);
  });

  it("falls back to a 7-day (or shorter) window when there's no activity at all", () => {
    expect(autoWindow(series(Array(90).fill(0)))).toBe(7);
    expect(autoWindow(series(Array(3).fill(0)))).toBe(3);
  });
});
