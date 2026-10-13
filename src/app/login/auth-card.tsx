"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import {
  resendSignupCode,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  verifySignupCode,
  type AuthState,
} from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EASE_OUT, SPRING_SNAPPY } from "@/lib/motion";

const EMPTY: AuthState = {};

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function SubmitButton({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={pending || disabled}
    >
      {pending ? "Working…" : label}
    </Button>
  );
}

export function AuthCard({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const reduce = useReducedMotion();
  const action =
    mode === "signin"
      ? signInWithPassword
      : mode === "signup"
        ? signUpWithPassword
        : sendPasswordReset;
  const [state, formAction] = useActionState(action, EMPTY);

  // Existing account found on signup: flip to the sign-in tab (state adjusted
  // during render, the React-sanctioned alternative to setState in an effect).
  const [seenState, setSeenState] = useState<AuthState>(EMPTY);
  if (state !== seenState) {
    setSeenState(state);
    if (state.existing) setMode("signin");
  }

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verifyState, verifyAction] = useActionState(verifySignupCode, EMPTY);
  const [resendState, resendAction] = useActionState(resendSignupCode, EMPTY);

  // Signup succeeded and a code was emailed: show the PIN step.
  const [seenSignup, setSeenSignup] = useState<AuthState>(EMPTY);
  if (state !== seenSignup) {
    setSeenSignup(state);
    if (state.verifyEmail) setPendingEmail(state.verifyEmail);
  }

  useEffect(() => {
    if (verifyState.error) toast.error(verifyState.error);
  }, [verifyState]);
  useEffect(() => {
    if (resendState.error) toast.error(resendState.error);
    if (resendState.message) toast.success(resendState.message);
  }, [resendState]);

  useEffect(() => {
    if (initialError) toast.error(initialError);
  }, [initialError]);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
  }, [state]);

  return (
    <div className="border-border bg-card text-card-foreground w-full space-y-5 rounded-xl border p-6 shadow-sm">
      {/* Primary path: Google. Prominent, above the fold. */}
      <form action={signInWithGoogle} className="space-y-1.5">
        <input type="hidden" name="next" value={next} />
        <Button
          type="submit"
          size="lg"
          variant="outline"
          className="border-border hover:bg-secondary h-11 w-full gap-2.5 text-[0.95rem] font-medium shadow-sm"
        >
          <GoogleGlyph />
          Continue with Google
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          Fastest way in — no password to remember.
        </p>
      </form>

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">
          or use your email
        </span>
        <span className="bg-border h-px flex-1" />
      </div>

      {pendingEmail ? (
        <motion.div
          className="space-y-4"
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={SPRING_SNAPPY}
        >
          <form action={verifyAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="email" value={pendingEmail} />
            <div className="space-y-1">
              <p className="text-sm font-medium">Check your email</p>
              <p className="text-muted-foreground text-xs">
                We sent a 6-digit code to {pendingEmail}. Enter it to finish
                creating your account.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="123456"
                className="text-center text-lg tracking-[0.4em]"
              />
            </div>
            <SubmitButton label="Verify and create account" />
          </form>
          <div className="flex items-center justify-between text-xs">
            <form action={resendAction}>
              <input type="hidden" name="email" value={pendingEmail} />
              <button
                type="submit"
                className="text-ink font-medium hover:underline"
              >
                Resend code
              </button>
            </form>
            <button
              type="button"
              onClick={() => setPendingEmail(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Use a different email
            </button>
          </div>
        </motion.div>
      ) : mode !== "reset" ? (
        <>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "signin" | "signup")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Create account
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-ink text-xs font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>

            <AnimatePresence initial={false}>
              {mode === "signup" && (
                <motion.div
                  key="confirm"
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{
                    height: "auto",
                    opacity: 1,
                    transition: { duration: 0.28, ease: EASE_OUT },
                  }}
                  exit={{
                    height: 0,
                    opacity: 0,
                    transition: { duration: 0.2, ease: EASE_OUT },
                  }}
                  style={{ overflow: "hidden" }}
                  className="-mx-1 px-1"
                >
                  <div className="space-y-1.5 pb-1">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Re-enter your password"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === "signup" && (
              <label className="text-muted-foreground flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 size-3.5"
                />
                <span>
                  I agree to the{" "}
                  <a
                    href="/legal/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink underline"
                  >
                    Terms
                  </a>{" "}
                  and{" "}
                  <a
                    href="/legal/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink underline"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            )}

            <SubmitButton
              label={mode === "signin" ? "Sign in" : "Create account"}
              disabled={mode === "signup" && !acceptedTerms}
            />
          </form>
        </>
      ) : (
        <form action={formAction} className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Reset your password</p>
            <p className="text-muted-foreground text-xs">
              Enter your email and we&rsquo;ll send a link to set a new one.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Enter your email"
            />
          </div>
          <SubmitButton label="Send reset link" />
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="text-muted-foreground hover:text-foreground w-full text-center text-xs"
          >
            ← Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
