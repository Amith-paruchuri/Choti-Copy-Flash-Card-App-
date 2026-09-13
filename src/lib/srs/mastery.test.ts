import { describe, expect, it } from "vitest";

import type { CardMemory } from "@/lib/srs/fsrs";
import {
  LAPSE_PENALTY,
  STABILITY_CEIL,
  masteryPct,
} from "@/lib/srs/mastery";

const mem = (over: Partial<CardMemory>): CardMemory => ({
  state: 2,
  due: "2026-01-01T00:00:00.000Z",
  stability: 10,
  difficulty: 5,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 3,
  lapses: 0,
  last_review: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("masteryPct", () => {
  it("is null for a New / never-reviewed card", () => {
    expect(masteryPct(null)).toBeNull();
    expect(masteryPct(mem({ reps: 0 }))).toBeNull();
  });

  it("reaches 100 at the stability ceiling and stays capped above it", () => {
    expect(masteryPct(mem({ stability: STABILITY_CEIL }))).toBe(100);
    expect(masteryPct(mem({ stability: STABILITY_CEIL * 3 }))).toBe(100);
  });

  it("uses a sqrt curve — a quarter of the ceiling is ~half the score", () => {
    expect(masteryPct(mem({ stability: STABILITY_CEIL / 4 }))).toBe(50);
  });

  it("rises as stability compounds", () => {
    const a = masteryPct(mem({ stability: 3 }))!;
    const b = masteryPct(mem({ stability: 16 }))!;
    const c = masteryPct(mem({ stability: 68 }))!;
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("subtracts a fixed penalty per lapse", () => {
    const clean = masteryPct(mem({ stability: 60, lapses: 0 }))!;
    const one = masteryPct(mem({ stability: 60, lapses: 1 }))!;
    expect(clean - one).toBe(LAPSE_PENALTY);
  });

  it("caps the lapse penalty so a recovered card isn't buried", () => {
    const three = masteryPct(mem({ stability: 75, lapses: 3 }))!;
    const eight = masteryPct(mem({ stability: 75, lapses: 8 }))!;
    expect(three).toBe(100 - 36);
    expect(eight).toBe(100 - 40); // capped, not 100 - 96
  });

  it("never leaves 0–100", () => {
    expect(masteryPct(mem({ stability: 1, lapses: 9 }))).toBe(0);
    expect(masteryPct(mem({ stability: 0, lapses: 0 }))).toBe(0);
  });
});
