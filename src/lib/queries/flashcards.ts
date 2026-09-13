import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/anki/constants";
import { remapSubjectColor } from "@/lib/subject-color";
import type { Flashcard } from "@/types/database";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type FlashcardWithSubject = Flashcard & {
  subject: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  /** Signed URLs for `images`, resolved for the current request. */
  imageUrls: string[];
};

/** Turn each card's stored image paths into short-lived signed URLs. */
async function withImageUrls<T extends Flashcard>(
  supabase: Supabase,
  cards: T[],
): Promise<(T & { imageUrls: string[] })[]> {
  const paths = [
    ...new Set(cards.flatMap((c) => (c.images ?? []).map((i) => i.path))),
  ];
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(paths, 60 * 60 * 24 * 7);
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) urlByPath.set(row.path, row.signedUrl);
    }
  }
  return cards.map((c) => ({
    ...c,
    imageUrls: (c.images ?? [])
      .map((i) => urlByPath.get(i.path))
      .filter((u): u is string => Boolean(u)),
  }));
}

/** Active flashcards for the user, newest first, optionally filtered to one subject. */
export async function listFlashcards(
  opts: { subjectId?: string; limit?: number } = {},
): Promise<FlashcardWithSubject[]> {
  const supabase = await createClient();

  let query = supabase
    .from("flashcards")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (opts.subjectId) query = query.eq("subject_id", opts.subjectId);
  if (opts.limit) query = query.limit(opts.limit);

  const { data: cards } = await query;
  if (!cards?.length) return [];

  const subjectIds = [...new Set(cards.map((c) => c.subject_id))];
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, color, icon")
    .in("id", subjectIds);

  const byId = new Map(
    (subjects ?? []).map((s) => [
      s.id,
      { ...s, color: remapSubjectColor(s.color) },
    ]),
  );
  const withUrls = await withImageUrls(supabase, cards);
  return withUrls.map((c) => ({
    ...c,
    subject: byId.get(c.subject_id) ?? null,
  }));
}

export async function getFlashcard(id: string): Promise<Flashcard | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("flashcards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}
