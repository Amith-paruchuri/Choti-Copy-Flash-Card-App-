"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { flattenTree, getSubjectTree, reusablePathsFor } from "@/lib/queries/subjects";
import { recordAiCall } from "@/lib/usage/ai";
import { actionError, type ActionResult } from "@/actions/types";

const inputSchema = z.array(z.string().uuid()).min(1).max(60);

/** Cards per AI request — keeps each call small and inside the timeout. */
const BATCH = 16;
/** Hard ceiling so a huge selection can't stall the request. */
const MAX_CARDS = 120;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Kick off a "Re-sort with AI" job: pull the chosen subjects' cards, ask the AI
 * for a broad→specific path per card, and stage the result as an import so the
 * user reviews it on the same grouped screen. Committing MOVES the cards.
 */
export async function startResort(
  subjectIds: string[],
): Promise<ActionResult<null>> {
  const parsed = inputSchema.safeParse(subjectIds);
  if (!parsed.success) return actionError("Pick at least one subject.");
  const ids = [...new Set(parsed.data)];
  let newImportId: string | null = null;

  try {
    const { user, supabase } = await requireUser();

    const [{ data: subs }, { data: rawCards }, tree] = await Promise.all([
      supabase.from("subjects").select("id, name").in("id", ids),
      supabase
        .from("flashcards")
        .select("id, title, subtitle, content, subject_id")
        .in("subject_id", ids)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      getSubjectTree(),
    ]);

    if (!subs?.length) return actionError("Those subjects no longer exist.");
    const nameById = new Map(subs.map((s) => [s.id, s.name]));

    const cards = (rawCards ?? []).filter((c) => nameById.has(c.subject_id));
    if (cards.length === 0) {
      return actionError("The selected subjects have no cards to re-sort.");
    }
    const truncated = cards.length > MAX_CARDS;
    const working = cards.slice(0, MAX_CARDS);

    // Give the AI the paths that already exist (excluding the flat ones we're
    // re-sorting) so it reuses them verbatim instead of coining near-duplicates.
    const existingPaths = reusablePathsFor(
      flattenTree(tree),
      new Set(ids),
    );

    const ai = getAIProvider();
    const placement = new Map<string, string[]>();
    for (const group of chunk(working, BATCH)) {
      const suggestions = await ai.suggestPaths({
        cards: group.map((c) => ({
          id: c.id,
          title: c.title ?? "",
          content: c.content,
        })),
        existingPaths,
      });
      await recordAiCall(supabase);
      for (const s of suggestions) {
        if (s.path.length > 0) placement.set(s.id, s.path);
      }
    }

    const { data: imp, error: impError } = await supabase
      .from("imports")
      .insert({
        user_id: user.id,
        kind: "resort",
        original_name: "Re-sort",
        storage_path: null,
        status: "ready",
        source_subject_ids: ids,
        total_chunks: 0,
        done_chunks: 0,
        truncated,
        notes: `Re-filing ${working.length} card${
          working.length === 1 ? "" : "s"
        } from ${ids.length} flat subject${ids.length === 1 ? "" : "s"}.`,
      })
      .select("id")
      .single();
    if (impError || !imp) {
      return actionError(impError?.message ?? "Could not start the re-sort.");
    }

    const { error: cardsError } = await supabase.from("import_cards").insert(
      working.map((c, i) => {
        // Fall back to the card's current subject so an unplaced card just
        // stays put rather than landing in a junk group.
        const path =
          placement.get(c.id) ?? [nameById.get(c.subject_id) ?? "Unsorted"];
        return {
          import_id: imp.id,
          user_id: user.id,
          flashcard_id: c.id,
          // Blank when the card has no title — the review shows a placeholder
          // and the commit leaves the existing title untouched.
          title: c.title ?? "",
          subtitle: c.subtitle ?? "",
          content: c.content,
          suggested_subject: path[path.length - 1] ?? null,
          suggested_path: path,
          position: i,
        };
      }),
    );
    if (cardsError) {
      await supabase.from("imports").delete().eq("id", imp.id);
      return actionError(cardsError.message);
    }

    newImportId = imp.id;
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Could not re-sort.");
  }

  redirect(`/import/${newImportId}`);
}
