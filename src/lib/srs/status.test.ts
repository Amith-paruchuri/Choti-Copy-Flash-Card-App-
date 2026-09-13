import { describe, expect, it } from "vitest";

import { applyRating, type CardMemory } from "@/lib/srs/fsrs";
import { statusColor, statusOf } from "@/lib/srs/status";

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

describe("statusOf", () => {
  it("is 'new' before any review", () => {
    expect(statusOf(null, T0)).toBe("new");
    expect(statusOf({ ...drill(3, 1), reps: 0 }, T0)).toBe("new");
  });

  it("is 'struggling' after repeated lapses", () => {
    let m: CardMemory | null = null;
    let now = T0;
    for (const r of [3, 3, 3, 1, 3, 3, 1] as const) {
      const res = applyRating(m, r, now);
      m = res.memory;
      now = new Date(m.due);
    }
    expect(statusOf(m, new Date(m!.due))).toBe("struggling");
  });

  it("reaches 'mastered' once stability is high with no lapses", () => {
    const m = drill(4, 6); // many Easy reviews → high stability
    expect(statusOf(m, new Date(m.due))).toBe("mastered");
  });
});

describe("statusColor", () => {
  it("maps each status to a distinct token", () => {
    const tokens = (["new", "learning", "struggling", "mastered"] as const).map(
      statusColor,
    );
    expect(new Set(tokens).size).toBe(4);
    expect(statusColor("mastered")).toContain("sage");
    expect(statusColor("struggling")).toContain("clay");
  });
});
