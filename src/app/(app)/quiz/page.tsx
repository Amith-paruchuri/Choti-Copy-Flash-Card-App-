import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";

import { QuizFlow } from "@/components/quiz-flow";
import { listSubjectsForDrilldown } from "@/lib/queries/subjects";
import { listQuizSessions } from "@/lib/queries/quiz-sessions";

export const metadata: Metadata = { title: "Quiz" };

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function QuizPage(props: PageProps<"/quiz">) {
  const sp = await props.searchParams;
  const raw = typeof sp.subjects === "string" ? sp.subjects : "";
  const preselected = raw.split(",").filter(Boolean);

  const [subjects, sessions] = await Promise.all([
    listSubjectsForDrilldown(),
    listQuizSessions(),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <div className="space-y-2 text-center">
        <span className="bg-ink-tint text-ink mx-auto grid size-12 place-items-center rounded-xl">
          <ListChecks className="size-6" />
        </span>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Take a quiz
        </h1>
        <p className="text-muted-foreground text-sm">
          Multiple-choice and fill-the-blank, drawn from your own cards. Wrong
          answers feed straight back into your review schedule.
        </p>
      </div>

      {subjects.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Add some flashcards first.{" "}
          <Link href="/dashboard" className="text-ink hover:underline">
            Back to dashboard
          </Link>
        </p>
      ) : (
        <QuizFlow
          subjects={subjects}
          preselected={preselected}
          pastTests={
            sessions.length > 0 && (
              <section key="past-tests" className="space-y-2.5 pt-2">
                <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
                  <span className="bg-highlight size-1.5 rounded-full" />
                  Past tests
                </h2>
                <ul className="border-rule divide-border bg-card divide-y overflow-hidden rounded-xl border">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/quiz/history/${s.id}`}
                        className="hover:bg-secondary flex items-center gap-3 px-4 py-3 transition"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {whenLabel(s.createdAt)}
                            {s.mode === "exam" && (
                              <span className="bg-ink-tint text-ink rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                {s.timed ? "TIMED EXAM" : "EXAM"}
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {s.scopeLabel}
                          </span>
                        </span>
                        <span className="flex-none text-sm font-semibold tabular-nums">
                          {s.correct} / {s.total}
                        </span>
                        <ChevronRight className="text-muted-foreground size-4 flex-none" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          }
        />
      )}
    </main>
  );
}
