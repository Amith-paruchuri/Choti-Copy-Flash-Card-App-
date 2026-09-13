import type { Metadata } from "next";
import Link from "next/link";
import { BookText } from "lucide-react";

import { DailyStudyBanner } from "@/components/daily-study-banner";
import { FolderDialog } from "@/components/folder-dialog";
import { RecallStrip } from "@/components/recall-strip";
import { SubjectGridManager } from "@/components/subject-grid-manager";
import { Button } from "@/components/ui/button";
import {
  getResortCandidates,
  listSubjectsForPicker,
  listSubjectsWithCounts,
} from "@/lib/queries/subjects";
import { getRecallCards } from "@/lib/queries/recall";
import { getDailyProgress } from "@/lib/queries/review";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [subjects, allSubjects, recall, resortCandidates, progress] =
    await Promise.all([
      listSubjectsWithCounts(),
      listSubjectsForPicker(),
      getRecallCards(),
      getResortCandidates(),
      getDailyProgress(),
    ]);
  const canResort = resortCandidates.length >= 2;
  const empty = subjects.length === 0;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-9 px-4 py-8">
      {!empty && <DailyStudyBanner progress={progress} />}

      {!empty && <RecallStrip initial={recall} />}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Your subjects</h1>
          <div className="flex flex-wrap justify-end gap-2">
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
          <SubjectGridManager subjects={subjects} allSubjects={allSubjects} />
        )}
      </section>
    </main>
  );
}
