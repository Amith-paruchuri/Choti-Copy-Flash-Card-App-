"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { resolvePath, resolveSubject } from "@/actions/subjects";
import { actionError, type ActionResult } from "@/actions/types";
import {
  cardSubtitleSchema,
  flashcardContentSchema,
  subjectColorSchema,
} from "@/lib/validation";
import { MAX_SUBJECT_DEPTH } from "@/lib/subjects/path";

const commitGroupSchema = z
  .object({
    /** An existing subject the user picked; otherwise the path is used. */
    existingId: z.string().uuid().nullable().optional(),
    /** Broad → specific path, e.g. ["Nephrology","Renal tubulopathies"]. */
    path: z
      .array(z.string().trim().min(1).max(80))
      .max(MAX_SUBJECT_DEPTH)
      .default([]),
    color: subjectColorSchema.optional(),
    cards: z
      .array(
        z.object({
          /** Set for a "Re-sort" card: the existing flashcard to move. */
          flashcardId: z.string().uuid().nullable().optional(),
          // May be blank on a re-sort — an empty field means "leave it as is".
          title: z.string().trim().max(120, "Keep the title under 120 characters."),
          subtitle: cardSubtitleSchema,
          content: flashcardContentSchema,
        }),
      )
      .min(1),
  })
  .refine((g) => g.existingId || g.path.length > 0, {
    message: "Each group needs a subject.",
  });

const commitSchema = z.object({
  importId: z.string().uuid(),
  groups: z.array(commitGroupSchema).min(1, "Keep at least one card."),
});

export async function commitImport(
  input: z.input<typeof commitSchema>,
): Promise<ActionResult<null>> {
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const touchedSubjects: string[] = [];
  try {
    const { user, supabase } = await requireUser();

    const { data: imp } = await supabase
      .from("imports")
      .select("id, kind, status, storage_path, source_subject_ids")
      .eq("id", parsed.data.importId)
      .maybeSingle();
    if (!imp) return actionError("Import not found.");
    if (imp.status === "saved") return actionError("Already saved.");

    const isResort = imp.kind === "resort";
    const source = imp.kind === "image" ? "image" : "pasted";

    for (const group of parsed.data.groups) {
      const subjectId = group.existingId
        ? await resolveSubject({ subjectId: group.existingId })
        : await resolvePath(group.path, group.color);
      touchedSubjects.push(subjectId);

      const toMove = group.cards.filter((c) => c.flashcardId);
      const toInsert = group.cards.filter((c) => !c.flashcardId);

      // Re-sort: the card already exists — move it. Only overwrite title /
      // subtitle when the review left a value; a blank field means "keep it".
      for (const c of toMove) {
        const patch: {
          subject_id: string;
          content: string;
          title?: string;
          subtitle?: string;
        } = { subject_id: subjectId, content: c.content };
        if (c.title) patch.title = c.title;
        if (c.subtitle) patch.subtitle = c.subtitle;

        const { error } = await supabase
          .from("flashcards")
          .update(patch)
          .eq("id", c.flashcardId as string)
          .eq("user_id", user.id);
        if (error) return actionError(error.message);
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("flashcards").insert(
          toInsert.map((c) => ({
            user_id: user.id,
            subject_id: subjectId,
            content: c.content,
            title: c.title || "Untitled card",
            subtitle: c.subtitle || null,
            source_type: source as "image" | "pasted",
          })),
        );
        if (error) return actionError(error.message);
      }
    }

    await supabase.from("imports").update({ status: "saved" }).eq("id", imp.id);
    if (imp.storage_path) {
      await supabase.storage.from("imports").remove([imp.storage_path]);
    }

    // Re-sort: drop the now-empty flat subjects the cards came out of.
    if (isResort && imp.source_subject_ids.length > 0) {
      const sources = imp.source_subject_ids.filter(
        (id) => !touchedSubjects.includes(id),
      );
      if (sources.length > 0) {
        const [{ data: stillHasCards }, { data: hasChildren }] =
          await Promise.all([
            supabase
              .from("flashcards")
              .select("subject_id")
              .eq("is_active", true)
              .in("subject_id", sources),
            supabase
              .from("subjects")
              .select("parent_id")
              .in("parent_id", sources),
          ]);
        const keep = new Set<string>([
          ...(stillHasCards ?? []).map((r) => r.subject_id),
          ...(hasChildren ?? []).map((r) => r.parent_id as string),
        ]);
        const prune = sources.filter((id) => !keep.has(id));
        if (prune.length > 0) {
          await supabase.from("subjects").delete().in("id", prune);
        }
      }
    }
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Could not save.");
  }

  revalidatePath("/dashboard");
  for (const id of new Set(touchedSubjects)) revalidatePath(`/subjects/${id}`);
  redirect(
    touchedSubjects.length === 1 ? `/subjects/${touchedSubjects[0]}` : "/dashboard",
  );
}

export async function discardImport(importId: string): Promise<ActionResult<null>> {
  const parsed = z.string().uuid().safeParse(importId);
  if (!parsed.success) return actionError("Invalid import.");

  try {
    const { supabase } = await requireUser();
    const { data: imp } = await supabase
      .from("imports")
      .select("id, storage_path")
      .eq("id", parsed.data)
      .maybeSingle();
    if (imp) {
      if (imp.storage_path) {
        await supabase.storage.from("imports").remove([imp.storage_path]);
      }
      await supabase.from("imports").delete().eq("id", imp.id);
    }
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Could not discard.");
  }

  redirect("/dashboard");
}
