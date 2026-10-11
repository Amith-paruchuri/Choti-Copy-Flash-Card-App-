"use server";

import { resolveMx, resolve4 } from "node:dns/promises";
import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { isBlockedEmailDomain } from "@/lib/auth/blocked-email-domains";
import { createClient } from "@/lib/supabase/server";
import { siteUrl, TERMS_VERSION } from "@/lib/env";
import { credentialsSchema, emailSchema } from "@/lib/validation";

export type AuthState = {
  error?: string;
  message?: string;
  /** Signup hit an address that already has an account: UI switches to sign in. */
  existing?: boolean;
  /** Signup created, waiting for the emailed code: UI shows the PIN step. */
  verifyEmail?: string;
};

/**
 * True when the email's domain can receive mail (MX, or an A record as the
 * SMTP fallback). Catches typos and invented domains (gmial.con, asdf.xyz)
 * before we create anything. It cannot prove a specific mailbox exists; the
 * confirmation email does that.
 */
async function domainCanReceiveMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  const withTimeout = <T,>(p: Promise<T>) =>
    Promise.race<T>([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error("dns timeout")), 4000)),
    ]);
  try {
    const mx = await withTimeout(resolveMx(domain));
    if (mx.length > 0) return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    // Transient lookup trouble: do not block a real user over our DNS hiccup.
    if (code !== "ENOTFOUND" && code !== "ENODATA") return true;
  }
  try {
    const a = await withTimeout(resolve4(domain));
    return a.length > 0;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return code !== "ENOTFOUND" && code !== "ENODATA";
  }
}

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

  const confirm = formData.get("confirmPassword");
  if (typeof confirm !== "string" || confirm !== parsed.data.password) {
    return { error: "Passwords do not match." };
  }

  if (isBlockedEmailDomain(parsed.data.email)) {
    return { error: "Please use a real email address." };
  }

  if (!(await domainCanReceiveMail(parsed.data.email))) {
    return {
      error:
        "That email address does not look real. Check for typos and use an email you can open.",
    };
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
  // Supabase hides existing accounts: signUp "succeeds" but returns a user
  // with no identities. Detect that and send them to sign in instead.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      error:
        "An account with this email already exists. Sign in instead, or use Forgot password.",
      existing: true,
    };
  }
  // Email confirmation on → no session yet.
  if (!data.session) {
    return {
      message: "We emailed you a 6-digit code. Enter it to finish signing up.",
      verifyEmail: parsed.data.email,
    };
  }

  redirect(next);
}

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from your email.");

export async function verifySignupCode(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const code = codeSchema.safeParse(formData.get("code"));
  if (!email.success) return { error: "Start signup again." };
  if (!code.success) {
    return {
      error: code.error.issues[0]?.message ?? "Enter the 6-digit code.",
      verifyEmail: email.data,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "signup",
  });
  if (error) {
    return {
      error: "That code is wrong or has expired. Check it or request a new one.",
      verifyEmail: email.data,
    };
  }

  redirect(safeNext(formData.get("next")));
}

export async function resendSignupCode(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Start signup again." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
  });
  if (error) {
    return {
      error: "Could not resend yet. Wait a minute and try again.",
      verifyEmail: email.data,
    };
  }
  return { message: "New code sent.", verifyEmail: email.data };
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
