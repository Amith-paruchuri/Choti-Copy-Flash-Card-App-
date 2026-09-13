"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { applyRating, type RatingValue } from "@/lib/srs/fsrs";
import { isLeech } from "@/lib/srs/leech";
import { toMemory } from "@/lib/queries/review";
import { actionError, type ActionResult } from "@/actions/types";

const recordSchema = z.object({
  flashcardId: z.string().uuid(),
  rating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
  source: z.enum(["review", "quiz"]),
  questionId: z.string().uuid().nullable().optional(),
});

export interface ReviewResult {
  due: string;
  state: number;
  /** True when this rating just tripped the leech threshold. */
  suspended: boolean;
}

/**
 * Record one graded interaction — a deck self-rating or a quiz answer — and
 * advance the card's single FSRS memory state. A wrong quiz answer arrives
 * here as rating 1 ("Again"); there is no separate quiz scoring.
 */
export async function recordReview(
  input: z.input<typeof recordSchema>,
): Promise<ActionResult<ReviewResult>> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { flashcardId, rating, source, questionId } = parsed.data;
  if (source === "quiz" && !questionId) {
    return actionError("A quiz answer needs its question.");
  }

  try {
    const { user, supabase } = await requireUser();

    const { data: existing } = await supabase
      .from("card_memory")
      .select("*")
      .eq("flashcard_id", flashcardId)
      .maybeSingle();

    const now = new Date();
    const { memory, log } = applyRating(
      existing ? toMemory(existing) : null,
      rating as RatingValue,
      now,
    );

    // Auto-suspend a card as a leech the moment a fresh lapse pushes it over
    // the threshold. Never auto-unsuspend — that's a deliberate user action.
    const wasSuspended = existing?.suspended ?? false;
    const newLapse = memory.lapses > (existing?.lapses ?? 0);
    const suspend = wasSuspended || (newLapse && isLeech(memory.lapses));
    const justSuspended = suspend && !wasSuspended;

    const base = {
      user_id: user.id,
      flashcard_id: flashcardId,
      state: memory.state,
      due: memory.due,
      stability: memory.stability,
      difficulty: memory.difficulty,
      elapsed_days: memory.elapsed_days,
      scheduled_days: memory.scheduled_days,
      learning_steps: memory.learning_steps,
      reps: memory.reps,
      lapses: memory.lapses,
      last_review: memory.last_review,
    };
    const leechFields = {
      suspended: suspend,
      suspended_at: justSuspended
        ? now.toISOString()
        : (existing?.suspended_at ?? null),
    };

    let { error: upsertError } = await supabase
      .from("card_memory")
      .upsert({ ...base, ...leechFields }, { onConflict: "user_id,flashcard_id" });
    // Tolerate the leech migration (0014) not being applied yet — the review
    // itself must still go through.
    if (upsertError && /suspended/.test(upsertError.message)) {
      ({ error: upsertError } = await supabase
        .from("card_memory")
        .upsert(base, { onConflict: "user_id,flashcard_id" }));
    }
    if (upsertError) return actionError(upsertError.message);

    const { error: eventError } = await supabase.from("review_events").insert({
      user_id: user.id,
      flashcard_id: flashcardId,
      question_id: questionId ?? null,
      rating,
      source,
      log: log as unknown,
    });
    if (eventError) return actionError(eventError.message);

    revalidatePath("/dashboard");
    revalidatePath("/stats");
    revalidatePath("/leeches");
    return {
      ok: true,
      data: { due: memory.due, state: memory.state, suspended: justSuspended },
    };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Couldn’t save the review.");
  }
}
