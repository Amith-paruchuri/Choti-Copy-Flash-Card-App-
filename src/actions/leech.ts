"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { actionError, type ActionResult } from "@/actions/types";

const schema = z.object({
  flashcardId: z.string().uuid(),
  suspended: z.boolean(),
});

/**
 * Manually suspend a card as a leech, or reactivate one. Reactivating keeps
 * the lapse history — it just puts the card back in rotation; it'll suspend
 * again on the next lapse if it stays over the threshold.
 */
export async function setCardSuspended(
  input: z.input<typeof schema>,
): Promise<ActionResult<null>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { flashcardId, suspended } = parsed.data;

  try {
    const { user, supabase } = await requireUser();

    // A card with no memory row yet can't be a leech; make one only when
    // suspending (RLS + the FK keep it honest).
    const { error } = await supabase.from("card_memory").upsert(
      {
        user_id: user.id,
        flashcard_id: flashcardId,
        suspended,
        suspended_at: suspended ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,flashcard_id" },
    );
    if (error) return actionError(error.message);

    revalidatePath("/leeches");
    revalidatePath("/dashboard");
    revalidatePath("/stats");
    return { ok: true, data: null };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t update the card.",
    );
  }
}
