"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getAIProvider } from "@/lib/ai";
import { mnemonicSchema } from "@/lib/validation";
import { recordAiCall } from "@/lib/usage/ai";
import { actionError, type ActionResult } from "@/actions/types";

const generateSchema = z.object({ flashcardId: z.string().uuid() });
const updateSchema = z.object({
  flashcardId: z.string().uuid(),
  mnemonic: mnemonicSchema,
});

/**
 * Ask the AI for a memory device for one card and store it on the row.
 * Called for the first "Generate a mnemonic" and again for "regenerate" — the
 * existing text (if any) is passed as `avoid` so a regenerate is genuinely new.
 */
export async function generateCardMnemonic(
  input: z.input<typeof generateSchema>,
): Promise<ActionResult<{ mnemonic: string }>> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { supabase } = await requireUser();

    const { data: card } = await supabase
      .from("flashcards")
      .select("id, subject_id, title, subtitle, content, mnemonic")
      .eq("id", parsed.data.flashcardId)
      .eq("is_active", true)
      .maybeSingle();
    if (!card) return actionError("That card no longer exists.");

    const { mnemonic } = await getAIProvider().generateMnemonic({
      title: card.title ?? "",
      subtitle: card.subtitle ?? "",
      content: card.content,
      avoid: card.mnemonic ?? undefined,
    });
    await recordAiCall(supabase);

    const { error } = await supabase
      .from("flashcards")
      .update({ mnemonic })
      .eq("id", card.id);
    if (error) return actionError(error.message);

    revalidatePath(`/subjects/${card.subject_id}`);
    revalidatePath("/dashboard");
    return { ok: true, data: { mnemonic } };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t make a mnemonic.",
    );
  }
}

/** Save a hand-edited mnemonic (or clear it with an empty string). */
export async function updateCardMnemonic(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult<{ mnemonic: string | null }>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const value = parsed.data.mnemonic.trim() || null;

  try {
    const { supabase } = await requireUser();
    const { error } = await supabase
      .from("flashcards")
      .update({ mnemonic: value })
      .eq("id", parsed.data.flashcardId);
    if (error) return actionError(error.message);

    revalidatePath("/dashboard");
    return { ok: true, data: { mnemonic: value } };
  } catch (e) {
    return actionError(
      e instanceof Error ? e.message : "Couldn’t save the mnemonic.",
    );
  }
}
