import { describe, expect, it } from "vitest";

import { capsForTier, USAGE_CAPS } from "@/lib/usage/caps";

describe("capsForTier", () => {
  it("gives free-tier users the free caps", () => {
    expect(capsForTier("free")).toEqual(USAGE_CAPS.free);
  });

  it("gives pro and trialing the pro caps", () => {
    expect(capsForTier("pro")).toEqual(USAGE_CAPS.pro);
    expect(capsForTier("trialing")).toEqual(USAGE_CAPS.pro);
  });

  it("falls back past_due/canceled to the free caps", () => {
    expect(capsForTier("past_due")).toEqual(USAGE_CAPS.free);
    expect(capsForTier("canceled")).toEqual(USAGE_CAPS.free);
  });

  it("defaults an unrecognized value to the free caps", () => {
    expect(capsForTier("something-new")).toEqual(USAGE_CAPS.free);
  });
});
