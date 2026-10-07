"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cancelSubscription } from "@/actions/billing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function CancelSubscriptionButton({
  currentPeriodEnd,
}: {
  currentPeriodEnd: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const endsCopy = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString()
    : "the end of your current billing period";

  function confirm() {
    start(async () => {
      const res = await cancelSubscription();
      setOpen(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Subscription canceled — Pro continues until ${endsCopy}.`);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Cancel subscription
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your Pro subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You&rsquo;ll keep Pro access through {endsCopy} — no more charges
              after that. You can resubscribe any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my subscription</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={confirm}>
              {pending ? "Canceling…" : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
