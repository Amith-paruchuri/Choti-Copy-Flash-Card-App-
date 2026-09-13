"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import {
  createFlashcardSchema,
  moveFlashcardsSchema,
  updateFlashcardSchema,
} from "@/lib/validation";
import { imageAltText } from "@/lib/media/images";
import { resolvePath, resolveSubject } from "@/actions/subjects";
import { actionError, type ActionResult } from "@/actions/types";
import type { FlashcardImage, SourceType } from "@/types/database";
import type { z } from "zod";

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

type ImageInput = {
  path: string;
  hash: string;
  mime: string;
  bytes: number;
  alt: string;
};

/**
 * Record uploaded images in the user's dedup library. Best-effort: the image is
 * already in Storage and referenced from `flashcards.images`, so a failure here
 * (e.g. the row already exists) must not block saving the card. Plain inserts —
 * no `upsert`, which needs an UPDATE storage/table policy the schema doesn't
 * grant.
 */
async function recordMedia(
  supabase: Supabase,
  userId: string,
  images: ImageInput[],
): Promise<void> {
  const fresh = [...new Map(images.map((i) => [i.hash, i])).values()];
  for (const i of fresh) {
    const { error } = await supabase.from("media_objects").insert({
      user_id: userId,
      content_hash: i.hash,
      storage_path: i.path,
      mime: i.mime,
      bytes: i.bytes,
    });
    if (error && !/duplicate|already exists|23505/i.test(error.message)) {
      console.warn("media_objects insert failed:", error.message);
    }
  }
}

const toStoredImage = (i: ImageInput): FlashcardImage => ({
  path: i.path,
  hash: i.hash,
  mime: i.mime,
  alt: i.alt,
});

/** PostgREST message when a column (here `image_alt`, migration 0019) is absent. */
const missingImageAlt = (msg: string) => /image_alt/i.test(msg);
/** The pre-0019 constraint that still forbids a blank body. */
const contentCheckFailed = (msg: string) =>
  /flashcards_content_check/i.test(msg);

function withoutImageAlt<T extends { image_alt?: unknown }>(
  row: T,
): Omit<T, "image_alt"> {
  const { image_alt: _omit, ...rest } = row;
  void _omit;
  return rest;
}

type WriteResult = { error: { message: string } | null };
type CardWriteRow = {
  content: string;
  image_alt?: string | null;
  images?: FlashcardImage[];
};

/**
 * Persist a flashcard row, tolerating a database that's a migration behind:
 *   - `image_alt` missing (0019 not applied) → retry without it
 *   - blank body rejected (0019's relaxed content check not applied) → fall
 *     back to the image description as the body so the card still saves
 */
async function writeCard<R extends CardWriteRow>(
  run: (row: R) => PromiseLike<WriteResult>,
  row: R,
): Promise<WriteResult> {
  let { error } = await run(row);
  if (error && missingImageAlt(error.message)) {
    ({ error } = await run(withoutImageAlt(row) as R));
  }
  if (
    error &&
    contentCheckFailed(error.message) &&
    row.content.trim() === "" &&
    (row.images?.length ?? 0) > 0
  ) {
    const body =
      (typeof row.image_alt === "string" && row.image_alt) || "See image";
    return writeCard(run, { ...row, content: body });
  }
  return { error };
}

function revalidateCardViews(subjectId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/cards");
  if (subjectId) revalidatePath(`/subjects/${subjectId}`);
}

/**
 * Create a flashcard, assigning it to an existing subject (`subjectId`) or a
 * new/reused one (`newSubjectName`). Redirects to that subject's page.
 */
export async function createFlashcard(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = createFlashcardSchema.safeParse({
    content: formData.get("content"),
    title: formData.get("title") || undefined,
    subtitle: formData.get("subtitle") || undefined,
    sourceType: formData.get("sourceType") ?? "typed",
    subjectId: formData.get("subjectId") || undefined,
    newSubjectName: formData.get("newSubjectName") || undefined,
    newSubjectColor: formData.get("newSubjectColor") || undefined,
    newSubjectIcon: formData.get("newSubjectIcon") || undefined,
    path: formData.get("path"),
    images: formData.get("images"),
  });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  let subjectId: string;
  try {
    const { user, supabase } = await requireUser();
    subjectId = parsed.data.path?.length
      ? await resolvePath(parsed.data.path)
      : await resolveSubject({
          subjectId: parsed.data.subjectId,
          name: parsed.data.newSubjectName,
          color: parsed.data.newSubjectColor,
          icon: parsed.data.newSubjectIcon,
        });

    const images = parsed.data.images ?? [];
    await recordMedia(supabase, user.id, images);

    const sourceType: SourceType =
      images.length > 0 ? "image" : parsed.data.sourceType;
    const row = {
      user_id: user.id,
      subject_id: subjectId,
      content: parsed.data.content,
      title: parsed.data.title || null,
      subtitle: parsed.data.subtitle || null,
      source_type: sourceType,
      images: images.map(toStoredImage),
      image_alt: imageAltText(images),
    };
    const { error } = await writeCard(
      (r) => supabase.from("flashcards").insert(r),
      row,
    );
    if (error) return actionError(error.message);
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to save.");
  }

  revalidateCardViews(subjectId);
  redirect(`/subjects/${subjectId}`);
}

export async function updateFlashcard(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const rawMnemonic = formData.get("mnemonic");
  const parsed = updateFlashcardSchema.safeParse({
    id: formData.get("id"),
    content: formData.get("content"),
    title: formData.get("title") || undefined,
    subtitle: formData.get("subtitle") || undefined,
    subjectId: formData.get("subjectId"),
    mnemonic: typeof rawMnemonic === "string" ? rawMnemonic : undefined,
    images: formData.get("images"),
  });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const images = parsed.data.images;

  try {
    const { user, supabase } = await requireUser();

    if (images && images.length > 0) {
      await recordMedia(supabase, user.id, images);
    }

    const patch = {
      content: parsed.data.content,
      title: parsed.data.title || null,
      subtitle: parsed.data.subtitle || null,
      subject_id: parsed.data.subjectId,
      ...(parsed.data.mnemonic !== undefined && {
        mnemonic: parsed.data.mnemonic.trim() || null,
      }),
      ...(images !== undefined && {
        images: images.map(toStoredImage),
        image_alt: imageAltText(images),
      }),
    };
    const { error } = await writeCard(
      (r) => supabase.from("flashcards").update(r).eq("id", parsed.data.id),
      patch,
    );
    if (error) return actionError(error.message);
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to save.");
  }

  revalidateCardViews(parsed.data.subjectId);
  return { ok: true, data: null };
}

/**
 * Move one or more flashcards into a subject — nothing else changes. Powers the
 * per-card "Move to" control and multi-select move. No AI.
 */
export async function moveFlashcards(
  input: z.input<typeof moveFlashcardsSchema>,
): Promise<ActionResult<{ moved: number }>> {
  const parsed = moveFlashcardsSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { user, supabase } = await requireUser();

    const { data: dest } = await supabase
      .from("subjects")
      .select("id")
      .eq("id", parsed.data.subjectId)
      .maybeSingle();
    if (!dest) return actionError("That folder no longer exists.");

    const { data: moved, error } = await supabase
      .from("flashcards")
      .update({ subject_id: parsed.data.subjectId })
      .in("id", parsed.data.ids)
      .eq("user_id", user.id)
      .select("id");
    if (error) return actionError(error.message);

    revalidateCardViews(parsed.data.subjectId);
    return { ok: true, data: { moved: moved?.length ?? 0 } };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to move.");
  }
}

/** Soft delete — sets is_active = false, keeps the row. */
export async function softDeleteFlashcard(
  formData: FormData,
): Promise<ActionResult<null>> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return actionError("Missing flashcard id.");

  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("flashcards")
      .update({ is_active: false })
      .eq("id", id)
      .select("subject_id")
      .maybeSingle();
    if (error) return actionError(error.message);
    revalidateCardViews(data?.subject_id);
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Failed to delete.");
  }

  return { ok: true, data: null };
}
