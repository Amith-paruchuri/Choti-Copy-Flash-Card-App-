import { describe, expect, it } from "vitest";

import { chunkText } from "@/lib/import/chunk";
import { looksLikeWhatsappChat, parseWhatsappChat } from "@/lib/import/whatsapp";
import {
  generatedCardsSchema,
  pathSuggestionsSchema,
} from "@/lib/validation";

describe("chunkText", () => {
  it("keeps short text as a single chunk", () => {
    const { chunks, truncated } = chunkText("one\n\ntwo", 100, 1000);
    expect(chunks).toEqual(["one\n\ntwo"]);
    expect(truncated).toBe(false);
  });

  it("splits on paragraph boundaries near the size limit", () => {
    const para = "x".repeat(60);
    const { chunks } = chunkText(`${para}\n\n${para}\n\n${para}`, 130, 10_000);
    expect(chunks.length).toBe(2);
  });

  it("hard-splits a paragraph longer than the chunk size", () => {
    const { chunks } = chunkText("y".repeat(250), 100, 10_000);
    expect(chunks.length).toBe(3);
  });

  it("flags truncation past the max", () => {
    const { truncated } = chunkText("z".repeat(500), 100, 200);
    expect(truncated).toBe(true);
  });
});

describe("parseWhatsappChat", () => {
  it("parses iOS-style lines and drops media + system notices", () => {
    const txt = [
      "[15/01/2024, 9:30:12 AM] Messages and calls are end-to-end encrypted.",
      "[15/01/2024, 9:31:00 AM] Alice: what's the answer to Q3",
      "[15/01/2024, 9:32:10 AM] Bob: it's the chain rule",
      "you differentiate outer then inner",
      "[15/01/2024, 9:33:00 AM] Alice: image omitted",
    ].join("\n");

    const { transcript, messageCount } = parseWhatsappChat(txt);
    expect(messageCount).toBe(2);
    expect(transcript).toContain("Alice: what's the answer to Q3");
    expect(transcript).toContain("Bob: it's the chain rule\nyou differentiate");
    expect(transcript).not.toContain("end-to-end encrypted");
    expect(transcript).not.toContain("image omitted");
  });

  it("parses Android-style dash lines", () => {
    const txt = "15/01/2024, 09:31 - Alice: hello there";
    const { messageCount, transcript } = parseWhatsappChat(txt);
    expect(messageCount).toBe(1);
    expect(transcript).toBe("Alice: hello there");
  });
});

describe("looksLikeWhatsappChat", () => {
  it("is true for a real-looking export", () => {
    const txt = Array.from(
      { length: 5 },
      (_, i) => `[15/01/2024, 9:0${i}:00 AM] Alice: msg ${i}`,
    ).join("\n");
    expect(looksLikeWhatsappChat(txt)).toBe(true);
  });

  it("is false for plain notes", () => {
    expect(
      looksLikeWhatsappChat("Newton's laws\n\n1. Inertia\n2. F = ma\n"),
    ).toBe(false);
  });
});

describe("generatedCardsSchema", () => {
  it("keeps a specific path + subject as-is", () => {
    const parsed = generatedCardsSchema.parse({
      cards: [
        {
          title: "Fanconi syndrome",
          subtitle: "generalised proximal tubule dysfunction",
          content: "…",
          subject: "Renal tubulopathies",
          path: ["Medicine", "Nephrology", "Renal tubulopathies"],
        },
      ],
    });
    expect(parsed.cards[0].subject).toBe("Renal tubulopathies");
    expect(parsed.cards[0].path).toEqual([
      "Medicine",
      "Nephrology",
      "Renal tubulopathies",
    ]);
  });

  it("promotes a broad leaf to the most specific path segment", () => {
    const parsed = generatedCardsSchema.parse({
      cards: [
        {
          title: "Countercurrent multiplier",
          subtitle: "loop of Henle",
          content: "…",
          subject: "Biology",
          path: ["Biology", "Nephrology", "Loop of Henle"],
        },
      ],
    });
    expect(parsed.cards[0].subject).toBe("Loop of Henle");
    expect(parsed.cards[0].path).toEqual([
      "Biology",
      "Nephrology",
      "Loop of Henle",
    ]);
  });

  it("drops a trailing umbrella segment and appends the real subject", () => {
    const parsed = generatedCardsSchema.parse({
      cards: [
        {
          title: "x",
          content: "body",
          subject: "Beta-oxidation",
          path: ["Biochemistry", "Biology"],
        },
      ],
    });
    expect(parsed.cards[0].path).toEqual(["Biochemistry", "Beta-oxidation"]);
  });

  it("recovers from missing subtitle / subject / path", () => {
    const parsed = generatedCardsSchema.parse({
      cards: [{ title: "t".repeat(400), content: "body" }],
    });
    expect(parsed.cards[0].subtitle).toBe("");
    expect(parsed.cards[0].subject).toBe("Imported");
    expect(parsed.cards[0].path).toEqual(["Imported"]);
    expect(parsed.cards[0].title.length).toBeLessThanOrEqual(120 + 20);
  });

  it("rejects a non-array payload", () => {
    expect(generatedCardsSchema.safeParse({ cards: "nope" }).success).toBe(false);
  });
});

describe("pathSuggestionsSchema (re-sort placements)", () => {
  it("keeps a broad→specific path and pairs it with its id", () => {
    const parsed = pathSuggestionsSchema.parse({
      assignments: [
        { id: "card-1", path: ["Nephrology", "Renin regulation"] },
      ],
    });
    expect(parsed.assignments[0]).toEqual({
      id: "card-1",
      path: ["Nephrology", "Renin regulation"],
    });
  });

  it("strips whole-discipline segments but never empties the path", () => {
    const parsed = pathSuggestionsSchema.parse({
      assignments: [
        { id: "a", path: ["Biology", "Nephrology", "Loop of Henle"] },
        { id: "b", path: ["Medicine", "Biology"] },
      ],
    });
    expect(parsed.assignments[0].path).toEqual(["Nephrology", "Loop of Henle"]);
    expect(parsed.assignments[1].path).toEqual(["Biology"]);
  });

  it("trims and drops blank segments", () => {
    const parsed = pathSuggestionsSchema.parse({
      assignments: [{ id: "c", path: ["  Pulmonology ", "  ", "Spirometry"] }],
    });
    expect(parsed.assignments[0].path).toEqual(["Pulmonology", "Spirometry"]);
  });
});
