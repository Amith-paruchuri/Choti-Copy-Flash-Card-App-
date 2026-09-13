"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import {
  SUBJECT_COLORS,
  createFolderSchema,
  createSubjectSchema,
  deleteSubjectSchema,
  editSubjectSchema,
  moveSubjectSchema,
  moveSubjectsSchema,
} from "@/lib/validation";
import { guessSubjectIcon } from "@/lib/subject-icons";
import { MAX_SUBJECT_DEPTH, cleanPath, sameSubject } from "@/lib/subjects/path";
import {
  childrenOf,
  depthOf,
  descendantIds,
  nameClashesIn,
  subtreeHeight,
  type FlatSubject,
} from "@/lib/subjects/tree-ops";
import { getAIProvider } from "@/lib/ai";
import { flattenTree, getSubjectTree, reusablePathsFor } from "@/lib/queries/subjects";
import { recordAiCall } from "@/lib/usage/ai";
import { actionError, type ActionResult } from "@/actions/types";

function randomColor() {
  return SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)];
}

/**
 * Find a subject by case-insensitive name, or create it. Returns its id.
 * Shared by the flashcard form's "new subject" path.
 */
export async function resolveSubject(input: {
  subjectId?: string;
  name?: string;
  color?: string;
  icon?: string;
}): Promise<string> {
  const { user, supabase } = await requireUser();

  if (input.subjectId) {
    const { data } = await supabase
      .from("subjects")
      .select("id")
      .eq("id", input.subjectId)
      .maybeSingle();
    if (!data) throw new Error("That subject no longer exists.");
    return data.id;
  }

  const parsed = createSubjectSchema.parse({
    name: input.name,
    color: input.color,
    icon: input.icon,
  });

  const { data: existing } = await supabase
    .from("subjects")
    .select("id")
    .is("parent_id", null)
    .ilike("name", parsed.name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("subjects")
    .insert({
      user_id: user.id,
      name: parsed.name,
      color: parsed.color,
      icon: parsed.icon ?? guessSubjectIcon(parsed.name),
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? "Could not create the subject.");
  }
  return created.id;
}

/**
 * Resolve a broad→specific path (e.g. ["Nephrology","Renal tubulopathies"]) to
 * the id of its leaf subject, creating any missing nodes along the way. Each
 * segment is matched against its parent's existing children (case- and
 * plural-insensitive) so near-duplicates reuse the same node. Returns the leaf.
 */
export async function resolvePath(
  segments: string[],
  seedColor?: string,
): Promise<string> {
  const { user, supabase } = await requireUser();
  const path = cleanPath(segments);
  if (path.length === 0) throw new Error("Empty subject path.");

  const { data: allRows } = await supabase
    .from("subjects")
    .select("id, name, color, parent_id");
  type Row = { id: string; name: string; color: string; parent_id: string | null };
  const known: Row[] = allRows ?? [];

  let parentId: string | null = null;
  let color: string = seedColor ?? randomColor();

  for (const seg of path) {
    const siblings = known.filter((s) => s.parent_id === parentId);
    const target = seg.toLowerCase();
    const match =
      siblings.find((s) => s.name.toLowerCase() === target) ??
      siblings.find((s) => sameSubject(s.name, seg));

    if (match) {
      parentId = match.id;
      color = match.color; // children take the branch colour
      continue;
    }

    const parentForInsert: string | null = parentId;
    const inserted = await supabase
      .from("subjects")
      .insert({
        user_id: user.id,
        name: seg,
        parent_id: parentForInsert,
        color,
        icon: guessSubjectIcon(seg),
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) {
      throw new Error(
        inserted.error?.message ?? "Could not create the subject path.",
      );
    }
    const newId: string = inserted.data.id;
    known.push({ id: newId, name: seg, color, parent_id: parentForInsert });
    parentId = newId;
  }

  return parentId as string;
}

export async function createSubject(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSubjectSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") ?? undefined,
    icon: formData.get("icon") ?? undefined,
  });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const id = await resolveSubject({
      name: parsed.data.name,
      color: parsed.data.color,
      icon: parsed.data.icon,
    });
    revalidatePath("/dashboard");
    return { ok: true, data: { id } };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to save.");
  }
}

// ── Manual folder management (Google-Drive-style, no AI) ───────────────────

async function loadFlatSubjects(): Promise<{
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  userId: string;
  all: FlatSubject[];
}> {
  const { user, supabase } = await requireUser();
  const { data } = await supabase
    .from("subjects")
    .select("id, name, parent_id");
  return { supabase, userId: user.id, all: data ?? [] };
}

function touch(id: string, parentId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath(`/subjects/${id}`);
  if (parentId) revalidatePath(`/subjects/${parentId}`);
}

/** Create a folder — empty, no cards required. May nest under `parentId`. */
export async function createFolder(
  input: z.input<typeof createFolderSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { name, color, icon, parentId } = parsed.data;

  try {
    const { supabase, userId, all } = await loadFlatSubjects();

    if (parentId) {
      const parent = all.find((s) => s.id === parentId);
      if (!parent) return actionError("That parent folder no longer exists.");
      if (depthOf(all, parentId) >= MAX_SUBJECT_DEPTH) {
        return actionError(
          `Folders only nest ${MAX_SUBJECT_DEPTH} levels deep.`,
        );
      }
    }

    if (nameClashesIn(all, parentId ?? null, name)) {
      return actionError(`A folder named “${name}” already exists here.`);
    }

    const { data: created, error } = await supabase
      .from("subjects")
      .insert({ user_id: userId, name, color, icon, parent_id: parentId })
      .select("id")
      .single();
    if (error || !created) {
      return actionError(error?.message ?? "Could not create the folder.");
    }

    touch(created.id, parentId);
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to create folder.");
  }
}

/** Rename and/or restyle a folder. */
export async function editSubject(
  input: z.input<typeof editSubjectSchema>,
): Promise<ActionResult<null>> {
  const parsed = editSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, name, color, icon } = parsed.data;

  try {
    const { supabase, all } = await loadFlatSubjects();
    const self = all.find((s) => s.id === id);
    if (!self) return actionError("That folder no longer exists.");

    if (nameClashesIn(all, self.parent_id, name, id)) {
      return actionError(`A folder named “${name}” already exists here.`);
    }

    const { error } = await supabase
      .from("subjects")
      .update({ name, color, icon })
      .eq("id", id);
    if (error) return actionError(error.message);

    touch(id, self.parent_id);
    return { ok: true, data: null };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to save.");
  }
}

/** Move a folder (and its whole subtree) under `parentId`, or to top level. */
export async function moveSubject(
  input: z.input<typeof moveSubjectSchema>,
): Promise<ActionResult<null>> {
  const parsed = moveSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, parentId } = parsed.data;

  try {
    const { supabase, all } = await loadFlatSubjects();
    const self = all.find((s) => s.id === id);
    if (!self) return actionError("That folder no longer exists.");
    if ((self.parent_id ?? null) === (parentId ?? null)) {
      return { ok: true, data: null }; // already there
    }
    if (parentId === id) return actionError("A folder can’t contain itself.");

    if (parentId) {
      const parent = all.find((s) => s.id === parentId);
      if (!parent) return actionError("That destination folder no longer exists.");
      if (descendantIds(all, id).has(parentId)) {
        return actionError("Can’t move a folder inside one of its own subfolders.");
      }
      const newDepth = depthOf(all, parentId) + subtreeHeight(all, id);
      if (newDepth > MAX_SUBJECT_DEPTH) {
        return actionError(
          `That would nest folders more than ${MAX_SUBJECT_DEPTH} levels deep.`,
        );
      }
    }

    if (nameClashesIn(all, parentId ?? null, self.name, id)) {
      return actionError(
        `A folder named “${self.name}” already exists there — rename one first.`,
      );
    }

    const { error } = await supabase
      .from("subjects")
      .update({ parent_id: parentId })
      .eq("id", id);
    if (error) return actionError(error.message);

    touch(id, self.parent_id);
    if (parentId) revalidatePath(`/subjects/${parentId}`);
    return { ok: true, data: null };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to move.");
  }
}

/**
 * Move several folders under `parentId` in one go (dashboard multi-select).
 * Each is validated independently; valid ones move, the rest are reported back
 * so a single bad pick doesn't block the others.
 */
export async function moveSubjects(
  input: z.input<typeof moveSubjectsSchema>,
): Promise<ActionResult<{ moved: number; skipped: string[] }>> {
  const parsed = moveSubjectsSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { ids, parentId } = parsed.data;

  try {
    const { supabase, all } = await loadFlatSubjects();
    const moving = new Set(ids);

    if (parentId && moving.has(parentId)) {
      return actionError("You can’t move a folder into itself.");
    }
    const parent = parentId ? all.find((s) => s.id === parentId) : null;
    if (parentId && !parent) {
      return actionError("That destination folder no longer exists.");
    }

    const skipped: string[] = [];
    const okIds: string[] = [];

    for (const id of ids) {
      const self = all.find((s) => s.id === id);
      if (!self) {
        skipped.push("a folder that no longer exists");
        continue;
      }
      if ((self.parent_id ?? null) === (parentId ?? null)) {
        continue; // already there — silently fine
      }
      if (parentId && descendantIds(all, id).has(parentId)) {
        skipped.push(`${self.name} (can’t go inside its own subfolder)`);
        continue;
      }
      if (parentId) {
        const newDepth = depthOf(all, parentId) + subtreeHeight(all, id);
        if (newDepth > MAX_SUBJECT_DEPTH) {
          skipped.push(`${self.name} (would nest too deep)`);
          continue;
        }
      }
      // clash against existing children AND against other folders in this batch
      const clash =
        nameClashesIn(all, parentId ?? null, self.name, id) ||
        okIds.some(
          (other) =>
            other !== id &&
            sameSubject(
              all.find((s) => s.id === other)?.name ?? "",
              self.name,
            ),
        );
      if (clash) {
        skipped.push(`${self.name} (name already used there)`);
        continue;
      }
      okIds.push(id);
    }

    if (okIds.length > 0) {
      const { error } = await supabase
        .from("subjects")
        .update({ parent_id: parentId })
        .in("id", okIds);
      if (error) return actionError(error.message);
    }

    revalidatePath("/dashboard");
    if (parentId) revalidatePath(`/subjects/${parentId}`);
    for (const id of okIds) {
      const prev = all.find((s) => s.id === id)?.parent_id;
      if (prev) revalidatePath(`/subjects/${prev}`);
    }

    return { ok: true, data: { moved: okIds.length, skipped } };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to move.");
  }
}

/**
 * Delete a folder. `mode: "cascade"` drops everything inside (DB cascade);
 * `mode: "reparent"` moves its cards and subfolders into `targetId` first.
 */
export async function deleteSubject(
  input: z.input<typeof deleteSubjectSchema>,
): Promise<ActionResult<null>> {
  const parsed = deleteSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, mode, targetId } = parsed.data;

  try {
    const { supabase, all } = await loadFlatSubjects();
    const self = all.find((s) => s.id === id);
    if (!self) return { ok: true, data: null }; // already gone
    const parentId = self.parent_id;

    if (mode === "reparent") {
      if (!targetId) return actionError("Choose where to move the contents.");
      const target = all.find((s) => s.id === targetId);
      if (!target) return actionError("That destination folder no longer exists.");
      if (targetId === id || descendantIds(all, id).has(targetId)) {
        return actionError("Pick a destination outside this folder.");
      }

      const movingChildren = childrenOf(all, id);
      // subfolders landing next to the target's existing children
      const clash = movingChildren.find((c) =>
        nameClashesIn(all, targetId, c.name, c.id),
      );
      if (clash) {
        return actionError(
          `“${clash.name}” already exists in the destination — rename it first.`,
        );
      }
      const deepest = Math.max(
        0,
        ...movingChildren.map((c) => subtreeHeight(all, c.id)),
      );
      if (deepest > 0 && depthOf(all, targetId) + deepest > MAX_SUBJECT_DEPTH) {
        return actionError(
          `Moving the subfolders there would exceed ${MAX_SUBJECT_DEPTH} levels.`,
        );
      }

      if (movingChildren.length > 0) {
        const { error } = await supabase
          .from("subjects")
          .update({ parent_id: targetId })
          .eq("parent_id", id);
        if (error) return actionError(error.message);
      }
      // every card of this folder, active or not
      const { error: cardErr } = await supabase
        .from("flashcards")
        .update({ subject_id: targetId })
        .eq("subject_id", id);
      if (cardErr) return actionError(cardErr.message);

      revalidatePath(`/subjects/${targetId}`);
    }

    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) return actionError(error.message);

    touch(id, parentId);
    return { ok: true, data: null };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to delete.");
  }
}

const suggestSubjectSchema = z
  .object({
    content: z.string().trim().max(4000).default(""),
    imageContext: z.string().trim().max(2000).default(""),
  })
  .refine((d) => d.content.length > 0 || d.imageContext.length > 0, {
    message: "Write a bit of content, or add an image, first.",
    path: ["content"],
  });

/**
 * AI-suggest a broad→specific subject path for a not-yet-saved flashcard —
 * the manual "Add flashcard" form's equivalent of the import flow's path
 * suggestions. Reuses `suggestPaths` (same AI method + rules as re-sort) and
 * `reusablePathsFor` for the reuse hints — nothing is created here; the
 * caller resolves the returned path via `resolvePath` only once the user
 * actually saves, so the suggestion never locks anyone into anything.
 */
export async function suggestFlashcardSubject(
  input: z.input<typeof suggestSubjectSchema>,
): Promise<ActionResult<{ path: string[] }>> {
  const parsed = suggestSubjectSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { supabase } = await requireUser();
    const tree = await getSubjectTree();
    const existingPaths = reusablePathsFor(flattenTree(tree));

    const text = [parsed.data.content, parsed.data.imageContext]
      .filter(Boolean)
      .join("\n\n");

    const [suggestion] = await getAIProvider().suggestPaths({
      cards: [{ id: "draft", title: "", content: text }],
      existingPaths,
    });
    await recordAiCall(supabase);

    if (!suggestion?.path?.length) {
      return actionError("Couldn’t come up with a suggestion for that yet.");
    }
    return { ok: true, data: { path: suggestion.path } };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t suggest a subject.",
    );
  }
}
