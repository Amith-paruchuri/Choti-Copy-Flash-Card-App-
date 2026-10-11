import { describe, expect, it } from "vitest";

import {
  checkLimit,
  FEATURE,
  limitsForTier,
  startOfUtcWeek,
  TIER_LIMITS,
  upgradeCopyForFeature,
} from "@/lib/billing/limits";
import { effectiveTier } from "@/lib/billing/tier";

// ── Config ──────────────────────────────────────────────────────────────

describe("limitsForTier", () => {
  it("maps 'pro' and 'trialing' to the same Pro numbers", () => {
    expect(limitsForTier("pro")).toEqual(TIER_LIMITS.pro);
    expect(limitsForTier("trialing")).toEqual(TIER_LIMITS.pro);
  });

  it("maps everything else to Free numbers", () => {
    expect(limitsForTier("free")).toEqual(TIER_LIMITS.free);
    expect(limitsForTier("past_due")).toEqual(TIER_LIMITS.free);
    expect(limitsForTier("canceled")).toEqual(TIER_LIMITS.free);
  });

  it("Pro limits are strictly higher than Free on every numeric field", () => {
    expect(TIER_LIMITS.pro.aiCardsPerDay).toBeGreaterThan(
      TIER_LIMITS.free.aiCardsPerDay,
    );
    expect(TIER_LIMITS.pro.aiMnemonicsPerDay).toBeGreaterThan(
      TIER_LIMITS.free.aiMnemonicsPerDay,
    );
    expect(TIER_LIMITS.pro.aiQuizSetsPerDay).toBeGreaterThan(
      TIER_LIMITS.free.aiQuizSetsPerDay,
    );
    expect(TIER_LIMITS.pro.importMaxBytes).toBeGreaterThan(
      TIER_LIMITS.free.importMaxBytes,
    );
    expect(TIER_LIMITS.pro.importMaxPages).toBeGreaterThan(
      TIER_LIMITS.free.importMaxPages,
    );
    expect(TIER_LIMITS.pro.importsPerWeek).toBeNull(); // uncapped
    expect(TIER_LIMITS.free.importsPerWeek).not.toBeNull();
  });
});

describe("upgradeCopyForFeature", () => {
  it("quotes the real Pro cap for each feature", () => {
    expect(upgradeCopyForFeature(FEATURE.cards)).toBe(
      `Pro gives you ${TIER_LIMITS.pro.aiCardsPerDay} ai-generated cards a day`,
    );
    expect(upgradeCopyForFeature(FEATURE.mnemonics)).toContain(
      String(TIER_LIMITS.pro.aiMnemonicsPerDay),
    );
    expect(upgradeCopyForFeature(FEATURE.quizSets)).toContain(
      String(TIER_LIMITS.pro.aiQuizSetsPerDay),
    );
  });
});

describe("startOfUtcWeek", () => {
  it("a Monday stays on itself, at UTC midnight", () => {
    const monday = new Date("2026-10-12T14:00:00Z"); // a Monday
    expect(startOfUtcWeek(monday).toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
  });

  it("a Sunday rolls back to the PREVIOUS Monday", () => {
    const sunday = new Date("2026-10-18T23:00:00Z"); // the following Sunday
    expect(startOfUtcWeek(sunday).toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
  });

  it("a midweek day rolls back to that week's Monday", () => {
    const thursday = new Date("2026-10-15T09:30:00Z");
    expect(startOfUtcWeek(thursday).toISOString()).toBe(
      "2026-10-12T00:00:00.000Z",
    );
  });
});

// ── Server enforcement (the pure decision behind every check) ────────────

describe("checkLimit", () => {
  it("allows when under the cap", () => {
    expect(checkLimit(5, 30)).toEqual({
      allowed: true,
      used: 5,
      cap: 30,
      remaining: 25,
    });
  });

  it("disallows once at the cap", () => {
    const result = checkLimit(30, 30);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("disallows past the cap, remaining never goes negative", () => {
    const result = checkLimit(45, 30);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("respects a larger requested amount than 1 (clamped-batch generation)", () => {
    // 25 used of 30, asking for 10 more cards — only 5 fit
    const result = checkLimit(25, 30, 10);
    expect(result.allowed).toBe(false); // 10 don't ALL fit
    expect(result.remaining).toBe(5); // but 5 do — caller clamps to this
  });

  it("cap: null (Pro's uncapped weekly imports) is always allowed", () => {
    const result = checkLimit(999, null);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
  });
});

// ── Scenario integration: effectiveTier() -> limitsForTier() ─────────────
// The combination actually used by every call site (mnemonic.ts, quiz.ts,
// the import routes) — not just the two functions in isolation.

describe("free vs Pro vs trial vs expired-trial vs canceled-but-active", () => {
  const NOW = new Date("2026-10-11T12:00:00Z");
  const FUTURE = "2026-10-20T00:00:00Z";
  const PAST = "2026-09-01T00:00:00Z";

  it("a plain free account gets Free limits", () => {
    const tier = effectiveTier(
      { subscriptionTier: "free", trialEndsAt: null, currentPeriodEnd: null },
      NOW,
    );
    expect(limitsForTier(tier)).toEqual(TIER_LIMITS.free);
  });

  it("an active paid subscription gets Pro limits", () => {
    const tier = effectiveTier(
      { subscriptionTier: "pro", trialEndsAt: null, currentPeriodEnd: null },
      NOW,
    );
    expect(limitsForTier(tier)).toEqual(TIER_LIMITS.pro);
  });

  it("an active trial gets Pro limits", () => {
    const tier = effectiveTier(
      { subscriptionTier: "free", trialEndsAt: FUTURE, currentPeriodEnd: null },
      NOW,
    );
    expect(tier).toBe("trialing");
    expect(limitsForTier(tier)).toEqual(TIER_LIMITS.pro);
  });

  it("an EXPIRED trial falls back to Free limits — nothing deleted, just a lower cap", () => {
    const tier = effectiveTier(
      { subscriptionTier: "free", trialEndsAt: PAST, currentPeriodEnd: null },
      NOW,
    );
    expect(tier).toBe("free");
    expect(limitsForTier(tier)).toEqual(TIER_LIMITS.free);
  });

  it("canceled but still inside the paid period gets Pro limits", () => {
    const tier = effectiveTier(
      {
        subscriptionTier: "canceled",
        trialEndsAt: null,
        currentPeriodEnd: FUTURE,
      },
      NOW,
    );
    expect(tier).toBe("pro");
    expect(limitsForTier(tier)).toEqual(TIER_LIMITS.pro);
  });

  it("canceled AND past the paid period falls back to Free limits", () => {
    const tier = effectiveTier(
      {
        subscriptionTier: "canceled",
        trialEndsAt: null,
        currentPeriodEnd: PAST,
      },
      NOW,
    );
    expect(tier).toBe("free");
    expect(limitsForTier(tier)).toEqual(TIER_LIMITS.free);
  });
});
