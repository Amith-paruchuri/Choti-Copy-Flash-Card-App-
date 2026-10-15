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
import { formatBillingDate } from "@/lib/billing/tier";

export function CancelSubscriptionButton({
  currentPeriodEnd,
  trial = false,
}: {
  currentPeriodEnd: string | null;
  /** On a free trial: turning autopay off means no charge ever happens. */
  trial?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const endsCopy = currentPeriodEnd
    ? formatBillingDate(currentPeriodEnd)
    : "the end of your current billing period";

  function confirm() {
    start(async () => {
      const res = await cancelSubscription();
      setOpen(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        trial
          ? `Autopay is off — your trial runs until ${endsCopy}, and you won't be charged.`
          : `Subscription canceled — Pro continues until ${endsCopy}.`,
      );
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
        {trial ? "Turn off autopay" : "Cancel subscription"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {trial ? "Turn off autopay?" : "Cancel your Pro subscription?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {trial
                ? `You keep your free trial through ${endsCopy} and you won't be charged. You can subscribe any time.`
                : `You'll keep Pro access through ${endsCopy}, with no more charges after that. You can resubscribe any time.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {trial ? "Keep autopay on" : "Keep my subscription"}
            </AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={confirm}>
              {pending
                ? "Canceling…"
                : trial
                  ? "Turn off autopay"
                  : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
