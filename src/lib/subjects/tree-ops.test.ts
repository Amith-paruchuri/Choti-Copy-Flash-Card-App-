import { describe, expect, it } from "vitest";

import {
  childrenOf,
  depthOf,
  descendantIds,
  nameClashesIn,
  subtreeHeight,
  type FlatSubject,
} from "@/lib/subjects/tree-ops";

// Nephrology ─ Renal tubulopathies ─ Fanconi
//            └ Renin regulation
// Pulmonology (top level, no children)
const tree: FlatSubject[] = [
  { id: "neph", name: "Nephrology", parent_id: null },
  { id: "tub", name: "Renal tubulopathies", parent_id: "neph" },
  { id: "fanconi", name: "Fanconi", parent_id: "tub" },
  { id: "renin", name: "Renin regulation", parent_id: "neph" },
  { id: "pulm", name: "Pulmonology", parent_id: null },
];

describe("childrenOf", () => {
  it("lists top-level subjects for null", () => {
    expect(childrenOf(tree, null).map((s) => s.id)).toEqual(["neph", "pulm"]);
  });
  it("lists direct children only", () => {
    expect(childrenOf(tree, "neph").map((s) => s.id)).toEqual(["tub", "renin"]);
  });
});

describe("descendantIds", () => {
  it("collects the whole subtree, excluding the root", () => {
    expect([...descendantIds(tree, "neph")].sort()).toEqual(
      ["fanconi", "renin", "tub"].sort(),
    );
  });
  it("is empty for a leaf", () => {
    expect(descendantIds(tree, "pulm").size).toBe(0);
  });
  it("does not hang on a cycle", () => {
    const cyclic: FlatSubject[] = [
      { id: "a", name: "A", parent_id: "b" },
      { id: "b", name: "B", parent_id: "a" },
    ];
    expect(descendantIds(cyclic, "a").has("b")).toBe(true);
  });
});

describe("depthOf", () => {
  it("counts 1-based depth from the root", () => {
    expect(depthOf(tree, "neph")).toBe(1);
    expect(depthOf(tree, "tub")).toBe(2);
    expect(depthOf(tree, "fanconi")).toBe(3);
  });
});

describe("subtreeHeight", () => {
  it("is 1 for a leaf", () => {
    expect(subtreeHeight(tree, "pulm")).toBe(1);
    expect(subtreeHeight(tree, "fanconi")).toBe(1);
  });
  it("counts the tallest branch", () => {
    expect(subtreeHeight(tree, "neph")).toBe(3); // neph → tub → fanconi
    expect(subtreeHeight(tree, "tub")).toBe(2);
  });
});

describe("nameClashesIn", () => {
  it("detects a case-insensitive sibling collision", () => {
    expect(nameClashesIn(tree, "neph", "renin regulation")).toBe(true);
    expect(nameClashesIn(tree, null, "PULMONOLOGY")).toBe(true);
  });
  it("ignores the folder being edited", () => {
    expect(nameClashesIn(tree, "neph", "Renin regulation", "renin")).toBe(false);
  });
  it("is false when the name is free at that level", () => {
    expect(nameClashesIn(tree, "neph", "Glomerular disease")).toBe(false);
    expect(nameClashesIn(tree, null, "Renal tubulopathies")).toBe(false); // only a clash under neph
  });
});
