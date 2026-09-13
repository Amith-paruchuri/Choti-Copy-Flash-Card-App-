import { describe, expect, it } from "vitest";

import { cleanPath, looseKey, sameSubject } from "@/lib/subjects/path";

describe("looseKey", () => {
  it("stems common plurals", () => {
    expect(looseKey("Tubulopathies")).toBe(looseKey("Tubulopathy"));
    expect(looseKey("Antiarrhythmics")).toBe(looseKey("Antiarrhythmic"));
    expect(looseKey("Diuretics")).toBe(looseKey("Diuretic"));
  });
  it("keeps -us / -sis words intact", () => {
    expect(looseKey("Apparatus")).toBe("apparatus");
    expect(looseKey("Diagnosis")).toBe("diagnosis");
  });
  it("ignores case and punctuation", () => {
    expect(looseKey("Renin–Angiotensin System")).toBe(
      looseKey("renin angiotensin system"),
    );
  });
});

describe("sameSubject", () => {
  it("matches exact and near-duplicate", () => {
    expect(sameSubject("Nephrology", "nephrology")).toBe(true);
    expect(sameSubject("Renal tubulopathies", "Renal Tubulopathy")).toBe(true);
    expect(sameSubject("Nephrology", "Pulmonology")).toBe(false);
  });
});

describe("cleanPath", () => {
  it("trims, drops blanks, and caps depth", () => {
    expect(
      cleanPath(["  Medicine ", "", "Nephrology", "a", "b", "c", "d", "e"]),
    ).toEqual(["Medicine", "Nephrology", "a", "b", "c", "d"]);
  });
  it("collapses a segment that repeats the previous", () => {
    expect(cleanPath(["Nephrology", "nephrology", "Tubulopathies"])).toEqual([
      "Nephrology",
      "Tubulopathies",
    ]);
  });
});
