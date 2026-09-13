import { unzip } from "fflate";
import { decompress as zstdDecompress } from "fzstd";
import initSqlJs, { type Database } from "sql.js";

import {
  clozeOrdinals,
  fieldToText,
  isClozeText,
  renderCloze,
} from "@/lib/anki/html";
import { parseMediaManifest } from "@/lib/anki/media-manifest";

export const ANKI_MAX_CARDS = 2000;
export const ANKI_MAX_BYTES = 80 * 1024 * 1024; // 80 MB

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;
const MAX_CONTENT = 3900; // stay under the flashcard column limit (4000)

function clampContent(text: string): string {
  return text.length > MAX_CONTENT ? `${text.slice(0, MAX_CONTENT).trimEnd()}…` : text;
}

/**
 * Newer Anki exports zstd-compress each media file individually inside the
 * zip (same trick as `collection.anki21b`); older exports store them raw.
 * Try to decompress and fall back to the raw bytes if it isn't actually
 * zstd — same defensive try/fallback already used for the media manifest
 * below. Without this, every embedded image from a modern Anki export
 * uploads as an undecodable blob (0×0, browser can't render it).
 */
function decompressMedia(raw: Uint8Array): Uint8Array {
  try {
    return zstdDecompress(raw);
  } catch {
    return raw;
  }
}

export interface AnkiDraft {
  deckPath: string[];
  title: string;
  subtitle: string;
  content: string;
  /** original Anki filenames referenced by this card */
  images: string[];
}

export interface AnkiParseResult {
  drafts: AnkiDraft[];
  /** Anki filename → file bytes, only for images actually used by kept cards. */
  media: Map<string, { bytes: Uint8Array; mime: string }>;
  stats: {
    notes: number;
    cards: number;
    decks: number;
    imagesReferenced: number;
    imagesFound: number;
  };
  truncated: boolean;
  warnings: string[];
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)));
  });
}

/** Deck names: modern Anki uses \x1f between components, legacy uses "::". */
function splitDeckName(name: string): string[] {
  const parts = (name.includes("\x1f") ? name.split("\x1f") : name.split("::"))
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Anki"];
}

function mimeFor(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return (
    {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      bmp: "image/bmp",
    }[ext] ?? "application/octet-stream"
  );
}

function tableExists(db: Database, table: string): boolean {
  const r = db.exec(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='${table}'`,
  );
  return r.length > 0 && r[0].values.length > 0;
}

function loadDeckNames(db: Database): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (tableExists(db, "decks")) {
    const res = db.exec("SELECT id, name FROM decks");
    for (const row of res[0]?.values ?? []) {
      map.set(String(row[0]), splitDeckName(String(row[1] ?? "")));
    }
    return map;
  }
  // legacy: col.decks JSON
  const res = db.exec("SELECT decks FROM col LIMIT 1");
  const json = res[0]?.values?.[0]?.[0];
  if (typeof json === "string") {
    try {
      const decks = JSON.parse(json) as Record<string, { name?: string }>;
      for (const [id, d] of Object.entries(decks)) {
        map.set(id, splitDeckName(d.name ?? ""));
      }
    } catch {
      /* ignore */
    }
  }
  return map;
}

interface NoteTypeInfo {
  isCloze: boolean;
  isOcclusion: boolean;
}

/** Classify each notetype (modern `notetypes` table, or legacy `col.models`). */
function loadNoteTypes(db: Database): Map<string, NoteTypeInfo> {
  const map = new Map<string, NoteTypeInfo>();

  if (tableExists(db, "notetypes")) {
    for (const row of db.exec("SELECT id, name FROM notetypes")[0]?.values ??
      []) {
      const name = String(row[1] ?? "").toLowerCase();
      map.set(String(row[0]), {
        isCloze: name.includes("cloze"),
        isOcclusion: name.includes("occlusion"),
      });
    }
    if (map.size > 0) return map;
  }

  const json = db.exec("SELECT models FROM col LIMIT 1")[0]?.values?.[0]?.[0];
  if (typeof json === "string") {
    try {
      const models = JSON.parse(json) as Record<
        string,
        { type?: number; name?: string }
      >;
      for (const [id, m] of Object.entries(models)) {
        const name = (m.name ?? "").toLowerCase();
        map.set(id, {
          isCloze: m.type === 1 || name.includes("cloze"),
          isOcclusion: name.includes("occlusion"),
        });
      }
    } catch {
      /* ignore */
    }
  }
  return map;
}

export interface ParseOptions {
  /** Override where the sql.js wasm is loaded from (tests run outside a server). */
  wasmUrl?: string;
}

export async function parseApkg(
  file: File | Uint8Array,
  opts: ParseOptions = {},
): Promise<AnkiParseResult> {
  const size = file instanceof Uint8Array ? file.byteLength : file.size;
  if (size > ANKI_MAX_BYTES) {
    throw new Error(
      `That file is ${(size / 1e6).toFixed(0)} MB. The limit is ${
        ANKI_MAX_BYTES / 1e6
      } MB — export smaller decks separately.`,
    );
  }

  const warnings: string[] = [];
  const zipBytes =
    file instanceof Uint8Array
      ? file
      : new Uint8Array(await file.arrayBuffer());
  const entries = await unzipAsync(zipBytes);

  // ── collection DB ───────────────────────────────────────────────────
  let dbBytes: Uint8Array | undefined;
  if (entries["collection.anki21b"]) {
    dbBytes = zstdDecompress(entries["collection.anki21b"]);
  } else if (entries["collection.anki21"]) {
    dbBytes = entries["collection.anki21"];
  } else if (entries["collection.anki2"]) {
    dbBytes = entries["collection.anki2"];
  }
  if (!dbBytes) {
    throw new Error("This doesn't look like an Anki deck (no collection file).");
  }

  const wasmUrl = opts.wasmUrl ?? "/sql-wasm.wasm";
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database(dbBytes);

  try {
    const deckNames = loadDeckNames(db);
    const noteTypes = loadNoteTypes(db);

    // ── media manifest ────────────────────────────────────────────────
    const mediaMap = (() => {
      const raw = entries["media"];
      if (!raw) return new Map<string, string>();
      // media manifest is zstd only in the newest format; try it, fall back.
      let bytes = raw;
      let wasZstd = false;
      try {
        bytes = zstdDecompress(raw);
        wasZstd = true;
      } catch {
        /* plain JSON */
      }
      return parseMediaManifest(bytes, wasZstd).byIndex;
    })();

    // ── notes → drafts ────────────────────────────────────────────────
    // A card in a filtered/dynamic deck has its real home in `odid`.
    const noteRows = db.exec(
      `SELECT n.id, n.mid, n.flds,
              MIN(CASE WHEN c.odid IS NOT NULL AND c.odid <> 0
                       THEN c.odid ELSE c.did END) AS did
       FROM notes n
       JOIN cards c ON c.nid = n.id
       GROUP BY n.id`,
    );
    const rows = noteRows[0]?.values ?? [];

    const drafts: AnkiDraft[] = [];
    let cardCount = 0;
    let skippedOcclusion = 0;

    for (const row of rows) {
      const mid = String(row[1]);
      const flds = String(row[2] ?? "");
      const did = String(row[3]);
      const deckPath = deckNames.get(did) ?? ["Anki"];
      const fields = flds.split("\x1f");
      const info = noteTypes.get(mid) ?? {
        isCloze: false,
        isOcclusion: false,
      };

      if (info.isOcclusion) {
        skippedOcclusion += 1;
        continue;
      }

      const isCloze = info.isCloze || fields.some((f) => isClozeText(f));

      if (isCloze) {
        const clozeIdx = fields.findIndex((f) => isClozeText(f));
        const clozeField = fields[clozeIdx] ?? fields[0] ?? "";
        // The conventional "Extra" is the field right after the cloze text;
        // ignore trailing config / occlusion fields that some notetypes carry.
        const extraRaw = fields[clozeIdx + 1] ?? "";
        const extra =
          extraRaw && !isClozeText(extraRaw) && !/^[\d,\s|.n y]*$/i.test(extraRaw)
            ? fieldToText(extraRaw)
            : { text: "", images: [] as string[] };
        const allImages = fields.flatMap((f) => fieldToText(f).images);
        const ords = clozeOrdinals(clozeField).slice(0, 8);
        for (const ord of ords.length ? ords : [1]) {
          const front = renderCloze(clozeField, ord, false);
          const back = renderCloze(clozeField, ord, true);
          if (!back.text) continue;
          drafts.push({
            deckPath,
            title: front.text.slice(0, 120),
            subtitle: "",
            content: clampContent(back.text + (extra.text ? `\n\n${extra.text}` : "")),
            images: [...new Set([...allImages])],
          });
          cardCount += 1;
        }
      } else {
        const front = fieldToText(fields[0] ?? "");
        const back = fieldToText(fields.slice(1).join("\n\n"));
        const content = back.text || front.text;
        if (!content) continue;
        drafts.push({
          deckPath,
          title: (back.text ? front.text : "").slice(0, 120),
          subtitle: "",
          content: clampContent(content),
          images: [...new Set([...front.images, ...back.images])],
        });
        cardCount += 1;
      }
    }

    if (skippedOcclusion > 0) {
      warnings.push(
        `Skipped ${skippedOcclusion} image-occlusion card${
          skippedOcclusion === 1 ? "" : "s"
        } — that format isn't supported yet.`,
      );
    }

    const truncated = drafts.length > ANKI_MAX_CARDS;
    const kept = truncated ? drafts.slice(0, ANKI_MAX_CARDS) : drafts;
    if (truncated) {
      warnings.push(
        `Imported the first ${ANKI_MAX_CARDS} cards. Re-import the deck to bring in the rest.`,
      );
    }

    // ── collect the media files the kept cards actually use ───────────
    const nameToZipEntry = new Map<string, string>();
    for (const [idx, realName] of mediaMap) nameToZipEntry.set(realName, idx);

    const media = new Map<string, { bytes: Uint8Array; mime: string }>();
    let imagesReferenced = 0;
    for (const draft of kept) {
      const usable: string[] = [];
      for (const name of draft.images) {
        imagesReferenced += 1;
        if (!IMAGE_EXT.test(name)) continue;
        if (media.has(name)) {
          usable.push(name);
          continue;
        }
        const zipIdx = nameToZipEntry.get(name);
        const raw = zipIdx ? entries[zipIdx] : undefined;
        if (raw) {
          media.set(name, { bytes: decompressMedia(raw), mime: mimeFor(name) });
          usable.push(name);
        }
      }
      draft.images = usable;
    }

    if (imagesReferenced > 0 && media.size < imagesReferenced) {
      warnings.push(
        `${imagesReferenced - media.size} referenced image(s) could not be matched and were skipped.`,
      );
    }

    return {
      drafts: kept,
      media,
      stats: {
        notes: rows.length,
        cards: cardCount,
        decks: new Set(kept.map((d) => d.deckPath.join(" › "))).size,
        imagesReferenced,
        imagesFound: media.size,
      },
      truncated,
      warnings,
    };
  } finally {
    db.close();
  }
}
