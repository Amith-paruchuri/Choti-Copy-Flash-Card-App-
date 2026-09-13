import Link from "next/link";
import { Check, GraduationCap } from "lucide-react";

import { DueBreakdown } from "@/components/due-breakdown";
import { type DailyProgress, totalOverdue } from "@/lib/queries/review";
import { dueSummary } from "@/lib/review-copy";

/**
 * The dashboard "Start studying" hero. Three states:
 *   no goal set  → due breakdown + "weak spots mixed in"
 *   goal not met → "18 of 30 today — 12 to go" + progress bar
 *   goal met     → "Today's goal is done" + a softer "Keep going"
 */
export function DailyStudyBanner({ progress }: { progress: DailyProgress }) {
  const { pacing, due, reviewedToday, newAvailable, suggestedSessionSize, goalMet } =
    progress;
  const target = pacing.dailyReviewTarget;
  const href = `/review/session?n=${suggestedSessionSize}&smart=1`;
  const overdue = totalOverdue(due);

  const hasGoal = target != null;
  const toGo = hasGoal ? Math.max(0, target - reviewedToday) : 0;
  const pct = hasGoal
    ? Math.min(100, Math.round((reviewedToday / target) * 100))
    : 0;

  let title: string;
  let subline: string;
  if (!hasGoal) {
    title = "Start studying";
    const nothing = due.dueToday + overdue + newAvailable === 0;
    subline = nothing
      ? "A mix of what needs the most work"
      : `${dueSummary({ dueToday: due.dueToday, overdue }, newAvailable)} · weak spots mixed in`;
  } else if (!goalMet) {
    title = "Start studying";
    subline = `${reviewedToday} of ${target} today — ${toGo} to go`;
  } else {
    title = "Today’s goal is done";
    subline = `${reviewedToday} reviewed · review ahead?`;
  }

  return (
    <div className="space-y-1.5">
      <Link
        href={href}
        className="bg-primary text-primary-foreground flex items-center justify-between gap-3 rounded-xl border border-transparent px-4 py-3.5 transition hover:brightness-105"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 flex-none place-items-center rounded-lg bg-white/15">
            {goalMet ? (
              <Check className="size-5" />
            ) : (
              <GraduationCap className="size-5" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block truncate text-xs opacity-80">{subline}</span>
          </span>
        </span>
        <span className="flex-none text-sm font-semibold">
          {goalMet ? "Keep going →" : "Go →"}
        </span>
      </Link>

      {!hasGoal && overdue > 0 && (
        <DueBreakdown
          dueToday={due.dueToday}
          overdue1to2={due.overdue1to2}
          overdue3to6={due.overdue3to6}
          overdue7to13={due.overdue7to13}
          overdue14plus={due.overdue14plus}
          newAvailable={newAvailable}
        />
      )}

      {hasGoal && (
        <div
          className="bg-ink-tint h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={reviewedToday}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={`${reviewedToday} of ${target} cards reviewed today`}
        >
          <div
            className={goalMet ? "bg-sage h-full" : "bg-highlight h-full"}
            style={{ width: `${Math.max(pct, reviewedToday > 0 ? 4 : 0)}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-1 text-xs">
        <Link
          href="/review"
          className="text-muted-foreground hover:text-foreground transition"
        >
          or choose count &amp; subjects →
        </Link>
        {hasGoal && (
          <Link
            href="/account"
            className="text-muted-foreground hover:text-foreground transition"
          >
            adjust goal →
          </Link>
        )}
      </div>
    </div>
  );
}
