import { describe, expect, it } from "vitest";

import { applyRating, type CardMemory } from "@/lib/srs/fsrs";
import { explainSchedule, scheduleHeadline } from "@/lib/srs/explain";

const T0 = new Date("2026-01-01T00:00:00Z");

function drill(rating: 1 | 2 | 3 | 4, n: number): CardMemory {
  let memory: CardMemory | null = null;
  let now = T0;
  for (let i = 0; i < n; i += 1) {
    const res = applyRating(memory, rating, now);
    memory = res.memory;
    now = new Date(memory.due);
  }
  return memory as CardMemory;
}

describe("explainSchedule", () => {
  it("calls out a brand-new card", () => {
    expect(explainSchedule(null, T0)).toEqual([
      "New card — you haven’t studied this one yet.",
    ]);
  });

  it("mentions recall estimate and due-ness for a learned card", () => {
    const learned = drill(3, 3);
    const lines = explainSchedule(learned, new Date(learned.due)).join(" ");
    expect(lines).toMatch(/Estimated recall right now: ~\d+%/);
    expect(lines).toMatch(/Due for review today|overdue/);
  });

  it("flags a card pulled in early (not strictly due)", () => {
    const learned = drill(3, 3);
    const early = new Date(new Date(learned.due).getTime() - 5 * 864e5);
    expect(explainSchedule(learned, early).join(" ")).toContain(
      "Not strictly due yet",
    );
  });

  it("notes repeated misses once lapses build up", () => {
    // learn, lapse, relearn to Review, lapse again → lapses >= 2
    let m: CardMemory | null = null;
    let now = T0;
    for (const r of [3, 3, 3, 1, 3, 3, 3, 1] as const) {
      const res = applyRating(m, r, now);
      m = res.memory;
      now = new Date(m.due);
    }
    expect(m!.lapses).toBeGreaterThanOrEqual(2);
    expect(explainSchedule(m, new Date(m!.due)).join(" ")).toMatch(
      /Missed \d+ times/,
    );
  });
});

describe("scheduleHeadline", () => {
  it("is 'New card' before any review", () => {
    expect(scheduleHeadline(null, T0)).toBe("New card");
  });
  it("shows a recall percentage for a seen card", () => {
    const learned = drill(3, 2);
    expect(scheduleHeadline(learned, new Date(learned.due))).toMatch(/~\d+% recall/);
  });
});
