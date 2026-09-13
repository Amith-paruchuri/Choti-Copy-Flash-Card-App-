"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { resolvePath } from "@/actions/subjects";
import { deckKey } from "@/lib/anki/constants";
import { actionError, type ActionResult } from "@/actions/types";
import type { FlashcardImage } from "@/types/database";

// ── 1. resolve deck paths + report which media is new ────────────────────

const startSchema = z.object({
  deckPaths: z
    .array(z.array(z.string().trim().min(1).max(80)).min(1).max(8))
    .min(1)
    .max(400),
  mediaHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(4000).default([]),
});

export interface AnkiStartResult {
  /** `deckKey(deckPath)` → subject id */
  subjectByPath: Record<string, string>;
  /** hashes NOT already in the user's media library — the client must upload these */
  missingMedia: string[];
}

export async function startAnkiImport(
  input: z.input<typeof startSchema>,
): Promise<ActionResult<AnkiStartResult>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { supabase } = await requireUser();

    const subjectByPath: Record<string, string> = {};
    const unique = new Map<string, string[]>();
    for (const path of parsed.data.deckPaths) {
      unique.set(deckKey(path), path);
    }
    for (const [key, path] of unique) {
      subjectByPath[key] = await resolvePath(path);
    }

    let missingMedia: string[] = parsed.data.mediaHashes;
    if (missingMedia.length > 0) {
      const { data: known } = await supabase
        .from("media_objects")
        .select("content_hash")
        .in("content_hash", missingMedia);
      const have = new Set((known ?? []).map((r) => r.content_hash));
      missingMedia = missingMedia.filter((h) => !have.has(h));
    }

    return { ok: true, data: { subjectByPath, missingMedia } };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t start the import.",
    );
  }
}

// ── 2. commit a chunk of cards (client loops) ────────────────────────────

const imageSchema = z.object({
  path: z.string().min(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  mime: z.string().min(1).max(80),
});

const chunkSchema = z.object({
  cards: z
    .array(
      z.object({
        subjectId: z.string().uuid(),
        title: z.string().trim().max(120),
        subtitle: z.string().trim().max(300),
        content: z.string().trim().min(1).max(4000),
        images: z.array(imageSchema).max(8).default([]),
      }),
    )
    .min(1)
    .max(400),
  /** New media_objects rows to record (send with the first chunk). */
  media: z
    .array(
      z.object({
        hash: z.string().regex(/^[a-f0-9]{64}$/),
        path: z.string().min(1),
        mime: z.string().min(1).max(80),
        bytes: z.number().int().min(0).max(50_000_000),
      }),
    )
    .max(4000)
    .default([]),
});

export async function commitAnkiChunk(
  input: z.input<typeof chunkSchema>,
): Promise<ActionResult<{ inserted: number }>> {
  const parsed = chunkSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { user, supabase } = await requireUser();

    // Plain inserts, not upsert: `media_objects` has no UPDATE policy (only
    // INSERT/SELECT/DELETE — see 0013's migration comment), so an upsert's
    // ON CONFLICT DO UPDATE path fails RLS whenever a hash already exists.
    // A duplicate-key error here just means this content is already on
    // file — not a real failure.
    for (const m of parsed.data.media) {
      const { error } = await supabase.from("media_objects").insert({
        user_id: user.id,
        content_hash: m.hash,
        storage_path: m.path,
        mime: m.mime,
        bytes: m.bytes,
      });
      if (error && !/duplicate|already exists|23505/i.test(error.message)) {
        return actionError(`Media: ${error.message}`);
      }
    }

    const rows = parsed.data.cards.map((c) => ({
      user_id: user.id,
      subject_id: c.subjectId,
      content: c.content,
      title: c.title || null,
      subtitle: c.subtitle || null,
      source_type: "pasted" as const,
      images: c.images as FlashcardImage[],
    }));
    const { error, count } = await supabase
      .from("flashcards")
      .insert(rows, { count: "exact" });
    if (error) return actionError(error.message);

    revalidatePath("/dashboard");
    return { ok: true, data: { inserted: count ?? rows.length } };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t save the cards.",
    );
  }
}
