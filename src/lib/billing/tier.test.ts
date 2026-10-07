import { describe, expect, it } from "vitest";

import { canStartTrial, effectiveTier, trialDaysRemaining } from "@/lib/billing/tier";

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

describe("canStartTrial", () => {
  it("is eligible with no trial on record and not pro", () => {
    expect(canStartTrial({ tier: "free", trialEndsAt: null })).toBe(true);
  });

  it("is never eligible once a trial has been started, active or lapsed", () => {
    expect(canStartTrial({ tier: "trialing", trialEndsAt: FUTURE })).toBe(
      false,
    );
    expect(canStartTrial({ tier: "free", trialEndsAt: PAST })).toBe(false);
  });

  it("is never eligible once on a real paid subscription", () => {
    expect(canStartTrial({ tier: "pro", trialEndsAt: null })).toBe(false);
  });
});

describe("trialDaysRemaining", () => {
  it("counts whole days left, rounding up", () => {
    // 12.5 days out — should read as 13 days left, not 12
    const end = new Date(NOW.getTime() + 12.5 * 864e5).toISOString();
    expect(trialDaysRemaining(end, NOW)).toBe(13);
  });

  it("is 0 once lapsed, never negative", () => {
    expect(trialDaysRemaining(PAST, NOW)).toBe(0);
  });

  it("is null with no trial on record", () => {
    expect(trialDaysRemaining(null, NOW)).toBeNull();
  });
});
