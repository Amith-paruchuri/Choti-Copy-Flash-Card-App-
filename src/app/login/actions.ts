"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { siteUrl, TERMS_VERSION } from "@/lib/env";
import { credentialsSchema, emailSchema } from "@/lib/validation";

export type AuthState = { error?: string; message?: string };

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Only allow internal, absolute paths — never an open redirect.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function originFromHeaders(): Promise<string> {
  const h = await headers();

  // A same-origin server-action POST carries an Origin header — trust it first
  // so a reset/confirm link points back at whatever host the user is on
  // (localhost, a LAN IP like 192.168.x.x, a tunnel domain, …).
  const origin = h.get("origin");
  if (origin) return origin;

  // Some clients/proxies drop Origin — reconstruct it from the host headers.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  // Last resort: the configured canonical URL.
  return siteUrl();
}

export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Wrong email or password." };

  redirect(safeNext(formData.get("next")));
}

export async function signUpWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const accepted = formData.get("acceptTerms");
  if (accepted !== "on" && accepted !== "true") {
    return { error: "Please accept the Terms and Privacy Policy to continue." };
  }

  const next = safeNext(formData.get("next"));
  const origin = await originFromHeaders();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }
  // Email confirmation on → no session yet.
  if (!data.session) {
    return {
      message: "Check your email for a confirmation link to finish signing up.",
    };
  }

  redirect(next);
}

export async function sendPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  // Same response whether or not the address has an account — don't leak it.
  const done: AuthState = {
    message: "If that email has an account, a reset link is on its way.",
  };
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  }

  const origin = await originFromHeaders();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/account/reset-password`,
  });
  return done;
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const origin = await originFromHeaders();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent("Google sign-in failed.")}`);
  }
  redirect(data.url);
}
