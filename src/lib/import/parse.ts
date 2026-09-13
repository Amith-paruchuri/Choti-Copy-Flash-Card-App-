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

async function parsePdf(bytes: Uint8Array): Promise<ParsedImport> {
  const { totalPages, text } = await extractText(bytes, { mergePages: false });
  const pageCapHit = totalPages > IMPORT_CAPS.maxPdfPages;
  const pages = text.slice(0, IMPORT_CAPS.maxPdfPages);
  const blankPages = pages.filter((p) => p.trim().length < 3).length;
  const body = pages
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!body) {
    return {
      chunks: [],
      notes:
        "No selectable text found — this PDF looks scanned. Try uploading the pages as images instead.",
      truncated: pageCapHit,
    };
  }

  const { truncated } = chunkText(body);
  const noteParts: string[] = [];
  if (pageCapHit) {
    noteParts.push(
      `This PDF has ${totalPages} pages — only the first ${IMPORT_CAPS.maxPdfPages} were read. Import the later pages as a separate PDF to cover the rest.`,
    );
  }
  if (blankPages > 0) {
    noteParts.push(
      `${blankPages} page${blankPages === 1 ? "" : "s"} had no readable text and ${blankPages === 1 ? "was" : "were"} skipped.`,
    );
  }

  return {
    chunks: textChunks(body),
    notes: noteParts.join(" ") || null,
    truncated: truncated || pageCapHit,
  };
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
): Promise<ParsedImport> {
  switch (kind) {
    case "image":
      return {
        chunks: [{ type: "image", storage_path: storagePath }],
        notes: null,
        truncated: false,
      };
    case "pdf":
      return parsePdf(bytes);
    case "text":
      return parsePlainText(bytes);
    case "zip":
      return parseZip(bytes);
    default:
      // "resort" jobs never carry a file and skip this path entirely.
      throw new Error(`Cannot parse import kind "${kind}".`);
  }
}
