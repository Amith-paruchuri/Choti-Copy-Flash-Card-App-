import { describe, expect, it } from "vitest";

import { imageAltText, isImagePrimary } from "@/lib/media/images";

describe("imageAltText", () => {
  it("joins non-empty alt strings with a separator", () => {
    expect(
      imageAltText([
        { alt: "Krebs cycle pathway diagram" },
        { alt: "citrate synthase, aconitase" },
      ]),
    ).toBe("Krebs cycle pathway diagram · citrate synthase, aconitase");
  });

  it("skips blank / missing descriptions", () => {
    expect(
      imageAltText([{ alt: "  " }, { alt: undefined }, { alt: "hemoglobin" }]),
    ).toBe("hemoglobin");
  });

  it("returns null when there's nothing to index", () => {
    expect(imageAltText([])).toBeNull();
    expect(imageAltText(null)).toBeNull();
    expect(imageAltText([{ alt: "" }, { alt: "   " }])).toBeNull();
  });
});

describe("isImagePrimary", () => {
  const img = [{ path: "u/h" }];

  it("is true for a thin card that has an image", () => {
    expect(isImagePrimary("", img, 120)).toBe(true);
    expect(isImagePrimary("Coagulation cascade", img, 120)).toBe(true);
  });

  it("is false without an image", () => {
    expect(isImagePrimary("", [], 120)).toBe(false);
    expect(isImagePrimary("", null, 120)).toBe(false);
  });

  it("is false when there's substantial text", () => {
    expect(isImagePrimary("x".repeat(200), img, 120)).toBe(false);
  });

  it("ignores surrounding whitespace when measuring the text", () => {
    expect(isImagePrimary(`   ${"y".repeat(100)}   `, img, 120)).toBe(true);
  });
});
