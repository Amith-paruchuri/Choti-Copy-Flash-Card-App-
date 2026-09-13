"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateStudyPacing } from "@/actions/settings";
import type { ActionResult } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StudyPacing } from "@/lib/queries/settings";

const START: ActionResult<null> | null = null;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

export function StudyPacingForm({ pacing }: { pacing: StudyPacing }) {
  const router = useRouter();
  const [state, action] = useActionState(updateStudyPacing, START);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Study pacing saved.");
      router.refresh();
    } else {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="newCardsPerDay">New cards per day</Label>
        <Input
          id="newCardsPerDay"
          name="newCardsPerDay"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          defaultValue={pacing.newCardsPerDay}
          className="h-9 w-28"
        />
        <p className="text-muted-foreground text-xs">
          The most brand-new cards introduced in a day, across every session.
          Anki&rsquo;s default is 20.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dailyReviewTarget">Daily review goal</Label>
        <Input
          id="dailyReviewTarget"
          name="dailyReviewTarget"
          type="number"
          inputMode="numeric"
          min={1}
          max={2000}
          defaultValue={pacing.dailyReviewTarget ?? ""}
          placeholder="No goal"
          className="h-9 w-28"
        />
        <p className="text-muted-foreground text-xs">
          Cards to aim for each day (due + new combined). Shown as a progress bar
          on the dashboard. Leave blank for no goal.
        </p>
      </div>

      <SaveButton />
    </form>
  );
}
