import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-sm space-y-6 px-4 py-12">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Set a new password
        </h1>
        <p className="text-muted-foreground text-sm">
          You’re signed in from the reset link. Choose a new password to finish.
        </p>
      </div>
      <ResetPasswordForm />
    </main>
  );
}
