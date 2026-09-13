import { describe, expect, it } from "vitest";

import { dueSummary } from "@/lib/review-copy";

describe("dueSummary", () => {
  it("splits overdue from newly-due", () => {
    expect(dueSummary({ dueToday: 5, overdue: 8 })).toBe(
      "5 due today · 8 overdue",
    );
  });

  it("appends the available new-card count when there is one", () => {
    expect(dueSummary({ dueToday: 5, overdue: 8 }, 12)).toBe(
      "5 due today · 8 overdue · 12 new",
    );
  });

  it("drops the zero side", () => {
    expect(dueSummary({ dueToday: 0, overdue: 8 })).toBe("8 overdue");
    expect(dueSummary({ dueToday: 5, overdue: 0 })).toBe("5 due today");
    expect(dueSummary({ dueToday: 0, overdue: 0 }, 3)).toBe("3 new");
  });

  it("says so when there's nothing", () => {
    expect(dueSummary({ dueToday: 0, overdue: 0 })).toBe("all caught up");
    expect(dueSummary({ dueToday: 0, overdue: 0 }, 0)).toBe("all caught up");
  });
});
