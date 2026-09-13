import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";

import { parseImport } from "@/lib/import/parse";

const u8 = (s: string) => new Uint8Array(strToU8(s));

describe("parseImport", () => {
  it("plain .txt → one or more text chunks", async () => {
    const r = await parseImport("text", u8("Acids and bases.\n\npH = -log[H+]."), "x");
    expect(r.chunks[0]).toEqual({ type: "text", text: expect.any(String) });
  });

  it("empty .txt → no chunks + a note", async () => {
    const r = await parseImport("text", u8("   \n  "), "x");
    expect(r.chunks).toHaveLength(0);
    expect(r.notes).toMatch(/empty/i);
  });

  it("zip with a WhatsApp _chat.txt → transcript, media + system lines stripped", async () => {
    const chat =
      "[12/03/2025, 9:14:02 AM] Messages and calls are end-to-end encrypted.\n" +
      "[12/03/2025, 9:15:10 AM] Priya: what is le chateliers principle\n" +
      "[12/03/2025, 9:16:44 AM] Sam: a system shifts to counteract an imposed stress\n" +
      "[12/03/2025, 9:17:00 AM] Sam: add reactant shifts it right\n" +
      "[12/03/2025, 9:18:00 AM] Priya: IMG-1.jpg (file attached)\n";
    const zip = zipSync({
      "_chat.txt": strToU8(chat),
      "IMG-1.jpg": strToU8("x"),
      "PTT-1.opus": strToU8("x"),
    });
    const r = await parseImport("zip", new Uint8Array(zip), "x");
    const text = JSON.stringify(r.chunks);
    expect(text).toContain("le chateliers principle");
    expect(text).not.toContain("end-to-end encrypted");
    expect(text).not.toContain("file attached");
  });

  it("zip with only images (no text) → inline image chunks", async () => {
    const zip = zipSync({
      "a.png": strToU8("fake"),
      "b.jpg": strToU8("fake"),
      "notes.pdf": strToU8("ignored"),
    });
    const r = await parseImport("zip", new Uint8Array(zip), "x");
    expect(r.chunks).toHaveLength(2);
    expect(r.chunks.every((c) => c.type === "image_inline")).toBe(true);
  });

  it("zip with nothing usable → no chunks + a note", async () => {
    const zip = zipSync({ "song.mp3": strToU8("x") });
    const r = await parseImport("zip", new Uint8Array(zip), "x");
    expect(r.chunks).toHaveLength(0);
    expect(r.notes).toBeTruthy();
  });
});
