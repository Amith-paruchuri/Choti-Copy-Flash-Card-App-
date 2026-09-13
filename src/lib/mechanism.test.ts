import { describe, expect, it } from "vitest";

import { parseMechanism } from "@/lib/mechanism";

describe("parseMechanism", () => {
  it("splits a causal chain with 'which' + 'leading to' + participle", () => {
    const nodes = parseMechanism(
      "Licorice contains glycyrrhetinic acid, which inhibits 11β-HSD2, leading to Apparent Mineralocorticoid Excess, mimicking hyperaldosteronism",
    );
    expect(nodes).toEqual([
      "Licorice contains glycyrrhetinic acid",
      "inhibits 11β-HSD2",
      "Apparent Mineralocorticoid Excess",
      "mimicking hyperaldosteronism",
    ]);
  });

  it("splits explicit arrows", () => {
    expect(parseMechanism("Hypoxia -> HIF-1α stabilisation -> EPO -> erythrocytosis")).toEqual([
      "Hypoxia",
      "HIF-1α stabilisation",
      "EPO",
      "erythrocytosis",
    ]);
  });

  it("reads a numbered list as a sequence", () => {
    const nodes = parseMechanism(
      "1. Glycolysis\n2. Pyruvate oxidation\n3. Krebs cycle\n4. Oxidative phosphorylation",
    );
    expect(nodes).toEqual([
      "Glycolysis",
      "Pyruvate oxidation",
      "Krebs cycle",
      "Oxidative phosphorylation",
    ]);
  });

  it("returns null for a plain definition", () => {
    expect(
      parseMechanism(
        "A buffer resists pH change because it contains a weak acid and its conjugate base in comparable amounts.",
      ),
    ).toBeNull();
  });

  it("returns null for a comparison", () => {
    expect(
      parseMechanism(
        "Glycolysis nets 2 ATP, whereas oxidative phosphorylation yields roughly 26 to 28.",
      ),
    ).toBeNull();
  });

  it("returns null for a two-step chain (too thin)", () => {
    expect(parseMechanism("Increased aldosterone leads to sodium retention.")).toBeNull();
  });

  it("returns null when the chain is a fragment of a longer note", () => {
    expect(
      parseMechanism(
        "The renin-angiotensin system is central to blood pressure control and is targeted by several drug classes. In brief, renin leads to angiotensin I leads to angiotensin II. There is much more nuance around tissue ACE, bradykinin metabolism, and the counter-regulatory ACE2 axis that matters clinically and is examined heavily.",
      ),
    ).toBeNull();
  });
});
