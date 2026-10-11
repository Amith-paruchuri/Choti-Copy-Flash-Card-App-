import "server-only";

import { unzipSync, strFromU8 } from "fflate";
import { extractText } from "unpdf";

import { IMPORT_CAPS } from "@/lib/import/caps";
import { chunkText } from "@/lib/import/chunk";
import { looksLikeWhatsappChat, parseWhatsappChat } from "@/lib/import/whatsapp";
import type { ImportChunk, ImportKind } from "@/types/database";

export interface ParsedImport {
  chunks: ImportChunk[];
  notes: string | null;
  truncated: boolean;
}

const IMG_EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function textChunks(body: string): ImportChunk[] {
  return chunkText(body).chunks.map((t) => ({ type: "text", text: t }));
}

/**
 * Thrown when a PDF has more pages than the caller's tier allows. Caught
 * specifically (not via the generic parse-error handler) so the route can
 * respond with a typed limit error instead of a plain message.
 */
export class ImportPageLimitError extends Error {
  constructor(
    public readonly totalPages: number,
    public readonly maxPages: number,
  ) {
    super(
      `This PDF has ${totalPages} pages — ${maxPages} is your current limit.`,
    );
    this.name = "ImportPageLimitError";
  }
}

/**
 * `maxPages` is the caller's TIER cap (free/Pro, from limits.ts), not a
 * fixed system ceiling — exceeding it rejects outright rather than silently
 * reading a truncated prefix, so going over reads as a clear "this is what
 * Pro unlocks" moment instead of a confusingly incomplete import.
 */
async function parsePdf(
  bytes: Uint8Array,
  maxPages: number,
): Promise<ParsedImport> {
  const { totalPages, text } = await extractText(bytes, { mergePages: false });
  if (totalPages > maxPages) {
    throw new ImportPageLimitError(totalPages, maxPages);
  }
  const blankPages = text.filter((p) => p.trim().length < 3).length;
  const body = text
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!body) {
    return {
      chunks: [],
      notes:
        "No selectable text found — this PDF looks scanned. Try uploading the pages as images instead.",
      truncated: false,
    };
  }

  const { truncated } = chunkText(body);
  const notes =
    blankPages > 0
      ? `${blankPages} page${blankPages === 1 ? "" : "s"} had no readable text and ${blankPages === 1 ? "was" : "were"} skipped.`
      : null;

  return { chunks: textChunks(body), notes, truncated };
}

function parsePlainText(bytes: Uint8Array): ParsedImport {
  const raw = strFromU8(bytes);
  if (looksLikeWhatsappChat(raw)) return parseChatTranscript(raw);
  if (!raw.trim()) {
    return { chunks: [], notes: "That text file was empty.", truncated: false };
  }
  const { truncated } = chunkText(raw);
  return { chunks: textChunks(raw), notes: null, truncated };
}

function parseChatTranscript(raw: string): ParsedImport {
  const { transcript, messageCount, truncated: msgCapHit } =
    parseWhatsappChat(raw);
  if (!transcript.trim()) {
    return {
      chunks: [],
      notes: "The chat export had no readable messages.",
      truncated: false,
    };
  }
  const { truncated } = chunkText(transcript);
  return {
    chunks: textChunks(transcript),
    notes: msgCapHit
      ? `Only the first ${messageCount} messages were processed.`
      : null,
    truncated: truncated || msgCapHit,
  };
}

function parseZip(bytes: Uint8Array): ParsedImport {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { chunks: [], notes: "That zip file could not be opened.", truncated: false };
  }

  const entries = Object.entries(files).filter(
    ([name]) => !name.startsWith("__MACOSX/") && !name.endsWith("/"),
  );

  // Prefer text: the largest .txt file in the archive.
  const txt = entries
    .filter(([name]) => name.toLowerCase().endsWith(".txt"))
    .sort((a, b) => b[1].length - a[1].length)[0];

  if (txt) {
    const raw = strFromU8(txt[1]);
    return looksLikeWhatsappChat(raw)
      ? parseChatTranscript(raw)
      : {
          chunks: textChunks(raw),
          notes: raw.trim() ? null : "The text file in the zip was empty.",
          truncated: chunkText(raw).truncated,
        };
  }

  // No text — fall back to images inside the zip.
  const images = entries
    .filter(([name]) => {
      const ext = name.toLowerCase().split(".").pop() ?? "";
      return ext in IMG_EXT_MIME;
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (images.length === 0) {
    return {
      chunks: [],
      notes:
        "This zip has no text file or images to import. For a WhatsApp export, include the chat .txt.",
      truncated: false,
    };
  }

  const capped = images.slice(0, IMPORT_CAPS.maxZipImages);
  const chunks: ImportChunk[] = capped.map(([name, data]) => ({
    type: "image_inline",
    mime: IMG_EXT_MIME[name.toLowerCase().split(".").pop() ?? "jpg"] ?? "image/jpeg",
    data_b64: Buffer.from(data).toString("base64"),
  }));

  return {
    chunks,
    notes:
      images.length > capped.length
        ? `Only the first ${capped.length} images in the zip were processed.`
        : null,
    truncated: images.length > capped.length,
  };
}

export async function parseImport(
  kind: ImportKind,
  bytes: Uint8Array,
  storagePath: string,
  maxPdfPages: number = IMPORT_CAPS.maxPdfPages,
): Promise<ParsedImport> {
  switch (kind) {
    case "image":
      return {
        chunks: [{ type: "image", storage_path: storagePath }],
        notes: null,
        truncated: false,
      };
    case "pdf":
      return parsePdf(bytes, maxPdfPages);
    case "text":
      return parsePlainText(bytes);
    case "zip":
      return parseZip(bytes);
    default:
      // "resort" jobs never carry a file and skip this path entirely.
      throw new Error(`Cannot parse import kind "${kind}".`);
  }
}
