import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";

import { SessionBreakdown } from "@/components/session-breakdown";
import { getQuizSession } from "@/lib/queries/quiz-sessions";

export const metadata: Metadata = { title: "Test review" };

function fmtDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m} min`;
}

export default async function QuizHistoryPage(
  props: PageProps<"/quiz/history/[sessionId]">,
) {
  const { sessionId } = await props.params;
  const session = await getQuizSession(sessionId);
  if (!session) notFound();

  const pct =
    session.total > 0 ? Math.round((session.correct / session.total) * 100) : 0;
  const skipped = session.total - session.answered;
  const date = new Date(session.created_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
      <header className="space-y-2">
        <Link
          href="/quiz"
          className="text-muted-foreground hover:text-foreground text-sm transition"
        >
          &larr; All tests
        </Link>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {session.correct} / {session.total}
          </h1>
          <span className="text-muted-foreground text-sm tabular-nums">
            {pct}% correct
          </span>
        </div>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{date}</span>
          <span>·</span>
          <span>{session.scope_label}</span>
          <span>·</span>
          <span>
            {session.mode === "exam" ? "Timed exam" : "Practice"}
          </span>
          {session.mode === "exam" && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {fmtDuration(session.duration_s)}
                {session.limit_kind === "per_question" && " · per question"}
              </span>
            </>
          )}
          {skipped > 0 && (
            <>
              <span>·</span>
              <span>{skipped} skipped</span>
            </>
          )}
        </p>
      </header>

      <SessionBreakdown entries={session.items} />
    </main>
  );
}
