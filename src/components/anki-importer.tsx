"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileArchive } from "lucide-react";
import { toast } from "sonner";

import { commitAnkiChunk, startAnkiImport } from "@/actions/anki";
import { createClient } from "@/lib/supabase/client";
import { ANKI_CHUNK, MEDIA_BUCKET, deckKey } from "@/lib/anki/constants";
import { DropZone } from "@/components/drop-zone";
import { Progress } from "@/components/ui/progress";

type Phase =
  | { name: "idle" }
  | { name: "reading" }
  | { name: "media"; done: number; total: number }
  | { name: "saving"; done: number; total: number }
  | { name: "error"; message: string };

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function AnkiImporter({ userId }: { userId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  async function run(file: File) {
    try {
      setPhase({ name: "reading" });
      const { parseApkg } = await import("@/lib/anki/parse");
      const result = await parseApkg(file);
      if (result.drafts.length === 0) {
        setPhase({ name: "error", message: "No cards found in that deck." });
        return;
      }
      for (const w of result.warnings) toast.message(w);

      // hash every media file once
      const mediaEntries = [...result.media.entries()];
      const hashByName = new Map<string, string>();
      for (const [name, { bytes }] of mediaEntries) {
        hashByName.set(name, await sha256Hex(bytes));
      }
      const allHashes = [...new Set(hashByName.values())];

      const uniquePaths = new Map<string, string[]>();
      for (const d of result.drafts) uniquePaths.set(deckKey(d.deckPath), d.deckPath);

      const start = await startAnkiImport({
        deckPaths: [...uniquePaths.values()],
        mediaHashes: allHashes,
      });
      if (!start.ok) {
        setPhase({ name: "error", message: start.error });
        return;
      }
      const { subjectByPath, missingMedia } = start.data;

      // upload the media that isn't already in the library
      const toUpload = new Set(missingMedia);
      const supabase = createClient();
      const mediaRows: {
        hash: string;
        path: string;
        mime: string;
        bytes: number;
      }[] = [];
      const uploads = mediaEntries.filter(([name]) =>
        toUpload.has(hashByName.get(name) as string),
      );
      setPhase({ name: "media", done: 0, total: uploads.length });
      for (let i = 0; i < uploads.length; i += 1) {
        const [name, { bytes, mime }] = uploads[i];
        const hash = hashByName.get(name) as string;
        if (!toUpload.has(hash)) continue; // deduped within this file
        const path = `${userId}/${hash}`;
        // Content-addressed: an object at this key already holds these exact
        // bytes, so a duplicate upload is a success, not an error. `upsert:
        // false` keeps us on the INSERT storage policy (there's no UPDATE
        // policy on the bucket) — same as the manual card-image upload path.
        const { error } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, new Blob([new Uint8Array(bytes)], { type: mime }), {
            contentType: mime,
            upsert: false,
          });
        if (error && !/exist|dupl|409/i.test(error.message)) {
          setPhase({
            name: "error",
            message: `Image upload failed: ${error.message}. Is the "${MEDIA_BUCKET}" bucket set up?`,
          });
          return;
        }
        mediaRows.push({ hash, path, mime, bytes: bytes.length });
        toUpload.delete(hash);
        setPhase({ name: "media", done: i + 1, total: uploads.length });
      }

      // build the card rows
      const mimeByName = new Map(
        mediaEntries.map(([name, { mime }]) => [name, mime]),
      );
      const cards = result.drafts.map((d) => ({
        subjectId: subjectByPath[deckKey(d.deckPath)],
        title: d.title,
        subtitle: d.subtitle,
        content: d.content,
        images: d.images
          .map((name) => {
            const hash = hashByName.get(name);
            return hash
              ? {
                  path: `${userId}/${hash}`,
                  hash,
                  mime: mimeByName.get(name) ?? "image/png",
                }
              : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      }));

      // commit in chunks
      setPhase({ name: "saving", done: 0, total: cards.length });
      let inserted = 0;
      let first = true;
      for (const group of chunk(cards, ANKI_CHUNK)) {
        const res = await commitAnkiChunk({
          cards: group,
          media: first ? mediaRows : [],
        });
        first = false;
        if (!res.ok) {
          setPhase({
            name: "error",
            message: `${res.error} (${inserted} cards saved before this)`,
          });
          return;
        }
        inserted += res.data.inserted;
        setPhase({ name: "saving", done: inserted, total: cards.length });
      }

      toast.success(
        `Imported ${inserted} card${inserted === 1 ? "" : "s"} from ${
          result.stats.decks
        } deck${result.stats.decks === 1 ? "" : "s"}` +
          (result.stats.imagesFound
            ? ` · ${result.stats.imagesFound} images`
            : ""),
      );
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setPhase({
        name: "error",
        message: e instanceof Error ? e.message : "Couldn’t read that deck.",
      });
    }
  }

  return (
    <div className="border-rule space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <FileArchive className="text-ink size-4" />
        <h2 className="text-sm font-semibold">Anki deck (.apkg)</h2>
      </div>
      <p className="text-muted-foreground text-xs">
        Sub-decks become nested subjects, cloze notes become flashcards, and
        embedded images come along. Parsed entirely in your browser. Up to ~2,000
        cards per import.
      </p>

      {phase.name === "idle" || phase.name === "error" ? (
        <>
          <DropZone
            onFile={(f) => void run(f)}
            accept=".apkg,.colpkg"
            icon={<FileArchive className="size-5" />}
            label="Choose an .apkg file"
            hint="Exported from Anki (File → Export)"
          />
          {phase.name === "error" && (
            <p className="text-destructive text-xs">{phase.message}</p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {phase.name === "reading" && "Reading the deck…"}
            {phase.name === "media" &&
              `Uploading images ${phase.done}/${phase.total}…`}
            {phase.name === "saving" &&
              `Saving cards ${phase.done}/${phase.total}…`}
          </p>
          {(phase.name === "media" || phase.name === "saving") && (
            <Progress
              value={
                phase.total > 0 ? (phase.done / phase.total) * 100 : 0
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
