import { describe, expect, it } from "vitest";

import {
  applyRating,
  isDue,
  projectIntervals,
  ratingForQuiz,
  retrievability,
  State,
  type CardMemory,
} from "@/lib/srs/fsrs";

const T0 = new Date("2026-01-01T00:00:00Z");

/** Rate a fresh card `n` times with `rating`, stepping time to each due date. */
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

describe("applyRating", () => {
  it("treats a null memory as a brand-new card", () => {
    const { memory, log } = applyRating(null, 3, T0);
    expect(memory.reps).toBe(1);
    expect(log.state).toBe(State.New);
    expect(new Date(memory.due).getTime()).toBeGreaterThan(T0.getTime());
  });

  it("Again on a learned card drops stability and counts a lapse", () => {
    const learned = drill(3, 3);
    const relapsed = applyRating(learned, 1, new Date(learned.due)).memory;
    expect(relapsed.stability).toBeLessThan(learned.stability);
    expect(relapsed.lapses).toBe(learned.lapses + 1);
    expect(relapsed.state).toBe(State.Relearning);
  });

  it("Easy schedules further out than Good", () => {
    const learned = drill(3, 2);
    const at = new Date(learned.due);
    const good = applyRating(learned, 3, at).memory;
    const easy = applyRating(learned, 4, at).memory;
    expect(new Date(easy.due).getTime()).toBeGreaterThan(
      new Date(good.due).getTime(),
    );
  });
});

describe("retrievability", () => {
  it("is 0 for an unseen card and decays with elapsed time", () => {
    expect(retrievability(null, T0)).toBe(0);
    const learned = drill(3, 3);
    const onDue = retrievability(learned, new Date(learned.due));
    const muchLater = retrievability(
      learned,
      new Date(new Date(learned.due).getTime() + 120 * 864e5),
    );
    expect(onDue).toBeGreaterThan(0.7);
    expect(muchLater).toBeLessThan(onDue);
  });
});

describe("ratingForQuiz", () => {
  it("maps correct → Good (3) and wrong → Again (1)", () => {
    expect(ratingForQuiz(true)).toBe(3);
    expect(ratingForQuiz(false)).toBe(1);
  });
});

describe("isDue", () => {
  it("is always true for a new card", () => {
    expect(isDue(null)).toBe(true);
  });
  it("compares the stored due date against now", () => {
    const learned = drill(3, 2);
    expect(isDue(learned, new Date(new Date(learned.due).getTime() - 1000))).toBe(
      false,
    );
    expect(isDue(learned, new Date(new Date(learned.due).getTime() + 1000))).toBe(
      true,
    );
  });
});

describe("projectIntervals", () => {
  it("returns an ascending-ish set of labels for the four buttons", () => {
    const labels = projectIntervals(drill(3, 3));
    expect(labels[1]).toMatch(/[mhd]/);
    expect(labels[4]).toMatch(/(d|mo|y)/);
    // Again is the soonest of the four
    expect(labels[1]).not.toEqual(labels[4]);
  });
});
