"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
} from "@/lib/validation";
import { actionError, type ActionResult } from "@/actions/types";

/** Update the display name stored in Supabase Auth user metadata. */
export async function updateDisplayName(
  name: string,
): Promise<ActionResult<null>> {
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid name.");
  }

  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: parsed.data },
    });
    if (error) return actionError(error.message);
    revalidatePath("/account");
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Couldn’t save.");
  }
}

/** Change the password of the currently signed-in user. */
export async function updatePassword(
  password: string,
): Promise<ActionResult<null>> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid password.");
  }

  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data,
    });
    if (error) return actionError(error.message);
    return { ok: true, data: null };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Couldn’t update.");
  }
}

/**
 * Start an email change. Supabase emails a confirmation link to the new
 * address (and, with "Secure email change" on, the old one too); the address
 * only updates once confirmed.
 */
export async function requestEmailChange(
  email: string,
): Promise<ActionResult<null>> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid email.");
  }

  try {
    const { user, supabase } = await requireUser();
    if (parsed.data === user.email) {
      return actionError("That’s already your email.");
    }
    const { error } = await supabase.auth.updateUser({ email: parsed.data });
    if (error) return actionError(error.message);
    return { ok: true, data: null };
  } catch (e) {
    return actionError(e instanceof Error ? e.message : "Couldn’t start the change.");
  }
}
