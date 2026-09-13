import { describe, expect, it } from "vitest";

import { uuidv4 } from "@/lib/uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv4", () => {
  it("produces a valid v4 UUID", () => {
    expect(uuidv4()).toMatch(V4);
  });

  it("is unique across many calls", () => {
    const seen = new Set(Array.from({ length: 500 }, () => uuidv4()));
    expect(seen.size).toBe(500);
  });

  it("works without crypto.randomUUID (insecure LAN context)", () => {
    const orig = globalThis.crypto.randomUUID;
    // @ts-expect-error simulate a context where the browser hides it
    globalThis.crypto.randomUUID = undefined;
    try {
      expect(uuidv4()).toMatch(V4);
    } finally {
      globalThis.crypto.randomUUID = orig;
    }
  });
});
