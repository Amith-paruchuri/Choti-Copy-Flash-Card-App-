import { describe, expect, it } from "vitest";

import {
  extractEmailDomain,
  isBlockedEmailDomain,
} from "@/lib/auth/blocked-email-domains";

describe("extractEmailDomain", () => {
  it("returns the lowercased domain after the last @", () => {
    expect(extractEmailDomain("User@Example.COM")).toBe("example.com");
  });

  it("uses the LAST @, not the first", () => {
    expect(extractEmailDomain('"a@b"@example.com')).toBe("example.com");
  });

  it("returns null with no @ at all", () => {
    expect(extractEmailDomain("not-an-email")).toBeNull();
  });

  it("returns null when @ is the last character", () => {
    expect(extractEmailDomain("user@")).toBeNull();
  });
});

describe("isBlockedEmailDomain", () => {
  it("blocks every seeded disposable/placeholder domain, case-insensitively", () => {
    expect(isBlockedEmailDomain("test@mailinator.com")).toBe(true);
    expect(isBlockedEmailDomain("a@Example.com")).toBe(true);
    expect(isBlockedEmailDomain("a@GUERRILLAMAIL.COM")).toBe(true);
    expect(isBlockedEmailDomain("a@yopmail.fr")).toBe(true);
  });

  it("allows real-looking domains", () => {
    expect(isBlockedEmailDomain("student@gmail.com")).toBe(false);
    expect(isBlockedEmailDomain("researcher@university.edu")).toBe(false);
    expect(isBlockedEmailDomain("me@choti.app")).toBe(false);
  });

  it("doesn't false-positive on a blocked domain as a SUBSTRING of a real one", () => {
    // e.g. "notmailinator.com" or "mailinator.com.co" must not match "mailinator.com"
    expect(isBlockedEmailDomain("a@notmailinator.com")).toBe(false);
    expect(isBlockedEmailDomain("a@mailinator.com.co")).toBe(false);
  });

  it("is false for malformed input rather than throwing", () => {
    expect(isBlockedEmailDomain("not-an-email")).toBe(false);
    expect(isBlockedEmailDomain("")).toBe(false);
  });
});
