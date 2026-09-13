import { describe, expect, it } from "vitest";

import {
  clozeOrdinals,
  fieldToText,
  isClozeText,
  renderCloze,
} from "@/lib/anki/html";
import { parseMediaManifest } from "@/lib/anki/media-manifest";

describe("fieldToText", () => {
  it("converts block tags to newlines and strips the rest", () => {
    const { text } = fieldToText(
      "<div>Line one</div><div>Line two<br>and a break</div>",
    );
    expect(text).toBe("Line one\nLine two\nand a break");
  });

  it("pulls image filenames and drops the tag + sound refs", () => {
    const { text, images } = fieldToText(
      'See <img src="heart-anatomy.png"> [sound:beat.mp3] here',
    );
    expect(images).toEqual(["heart-anatomy.png"]);
    expect(text.replace(/\s+/g, " ")).toBe("See here");
  });

  it("decodes entities", () => {
    expect(fieldToText("a &amp; b &lt;c&gt; &#39;d&#39;").text).toBe(
      "a & b <c> 'd'",
    );
  });
});

describe("cloze handling", () => {
  const field = "The capital of France is {{c1::Paris}}, in {{c2::Europe}}.";

  it("detects cloze fields and lists ordinals", () => {
    expect(isClozeText(field)).toBe(true);
    expect(clozeOrdinals(field)).toEqual([1, 2]);
  });

  it("blanks the target ordinal, reveals the others", () => {
    expect(renderCloze(field, 1, false).text).toBe(
      "The capital of France is [ … ], in Europe.",
    );
  });

  it("reveals everything for the answer side", () => {
    expect(renderCloze(field, 1, true).text).toBe(
      "The capital of France is Paris, in Europe.",
    );
  });

  it("uses the hint when present", () => {
    expect(
      renderCloze("A {{c1::mesenteric fat pad::what cushions it}} matters", 1, false)
        .text,
    ).toBe("A [ what cushions it ] matters");
  });
});

describe("parseMediaManifest", () => {
  it("reads the legacy JSON form", () => {
    const raw = new TextEncoder().encode('{"0":"a.jpg","1":"b.png"}');
    const { byIndex } = parseMediaManifest(raw, false);
    expect(byIndex.get("0")).toBe("a.jpg");
    expect(byIndex.get("1")).toBe("b.png");
  });

  it("reads a protobuf MediaEntries payload", () => {
    // MediaEntries { entries: [ {name:"x.png"}, {name:"y.jpg"} ] }
    const entry = (name: string) => {
      const n = new TextEncoder().encode(name);
      return new Uint8Array([0x0a, n.length, ...n]); // field 1, len-delimited
    };
    const wrap = (payload: Uint8Array) =>
      new Uint8Array([0x0a, payload.length, ...payload]); // outer field 1
    const buf = new Uint8Array([
      ...wrap(entry("x.png")),
      ...wrap(entry("y.jpg")),
    ]);
    const { byIndex } = parseMediaManifest(buf, true);
    expect(byIndex.get("0")).toBe("x.png");
    expect(byIndex.get("1")).toBe("y.jpg");
  });
});
