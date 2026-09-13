"use server";

import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getAIProvider, AIError } from "@/lib/ai";
import { imageDataUrl } from "@/lib/media/server";
import { recordAiCall } from "@/lib/usage/ai";
import { actionError, type ActionResult } from "@/actions/types";

const schema = z.object({
  /** Storage key under the flashcard-media bucket: `<uid>/<hash>`. */
  storagePath: z.string().min(1).max(300),
  mime: z.string().min(1).max(80).optional(),
  /** The card's header / typed text so the description stays on-topic. */
  cardContext: z.string().trim().max(1000).optional(),
});

/**
 * Ask the vision model for a keyword-dense description of an already-uploaded
 * card image. Called from the upload UI once per image; the result is stored on
 * the card (in `images[].alt` + the denormalised `image_alt`) when the form is
 * saved. Never throws for the caller — a failed description just comes back
 * empty and the image still saves.
 */
export async function describeCardImage(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ description: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { user, supabase } = await requireUser();
    // The path must be in the caller's own folder (Storage RLS enforces this
    // too, but fail fast and clearly).
    if (!parsed.data.storagePath.startsWith(`${user.id}/`)) {
      return actionError("That image isn’t yours.");
    }

    const dataUrl = await imageDataUrl(
      supabase,
      parsed.data.storagePath,
      parsed.data.mime,
    );
    if (!dataUrl) return actionError("Couldn’t read that image back.");

    const { description } = await getAIProvider().describeImage({
      dataUrl,
      cardContext: parsed.data.cardContext,
    });
    await recordAiCall(supabase);
    return { ok: true, data: { description } };
  } catch (e) {
    if (e instanceof AIError) return actionError(e.message);
    return actionError(
      e instanceof Error ? e.message : "Couldn’t describe that image.",
    );
  }
}
