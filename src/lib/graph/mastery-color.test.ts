import { describe, expect, it } from "vitest";

import { masteryColor, parseColor } from "@/lib/graph/mastery-color";

const STOPS = { low: "#b4472e", mid: "#e6b13c", high: "#3e6b54" };

describe("parseColor", () => {
  it("parses #rrggbb", () => {
    expect(parseColor("#b4472e")).toEqual([180, 71, 46]);
  });
  it("parses #rgb shorthand", () => {
    expect(parseColor("#abc")).toEqual([170, 187, 204]);
  });
  it("parses rgb()/rgba()", () => {
    expect(parseColor("rgb(10, 20, 30)")).toEqual([10, 20, 30]);
    expect(parseColor("rgba(10 20 30 / 0.5)")).toEqual([10, 20, 30]);
  });
});

describe("masteryColor", () => {
  it("hits the exact stops at 0 / 50 / 100", () => {
    expect(masteryColor(0, STOPS)).toBe("rgb(180, 71, 46)");
    expect(masteryColor(50, STOPS)).toBe("rgb(230, 177, 60)");
    expect(masteryColor(100, STOPS)).toBe("rgb(62, 107, 84)");
  });

  it("clamps out-of-range input to the endpoints", () => {
    expect(masteryColor(-20, STOPS)).toBe(masteryColor(0, STOPS));
    expect(masteryColor(140, STOPS)).toBe(masteryColor(100, STOPS));
  });

  it("interpolates continuously between stops", () => {
    // 25% sits halfway between low and mid on each channel.
    expect(masteryColor(25, STOPS)).toBe("rgb(205, 124, 53)");
    // 75% halfway between mid and high.
    expect(masteryColor(75, STOPS)).toBe("rgb(146, 142, 72)");
  });

  it("gives every mastery level a distinct colour (no banding)", () => {
    const seen = new Set(
      [0, 10, 25, 40, 55, 70, 85, 100].map((p) => masteryColor(p, STOPS)),
    );
    expect(seen.size).toBe(8);
  });

  it("blends toward the mid stop as it approaches 50%", () => {
    const near = masteryColor(48, STOPS);
    expect(near).not.toBe(masteryColor(0, STOPS));
    // 48% is much closer to the 50% mid stop than to the 0% low stop.
    const chan = (c: string) => c.match(/\d+/g)!.map(Number);
    const [nr, ng, nb] = chan(near);
    const [mr, mg, mb] = chan(masteryColor(50, STOPS));
    expect(Math.abs(nr - mr) + Math.abs(ng - mg) + Math.abs(nb - mb)).toBeLessThan(
      20,
    );
  });
});
