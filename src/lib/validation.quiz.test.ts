import { describe, expect, it } from "vitest";

import { generatedQuizItemSchema } from "@/lib/validation";

const base = {
  id: "card-1",
  format: "mcq",
  question: "Which enzyme is deficient in classic PKU?",
  options: [
    "Phenylalanine hydroxylase",
    "Tyrosine hydroxylase",
    "Tryptophan hydroxylase",
    "Dihydropteridine reductase",
  ],
  answer: "Phenylalanine hydroxylase",
  explanation: "Classic PKU is a PAH defect.",
};

describe("generatedQuizItemSchema", () => {
  it("keeps a well-formed MCQ intact", () => {
    const q = generatedQuizItemSchema.parse(base);
    expect(q.options).toHaveLength(4);
    expect(q.options).toContain(q.answer);
    expect(q.format).toBe("mcq");
  });

  it("matches the answer case-insensitively", () => {
    const q = generatedQuizItemSchema.parse({
      ...base,
      answer: "phenylalanine HYDROXYLASE",
    });
    expect(q.answer).toBe("Phenylalanine hydroxylase");
  });

  it("injects the answer when it's missing from the options", () => {
    const q = generatedQuizItemSchema.parse({
      ...base,
      options: base.options.slice(1), // drop the correct one
    });
    expect(q.options).toContain("Phenylalanine hydroxylase");
    expect(q.options.length).toBeLessThanOrEqual(4);
  });

  it("dedupes options case-insensitively and caps at 4", () => {
    const q = generatedQuizItemSchema.parse({
      ...base,
      options: [
        "Phenylalanine hydroxylase",
        "phenylalanine hydroxylase",
        "Tyrosine hydroxylase",
        "Tryptophan hydroxylase",
        "Dihydropteridine reductase",
      ],
    });
    expect(q.options).toHaveLength(4);
    expect(
      q.options.filter((o) => o.toLowerCase() === "phenylalanine hydroxylase"),
    ).toHaveLength(1);
  });

  it("defaults an unknown format to mcq", () => {
    const q = generatedQuizItemSchema.parse({ ...base, format: "essay" });
    expect(q.format).toBe("mcq");
  });

  it("accepts a blank with a gapped sentence", () => {
    const q = generatedQuizItemSchema.parse({
      ...base,
      format: "blank",
      question: "Classic PKU results from a defect in ____.",
    });
    expect(q.format).toBe("blank");
    expect(q.question).toContain("____");
  });

  it("rejects an item that can't be salvaged into 2+ options", () => {
    const bad = generatedQuizItemSchema.safeParse({
      ...base,
      options: [],
      answer: "only one",
    });
    expect(bad.success).toBe(false);
  });
});
