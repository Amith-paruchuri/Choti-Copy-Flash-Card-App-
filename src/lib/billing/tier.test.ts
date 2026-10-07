import { describe, expect, it } from "vitest";

import { effectiveTier } from "@/lib/billing/tier";

const NOW = new Date("2026-10-07T12:00:00Z");
const FUTURE = "2026-10-20T00:00:00Z";
const PAST = "2026-09-01T00:00:00Z";

describe("effectiveTier", () => {
  it("is trialing while trial_ends_at is in the future", () => {
    expect(
      effectiveTier({ subscriptionTier: "free", trialEndsAt: FUTURE }, NOW),
    ).toBe("trialing");
  });

  it("falls back to free once the trial has lapsed", () => {
    expect(
      effectiveTier({ subscriptionTier: "free", trialEndsAt: PAST }, NOW),
    ).toBe("free");
  });

  it("is free with no trial set at all", () => {
    expect(
      effectiveTier({ subscriptionTier: "free", trialEndsAt: null }, NOW),
    ).toBe("free");
  });

  it("an active pro subscription always wins, trial or not", () => {
    expect(
      effectiveTier({ subscriptionTier: "pro", trialEndsAt: PAST }, NOW),
    ).toBe("pro");
    expect(
      effectiveTier({ subscriptionTier: "pro", trialEndsAt: FUTURE }, NOW),
    ).toBe("pro");
    expect(
      effectiveTier({ subscriptionTier: "pro", trialEndsAt: null }, NOW),
    ).toBe("pro");
  });

  it("past_due/canceled fall back to trial check, then free", () => {
    expect(
      effectiveTier(
        { subscriptionTier: "past_due", trialEndsAt: FUTURE },
        NOW,
      ),
    ).toBe("trialing");
    expect(
      effectiveTier({ subscriptionTier: "canceled", trialEndsAt: PAST }, NOW),
    ).toBe("free");
  });
});
