"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { studyPacingSchema } from "@/lib/validation";
import { actionError, type ActionResult } from "@/actions/types";

const MISSING_TABLE = /user_settings|does not exist|schema cache/i;

/**
 * Save the caller's study-pacing settings (Account → "Study pacing").
 * Soft-fails if migration 0020 isn't applied yet — the app keeps working on
 * defaults, so don't surface a scary error.
 */
export async function updateStudyPacing(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = studyPacingSchema.safeParse({
    newCardsPerDay: formData.get("newCardsPerDay"),
    dailyReviewTarget: formData.get("dailyReviewTarget"),
  });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  try {
    const { user, supabase } = await requireUser();
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        new_cards_per_day: parsed.data.newCardsPerDay,
        daily_review_target: parsed.data.dailyReviewTarget,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      if (MISSING_TABLE.test(error.message)) {
        return actionError(
          "Study-pacing settings need a quick database migration (0020) first.",
        );
      }
      return actionError(error.message);
    }
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Couldn’t save.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/review");
  revalidatePath("/account");
  return { ok: true, data: null };
}
