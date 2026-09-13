"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { expandSubjectScope } from "@/lib/queries/quiz";
import { recordAiCall } from "@/lib/usage/ai";
import { actionError, type ActionResult } from "@/actions/types";

const CANDIDATE_CAP = 60;

const findSchema = z.object({ flashcardId: z.string().uuid() });
const removeSchema = z.object({
  flashcardId: z.string().uuid(),
  relatedId: z.string().uuid(),
});

/**
 * Ask the AI which of the learner's other cards relate to this one and store
 * the links. Candidates are drawn first from the card's own subject subtree,
 * then topped up from the rest of the deck (cap 60) so a cross-branch link is
 * still possible without blowing up the prompt.
 */
export async function findRelatedCards(
  input: z.input<typeof findSchema>,
): Promise<ActionResult<{ added: number }>> {
  const parsed = findSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { user, supabase } = await requireUser();

    const { data: card } = await supabase
      .from("flashcards")
      .select("id, subject_id, title, content")
      .eq("id", parsed.data.flashcardId)
      .eq("is_active", true)
      .maybeSingle();
    if (!card) return actionError("That card no longer exists.");

    const [{ data: all }, scope, { data: existing }] = await Promise.all([
      supabase
        .from("flashcards")
        .select("id, title, subtitle, subject_id")
        .eq("is_active", true),
      expandSubjectScope([card.subject_id]),
      supabase
        .from("flashcard_links")
        .select("related_id")
        .eq("flashcard_id", card.id),
    ]);

    const others = (all ?? []).filter((c) => c.id !== card.id);
    if (others.length === 0) {
      return actionError("Add a few more cards first — nothing to link to yet.");
    }
    others.sort((a, b) => {
      const ai = scope.has(a.subject_id) ? 0 : 1;
      const bi = scope.has(b.subject_id) ? 0 : 1;
      return ai - bi;
    });
    const candidates = others.slice(0, CANDIDATE_CAP).map((c) => ({
      id: c.id,
      title: c.title ?? "",
      subtitle: c.subtitle ?? "",
    }));

    const links = await getAIProvider().findRelated({
      card: { id: card.id, title: card.title ?? "", content: card.content },
      candidates,
    });
    await recordAiCall(supabase);

    const have = new Set((existing ?? []).map((r) => r.related_id));
    const rows = links
      .filter((l) => !have.has(l.relatedId))
      .map((l) => ({
        user_id: user.id,
        flashcard_id: card.id,
        related_id: l.relatedId,
        relation: l.relation || null,
        source: "ai" as const,
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from("flashcard_links").insert(rows);
      if (error) return actionError(error.message);
    }

    revalidatePath(`/subjects/${card.subject_id}`);
    return { ok: true, data: { added: rows.length } };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t find related concepts.",
    );
  }
}

/** Drop a link (either direction) — the manual override. */
export async function removeCardLink(
  input: z.input<typeof removeSchema>,
): Promise<ActionResult<null>> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { flashcardId, relatedId } = parsed.data;

  try {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("flashcard_links")
      .delete()
      .or(
        `and(flashcard_id.eq.${flashcardId},related_id.eq.${relatedId}),` +
          `and(flashcard_id.eq.${relatedId},related_id.eq.${flashcardId})`,
      );
    if (error) return actionError(error.message);

    revalidatePath("/dashboard");
    return { ok: true, data: null };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t remove the link.",
    );
  }
}
