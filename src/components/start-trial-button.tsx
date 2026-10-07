"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { startTrial } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shown only where the caller has already checked `canStartTrial()` — this
 * component doesn't re-check eligibility itself, since the DB function
 * (`start_trial()`, migration 0022) is the single source of truth and will
 * just no-op with a friendly error if called when ineligible.
 */
export function StartTrialButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await startTrial();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const ends = new Date(res.data.trialEndsAt).toLocaleDateString();
      toast.success(`Trial started — Pro features until ${ends}.`);
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={run}
      className={cn(className)}
    >
      {pending ? "Starting…" : "Start 15-day free trial"}
    </Button>
  );
}
