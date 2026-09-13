import type { ImportKind } from "@/types/database";

/**
 * Hard limits that keep synchronous chunk-per-request processing reliable.
 *
 * The three PDF-facing caps below are co-designed: text is pulled from the
 * first `maxPdfPages`, the chunker then trims the total to `maxInputChars`
 * (~4 chars/token), and generation stops once `maxCardsPerImport` drafts
 * exist. Each chunk is one sequential AI call in the open browser tab, so
 * the card cap is really a bound on how long the user waits — ~150 cards is
 * ~13 steps ≈ 5-7 min worst case. Bumping one without the others just moves
 * the wall.
 */
export const IMPORT_CAPS = {
  /** Rejected client-side and server-side above this. */
  maxUploadBytes: 20 * 1024 * 1024,
  /** A full textbook chapter / board-review PDF / lecture pack. */
  maxPdfPages: 300,
  maxWhatsappMessages: 1000,
  /** Stop generating once an import has this many draft cards. */
  maxCardsPerImport: 150,
  maxCardsPerChunk: 12,
  /** ~150k tokens of source text (≈ 4 chars/token), ≈ 300 dense pages. */
  maxInputChars: 600_000,
  /** ~3k tokens per Grok/Gemini call. */
  chunkChars: 12_000,
  /** Images pulled out of a zip that has no text file. */
  maxZipImages: 5,
} as const;

const EXT_KIND: Record<string, ImportKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  pdf: "pdf",
  txt: "text",
  zip: "zip",
};

/** File extension → import kind (letters after the last dot, lowercased). */
export function extKind(fileName: string): ImportKind | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return EXT_KIND[ext] ?? null;
}

/**
 * Best-effort import kind for an upload. Extension wins (browsers frequently
 * report an empty or wrong MIME for `.zip`), MIME is the fallback.
 */
export function kindForUpload(fileName: string, mime: string): ImportKind | null {
  const byExt = extKind(fileName);
  if (byExt) return byExt;

  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/plain") return "text";
  if (mime.includes("zip")) return "zip";
  return null;
}

/** For the <input accept="…"> attribute. */
export const UPLOAD_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.pdf,.txt,.zip," +
  "image/png,image/jpeg,image/webp,application/pdf,text/plain," +
  "application/zip,application/x-zip-compressed";
