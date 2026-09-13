import "server-only";

import { createClient } from "@/lib/supabase/server";
import { descendantIds } from "@/lib/subjects/tree-ops";
import type { QuizQuestion } from "@/types/database";

/**
 * Expand a set of subject ids to include every descendant subject. Pass an
 * empty array (or nothing) to get every subject the user owns.
 */
export async function expandSubjectScope(
  subjectIds: string[],
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("id, name, parent_id");
  const all = data ?? [];

  if (subjectIds.length === 0) {
    return new Set(all.map((s) => s.id));
  }

  const scope = new Set<string>();
  for (const id of subjectIds) {
    scope.add(id);
    for (const d of descendantIds(all, id)) scope.add(d);
  }
  return scope;
}

/** Existing quiz questions for a set of flashcards (RLS-scoped to the user). */
export async function getQuizQuestions(
  flashcardIds: string[],
): Promise<QuizQuestion[]> {
  if (flashcardIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_questions")
    .select("*")
    .in("flashcard_id", flashcardIds)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** How many of a subject's active cards already have a quiz question. */
export async function getSubjectQuizCoverage(subjectId: string): Promise<{
  cards: number;
  withQuestion: number;
}> {
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("flashcards")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("is_active", true);
  const ids = (cards ?? []).map((c) => c.id);
  if (ids.length === 0) return { cards: 0, withQuestion: 0 };

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("flashcard_id")
    .in("flashcard_id", ids);
  const covered = new Set((questions ?? []).map((q) => q.flashcard_id));
  return { cards: ids.length, withQuestion: covered.size };
}
