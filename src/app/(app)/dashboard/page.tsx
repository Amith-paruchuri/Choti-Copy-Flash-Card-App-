import type { Metadata } from "next";
import Link from "next/link";
import { BookText } from "lucide-react";

import { HomeGreeting } from "@/components/home-greeting";
import { DailyStudyBanner } from "@/components/daily-study-banner";
import { FolderDialog } from "@/components/folder-dialog";
import { SubjectIcon } from "@/components/subject-icon";
import { RecallStrip } from "@/components/recall-strip";
import { SubjectGridManager } from "@/components/subject-grid-manager";
import { Button } from "@/components/ui/button";
import {
  getResortCandidates,
  listSubjectsForPicker,
  listSubjectsWithCounts,
} from "@/lib/queries/subjects";
import { getActivityHeatmap } from "@/lib/queries/activity";
import { createClient } from "@/lib/supabase/server";
import { getStats } from "@/lib/queries/stats";
import { getRecallCards } from "@/lib/queries/recall";
import { getDailyProgress } from "@/lib/queries/review";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [
    subjects,
    allSubjects,
    recall,
    resortCandidates,
    progress,
    activity,
    stats,
    { data: auth },
  ] = await Promise.all([
      listSubjectsWithCounts(),
      listSubjectsForPicker(),
      getRecallCards(),
      getResortCandidates(),
      getDailyProgress(),
      getActivityHeatmap(4),
      getStats(),
      supabase.auth.getUser(),
    ]);
  const mastery: Record<string, number> = {};
  for (const st of stats.subjects) {
    if (st.parentId === null && st.cards - st.fresh > 0) {
      mastery[st.id] = Math.round(st.mastery);
    }
  }
  const focus = stats.weakest[0] ?? null;
  const meta = auth.user?.user_metadata;
  const name =
    (meta?.full_name as string | undefined) ??
    (meta?.name as string | undefined) ??
    null;
  const canResort = resortCandidates.length >= 2;
  const empty = subjects.length === 0;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-9 px-4 py-8">
      {!empty && (
        <div className="rise" style={{ "--i": 0 } as React.CSSProperties}>
          <HomeGreeting name={name} streak={activity.currentStreak} />
        </div>
      )}

      {!empty && (
        <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <DailyStudyBanner progress={progress} />
        </div>
      )}

      {!empty && (
        <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <RecallStrip initial={recall} />
        </div>
      )}

      {!empty && focus && (
        <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <Link
            href={`/subjects/${focus.id}`}
            className="lift border-rule bg-card flex items-center gap-3 rounded-2xl border px-4 py-3.5"
          >
            <span
              className="grid size-10 flex-none place-items-center rounded-xl text-white"
              style={{ backgroundColor: focus.color }}
            >
              <SubjectIcon icon={focus.icon} className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-muted-foreground block text-xs">
                Needs attention
              </span>
              <span className="block truncate text-sm font-semibold">
                {focus.path.length > 1
                  ? focus.path.slice(-2).join(" › ")
                  : focus.name}
              </span>
            </span>
            <span className="text-ink flex-none text-sm font-medium">
              {Math.round(focus.confidence * 100)}% recall →
            </span>
          </Link>
        </div>
      )}

      <section
        className="rise space-y-4"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold">Your subjects</h1>
          <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            <FolderDialog mode="create" parentId={null}>
              <Button size="sm" variant="outline">
                New folder
              </Button>
            </FolderDialog>
            <Button asChild size="sm" variant="outline">
              <Link href="/import">Import</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/cards/new">Add flashcard</Link>
            </Button>
          </div>
        </div>

        {!empty && canResort && (
          <Link
            href="/resort"
            className="border-rule bg-secondary/60 hover:bg-secondary flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition"
          >
            <span>
              <span className="font-medium">
                {resortCandidates.length} loose subjects
              </span>{" "}
              <span className="text-muted-foreground">
                with a card or two each
              </span>
            </span>
            <span className="text-ink font-medium">Re-sort with AI →</span>
          </Link>
        )}

        {empty ? (
          <div className="border-rule flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center">
            <span className="bg-ink-tint text-ink grid size-12 place-items-center rounded-xl">
              <BookText className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-display text-lg font-semibold">
                Your copy is empty
              </p>
              <p className="text-muted-foreground mx-auto max-w-xs text-sm">
                Add a concept you keep getting wrong, or import a page of notes —
                and it&rsquo;ll start bringing it back to you.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild size="sm">
                <Link href="/cards/new">Add a flashcard</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/import">Import material</Link>
              </Button>
              <FolderDialog mode="create" parentId={null}>
                <Button size="sm" variant="outline">
                  New folder
                </Button>
              </FolderDialog>
            </div>
          </div>
        ) : (
          <SubjectGridManager
            subjects={subjects}
            allSubjects={allSubjects}
            mastery={mastery}
          />
        )}
      </section>
    </main>
  );
}
