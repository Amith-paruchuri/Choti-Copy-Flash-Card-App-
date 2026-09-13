import { Check, Minus, X } from "lucide-react";

import { SubjectIcon } from "@/components/subject-icon";
import { cn } from "@/lib/utils";
import type { QuizSessionEntry } from "@/types/database";

const KEYS = ["1", "2", "3", "4", "5", "6"];

/** Render a fill-the-blank stem with the gap shown as a highlighter mark. */
export function BlankQuestion({ text }: { text: string }) {
  const parts = text.split(/_{2,}|\[\.\.\.\]|\(\s*\)/);
  if (parts.length < 2) return <span>{text}</span>;
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="bg-highlight-tint text-ink mx-1 inline-block min-w-16 rounded border-b-2 border-dashed border-[color-mix(in_srgb,var(--highlight)_60%,transparent)] px-2 text-center align-baseline">
              ?
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function EntryCard({ entry, n }: { entry: QuizSessionEntry; n: number }) {
  const skipped = entry.picked === null;
  return (
    <li
      className="dogear border-rule bg-card relative space-y-3 rounded-xl border p-4"
      style={
        {
          "--dogear-color": entry.correct
            ? "var(--sage)"
            : skipped
              ? "var(--color-muted-foreground)"
              : "var(--clay)",
        } as React.CSSProperties
      }
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className="tabular-nums">Q{n}</span>
        <span
          className="grid size-4 place-items-center rounded text-white"
          style={{
            backgroundColor:
              entry.subjectColor ?? "var(--color-muted-foreground)",
          }}
        >
          <SubjectIcon icon={null} className="size-2.5" />
        </span>
        <span className="truncate">{entry.subjectName ?? "—"}</span>
        <span
          className={cn(
            "ml-auto font-medium",
            entry.correct
              ? "text-sage"
              : skipped
                ? "text-muted-foreground"
                : "text-clay",
          )}
        >
          {entry.correct ? "Correct" : skipped ? "Skipped" : "Wrong"}
        </span>
      </div>

      <p className="font-display text-[15px] leading-snug font-semibold text-balance">
        {entry.format === "blank" ? (
          <BlankQuestion text={entry.questionText} />
        ) : (
          entry.questionText
        )}
      </p>

      <div className="grid gap-1.5">
        {entry.options.map((option, i) => {
          const isAnswer = option === entry.correctAnswer;
          const isPicked = option === entry.picked;
          return (
            <div
              key={option}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                isAnswer && "border-sage/40 bg-sage-tint text-sage",
                isPicked && !isAnswer && "border-clay/40 bg-clay-tint text-clay",
                !isAnswer && !isPicked && "border-rule opacity-55",
              )}
            >
              <span
                className={cn(
                  "grid size-5 flex-none place-items-center rounded border text-[11px] font-medium",
                  isAnswer && "border-sage/40 bg-sage text-white",
                  isPicked && !isAnswer && "border-clay/40 bg-clay text-white",
                  !isAnswer && !isPicked && "border-rule text-muted-foreground",
                )}
              >
                {isAnswer ? (
                  <Check className="size-3" />
                ) : isPicked ? (
                  <X className="size-3" />
                ) : (
                  KEYS[i]
                )}
              </span>
              <span className="flex-1">{option}</span>
            </div>
          );
        })}
      </div>

      {skipped && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Minus className="size-3" /> Not answered — counted wrong.
        </p>
      )}
      {entry.explanation && (
        <p className="text-muted-foreground border-t pt-2.5 text-sm">
          {entry.explanation}
        </p>
      )}
    </li>
  );
}

/**
 * The full per-question breakdown of a finished quiz/exam — every question with
 * the learner's answer, the correct answer, and the explanation. Shared by the
 * exam done-screen and the /quiz/history/[id] page.
 */
export function SessionBreakdown({ entries }: { entries: QuizSessionEntry[] }) {
  return (
    <ol className="space-y-3">
      {entries.map((entry, i) => (
        <EntryCard key={`${entry.questionId}-${i}`} entry={entry} n={i + 1} />
      ))}
    </ol>
  );
}
