import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

import { ConceptGraphView } from "@/components/concept-graph-view";
import { DueBreakdown } from "@/components/due-breakdown";
import { FsrsExplainer } from "@/components/fsrs-explainer";
import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { getConceptGraph } from "@/lib/queries/graph";
import { getDailyProgress, totalOverdue } from "@/lib/queries/review";
import { dueSummary } from "@/lib/review-copy";

export const metadata: Metadata = { title: "Review" };

const PRESETS = [10, 20, 50];

export default async function ReviewPage() {
  const [progress, graph] = await Promise.all([
    getDailyProgress(),
    getConceptGraph(),
  ]);
  const { due, newAvailable, availableToday, pacing, reviewedToday } = progress;
  const summary = dueSummary(
    { dueToday: due.dueToday, overdue: totalOverdue(due) },
    newAvailable,
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-10 px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <span className="bg-ink-tint text-ink mx-auto grid size-12 place-items-center rounded-xl">
            <GraduationCap className="size-6" />
          </span>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Review session
          </h1>
          <FsrsExplainer />
          <p className="text-muted-foreground text-sm">
            {availableToday > 0 ? (
              <>
                <span className="text-foreground font-medium">{summary}</span>{" "}
                <InfoTip>
                  <p>
                    <strong className="text-foreground">Due today</strong> —
                    cards scheduled for today.
                  </p>
                  <p>
                    <strong className="text-foreground">Overdue</strong> —
                    cards that became due on an earlier day you didn&rsquo;t get
                    to. They don&rsquo;t disappear, they just wait for you —
                    the table below shows how long each group has been
                    waiting.
                  </p>
                  <p>
                    <strong className="text-foreground">New</strong> — cards
                    you haven&rsquo;t studied yet, introduced at your daily
                    pace.
                  </p>
                </InfoTip>{" "}
                · rate each card and the schedule adjusts.
              </>
            ) : (
              "Nothing due right now — you can still review ahead."
            )}
          </p>
          {pacing.dailyReviewTarget != null && (
            <p className="text-muted-foreground text-xs">
              {reviewedToday} of {pacing.dailyReviewTarget} reviewed today
            </p>
          )}
          <DueBreakdown
            dueToday={due.dueToday}
            overdue1to2={due.overdue1to2}
            overdue3to6={due.overdue3to6}
            overdue7to13={due.overdue7to13}
            overdue14plus={due.overdue14plus}
            newAvailable={newAvailable}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((n) => (
            <Button key={n} asChild variant="outline" className="h-16 flex-col">
              <Link href={`/review/session?n=${n}`}>
                <span className="text-lg font-semibold">{n}</span>
                <span className="text-muted-foreground text-xs">cards</span>
              </Link>
            </Button>
          ))}
        </div>

        {availableToday > PRESETS[0] && (
          <Button asChild size="lg" className="w-full">
            <Link href={`/review/session?n=${availableToday}`}>
              Review all {availableToday} ready
            </Link>
          </Button>
        )}
      </div>

      {graph.nodes.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
                <span className="bg-highlight size-1.5 rounded-full" />
                Your concept map
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Every card by subject — colour is how well you know it, size is
                how often you&rsquo;ve reviewed it.
              </p>
            </div>
            <Link
              href="/map"
              className="text-ink hover:text-ink/80 inline-flex flex-none items-center gap-1 text-sm font-medium transition"
            >
              Full map <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="h-[24rem] sm:h-[30rem]">
            <ConceptGraphView graph={graph} />
          </div>
        </section>
      )}
    </main>
  );
}
