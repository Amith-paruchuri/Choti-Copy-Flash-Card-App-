import { describe, expect, it } from "vitest";

import { newCardBudget, suggestedSessionSize } from "@/lib/srs/pacing";

describe("newCardBudget", () => {
  it("front-loads ~⅓ of the session as new when the day has room", () => {
    expect(newCardBudget(20, 50)).toEqual({ soft: 7, hard: 20 });
  });

  it("never exceeds the day's remaining allowance", () => {
    expect(newCardBudget(20, 5)).toEqual({ soft: 5, hard: 5 });
    expect(newCardBudget(30, 3)).toEqual({ soft: 3, hard: 3 });
  });

  it("shows zero new cards once the daily cap is spent", () => {
    expect(newCardBudget(20, 0)).toEqual({ soft: 0, hard: 0 });
    expect(newCardBudget(20, -4)).toEqual({ soft: 0, hard: 0 }); // over-introduced
  });

  it("always offers at least one new card on a tiny session when allowed", () => {
    expect(newCardBudget(1, 10)).toEqual({ soft: 1, hard: 1 });
    expect(newCardBudget(2, 10)).toEqual({ soft: 1, hard: 2 });
  });
});

describe("suggestedSessionSize", () => {
  it("with no goal, offers up to 20 bounded by what's available", () => {
    expect(
      suggestedSessionSize({ target: null, reviewedToday: 0, availableToday: 8 }),
    ).toBe(8);
    expect(
      suggestedSessionSize({ target: null, reviewedToday: 0, availableToday: 99 }),
    ).toBe(20);
    expect(
      suggestedSessionSize({ target: null, reviewedToday: 0, availableToday: 0 }),
    ).toBe(20); // review-ahead
  });

  it("with an unmet goal, aims for the shortfall", () => {
    expect(
      suggestedSessionSize({ target: 30, reviewedToday: 18, availableToday: 50 }),
    ).toBe(12);
  });

  it("with the goal met, drops back to a small review-ahead session", () => {
    expect(
      suggestedSessionSize({ target: 30, reviewedToday: 30, availableToday: 40 }),
    ).toBe(20);
    expect(
      suggestedSessionSize({ target: 30, reviewedToday: 45, availableToday: 3 }),
    ).toBe(3);
  });

  it("never returns less than 1", () => {
    expect(
      suggestedSessionSize({ target: 10, reviewedToday: 10, availableToday: 0 }),
    ).toBe(20);
    expect(
      suggestedSessionSize({ target: 10, reviewedToday: 9, availableToday: 0 }),
    ).toBe(1);
  });
});
