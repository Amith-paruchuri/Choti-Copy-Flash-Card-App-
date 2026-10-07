"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  GraduationCap,
  Hash,
  Loader2,
  Stethoscope,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

import { prepareQuiz, saveQuizSession, type QuizSessionItem } from "@/actions/quiz";
import {
  QuizRunner,
  type QuizMode,
  type QuizResult,
} from "@/components/quiz-runner";
import { SessionBreakdown } from "@/components/session-breakdown";
import { SubjectDrilldown } from "@/components/subject-drilldown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DrilldownSubject } from "@/lib/queries/subjects";
import type {
  QuizLimitKind,
  QuizSessionEntry,
  QuizStyle,
} from "@/types/database";

const COUNTS = [10, 20, 30];
const MIN_COUNT = 1;
const MAX_COUNT = 100;
const STYLE_KEY = "choti:quizStyle";

/** A two-up choice card with an icon, used for Mode and Question style. */
function ChoiceCard({
  selected,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof BookOpen;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "dogear relative flex touch-manipulation flex-col gap-2 rounded-xl border p-3.5 text-left transition active:scale-[0.98] [-webkit-tap-highlight-color:transparent]",
        selected
          ? "border-primary bg-sage-tint shadow-[0_1px_2px_rgba(42,38,34,0.06),0_12px_28px_-14px_rgba(42,38,34,0.35)]"
          : "border-rule bg-card hover:border-foreground/25 hover:shadow-sm",
      )}
      style={
        { "--dogear-color": selected ? "var(--highlight)" : "transparent" } as React.CSSProperties
      }
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          selected ? "bg-primary/20 text-primary" : "bg-ink-tint text-ink",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="block text-sm font-semibold">{label}</span>
      <span className="text-muted-foreground block text-[11px] leading-snug">
        {hint}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
      <span className="bg-highlight size-1.5 rounded-full" />
      {children}
    </h2>
  );
}

type Phase = "pick" | "loading" | "run" | "done";

function entriesFrom(results: QuizResult[]): QuizSessionEntry[] {
  return results.map((r) => ({
    questionId: r.questionId,
    cardId: r.cardId,
    subjectId: r.card.subjectId,
    cardTitle: r.card.title,
    subjectName: r.card.subjectName,
    subjectColor: r.card.subjectColor,
    format: r.question.format,
    questionText: r.question.questionText,
    options: r.question.options,
    correctAnswer: r.question.correctAnswer,
    explanation: r.question.explanation,
    picked: r.picked,
    correct: r.correct,
  }));
}

export function QuizFlow({
  subjects,
  preselected,
  pastTests,
}: {
  subjects: DrilldownSubject[];
  preselected: string[];
  /** Rendered "Past tests" list — shown only on the picker screen. */
  pastTests?: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [countText, setCountText] = useState("10");
  const [mode, setMode] = useState<QuizMode>("practice");
  const [style, setStyle] = useState<QuizStyle>("plain");

  const count = Math.min(
    Math.max(Number.parseInt(countText, 10) || MIN_COUNT, MIN_COUNT),
    MAX_COUNT,
  );
  const [limitKind, setLimitKind] = useState<QuizLimitKind>("overall");
  const [overallMin, setOverallMin] = useState(10);
  const [perQSec, setPerQSec] = useState(60);
  const [focusId, setFocusId] = useState<string | null>(
    () => preselected.find((id) => subjects.some((s) => s.id === id)) ?? null,
  );
  const [items, setItems] = useState<QuizSessionItem[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [pending, start] = useTransition();

  const subjectIds = focusId ? [focusId] : [];

  // Remember the learner's last style choice across sessions.
  useEffect(() => {
    try {
      if (localStorage.getItem(STYLE_KEY) === "vignette") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStyle("vignette");
      }
    } catch {
      /* private mode / blocked storage */
    }
  }, []);
  function pickStyle(s: QuizStyle) {
    setStyle(s);
    try {
      localStorage.setItem(STYLE_KEY, s);
    } catch {
      /* ignore */
    }
  }

  const scopeLabel = useMemo(() => {
    if (!focusId) return "All subjects";
    return subjects.find((s) => s.id === focusId)?.name ?? "All subjects";
  }, [focusId, subjects]);

  const timeLimit =
    mode === "exam"
      ? {
          kind: limitKind,
          seconds:
            limitKind === "overall"
              ? Math.max(1, overallMin) * 60
              : Math.max(5, perQSec),
        }
      : null;

  function begin() {
    setPhase("loading");
    start(async () => {
      const res = await prepareQuiz({
        subjectIds,
        count,
        style,
      });
      if (!res.ok) {
        toast.error(res.error);
        setPhase("pick");
        return;
      }
      if (res.data.skipped > 0) {
        toast.message(
          `${res.data.skipped} card${res.data.skipped === 1 ? "" : "s"} skipped — no question yet.`,
        );
      }
      setItems(res.data.items);
      setPhase("run");
    });
  }

  function finishRun(r: QuizResult[], meta: { durationS: number }) {
    setResults(r);
    setPhase("done");
    // Nothing to record if they bailed before answering anything.
    if (r.some((x) => x.picked !== null)) {
      void saveQuizSession({
        mode,
        subjectIds,
        scopeLabel,
        timeLimitS: timeLimit?.seconds ?? null,
        limitKind: timeLimit?.kind ?? null,
        durationS: meta.durationS,
        items: entriesFrom(r),
      }).then((res) => {
        if (res && !res.ok) {
          toast.error(`Couldn’t save to history: ${res.error}`);
        }
      });
    }
  }

  function reset() {
    setResults([]);
    setItems([]);
    setPhase("pick");
  }

  if (phase === "loading" || pending) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Loader2 className="text-ink size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">
          Building your quiz — writing questions for cards that need one…
        </p>
      </div>
    );
  }

  if (phase === "run") {
    return (
      <QuizRunner
        items={items}
        mode={mode}
        timeLimit={timeLimit}
        onFinish={finishRun}
      />
    );
  }

  if (phase === "done") {
    const total = results.length;
    const right = results.filter((r) => r.correct).length;
    const wrong = results.filter((r) => !r.correct);
    const entries = entriesFrom(results);

    return (
      <div className="mx-auto max-w-md space-y-6 py-4">
        <div className="text-center">
          <p className="font-display text-3xl font-semibold tabular-nums">
            {right} / {total}
          </p>
          <p className="text-muted-foreground text-sm">
            {total > 0 ? Math.round((right / total) * 100) : 0}% correct ·{" "}
            {wrong.length === 0 ? "clean sweep" : `${wrong.length} to revisit`}
            {mode === "exam" && " · timed exam"}
          </p>
        </div>

        {mode === "exam" ? (
          <>
            <p className="text-muted-foreground text-xs">
              Wrong and skipped questions already count as “Again” where you
              answered — those cards come back sooner in review. Saved to your
              test history.
            </p>
            <SessionBreakdown entries={entries} />
          </>
        ) : (
          <>
            {wrong.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Worth another look</h2>
                <ul className="border-rule divide-border divide-y overflow-hidden rounded-xl border">
                  {wrong.map((r) => (
                    <li key={r.questionId}>
                      <Link
                        href={`/subjects/${r.card.subjectId}?card=${r.cardId}`}
                        className="hover:bg-secondary flex items-center gap-3 px-4 py-3 transition"
                      >
                        <span
                          className="size-2 flex-none rounded-full"
                          style={{
                            backgroundColor:
                              r.card.subjectColor ??
                              "var(--color-muted-foreground)",
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {r.card.title ?? "Untitled card"}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {r.card.subjectName}
                          </span>
                        </span>
                        <ArrowRight className="text-muted-foreground size-4 flex-none" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <details className="group">
              <summary className="text-ink cursor-pointer text-sm font-medium hover:underline">
                See all {total} question{total === 1 ? "" : "s"}
              </summary>
              <div className="mt-3">
                <SessionBreakdown entries={entries} />
              </div>
            </details>
          </>
        )}

        <div className="flex justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            New quiz
          </Button>
        </div>
      </div>
    );
  }

  // ── pick ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md space-y-7">
      <section className="space-y-2.5">
        <SectionLabel>Mode</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard
            selected={mode === "practice"}
            onClick={() => setMode("practice")}
            icon={GraduationCap}
            label="Practice"
            hint="Untimed · feedback after each question"
          />
          <ChoiceCard
            selected={mode === "exam"}
            onClick={() => setMode("exam")}
            icon={Timer}
            label="Timed exam"
            hint="No feedback · full breakdown at the end"
          />
        </div>
      </section>

      {mode === "exam" && (
        <section className="dogear border-rule bg-secondary/40 relative space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="text-ink size-4" /> Time limit
          </div>
          <div className="bg-card border-rule inline-flex w-full rounded-lg border p-0.5">
            {(
              [
                ["overall", "Overall total"],
                ["per_question", "Per question"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLimitKind(value)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-medium transition",
                  limitKind === value
                    ? "bg-ink-tint text-ink shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {limitKind === "overall"
                ? "Minutes for the whole test"
                : "Seconds per question"}
            </span>
            {limitKind === "overall" ? (
              <input
                type="number"
                min={1}
                max={180}
                value={overallMin}
                onChange={(e) => setOverallMin(Number(e.target.value) || 1)}
                className="border-rule bg-card w-20 rounded-md border px-2 py-1.5 text-right font-semibold tabular-nums"
              />
            ) : (
              <input
                type="number"
                min={5}
                max={600}
                step={5}
                value={perQSec}
                onChange={(e) => setPerQSec(Number(e.target.value) || 5)}
                className="border-rule bg-card w-20 rounded-md border px-2 py-1.5 text-right font-semibold tabular-nums"
              />
            )}
          </label>
          <p className="text-muted-foreground text-[11px]">
            Run out of time and any unanswered questions count as wrong.
          </p>
        </section>
      )}

      <section className="space-y-2.5">
        <SectionLabel>Question style</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <ChoiceCard
            selected={style === "plain"}
            onClick={() => pickStyle("plain")}
            icon={BookOpen}
            label="Standard"
            hint="Direct recall of the fact"
          />
          <ChoiceCard
            selected={style === "vignette"}
            onClick={() => pickStyle("vignette")}
            icon={Stethoscope}
            label="Clinical vignette"
            hint="A patient scenario leads to the concept"
          />
        </div>
        {style === "vignette" && (
          <p className="text-muted-foreground text-[11px]">
            Non-clinical cards stay as normal questions.
          </p>
        )}
      </section>

      <section className="space-y-2.5">
        <SectionLabel>How many questions?</SectionLabel>
        <div className="flex items-stretch gap-2">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCountText(String(n))}
              className={cn(
                "flex-1 rounded-xl border py-3 text-base font-semibold tabular-nums transition",
                count === n && countText === String(n)
                  ? "border-primary bg-ink-tint text-ink shadow-sm"
                  : "border-rule bg-card hover:border-foreground/25",
              )}
            >
              {n}
            </button>
          ))}
          <div
            className={cn(
              "flex flex-1 items-center gap-1 rounded-xl border px-2.5 transition",
              !COUNTS.includes(count) || countText !== String(count)
                ? "border-primary bg-ink-tint"
                : "border-rule bg-card",
            )}
          >
            <Hash className="text-muted-foreground size-3.5 flex-none" />
            <input
              type="number"
              inputMode="numeric"
              min={MIN_COUNT}
              max={MAX_COUNT}
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              onBlur={() => setCountText(String(count))}
              aria-label="Custom question count"
              className="w-full min-w-0 bg-transparent py-3 text-base font-semibold tabular-nums outline-none"
              placeholder="Any"
            />
          </div>
        </div>
        <p className="text-muted-foreground text-[11px]">
          {MIN_COUNT}–{MAX_COUNT} · drawn from your weakest cards first.
        </p>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Draw from</SectionLabel>
        <SubjectDrilldown
          items={subjects}
          value={focusId}
          onChange={setFocusId}
          leafHint="Quizzing just this topic — no sub-topics to narrow into."
          renderHeader={(s) => (
            <p className="text-muted-foreground text-xs">
              {s
                ? `Quiz on all of ${s.name}${
                    s.cardCount > 0
                      ? ` — ${s.cardCount} card${s.cardCount === 1 ? "" : "s"} incl. sub-topics`
                      : ""
                  }, or drill in below.`
                : "Every card in your account. Pick a subject below to narrow it."}
            </p>
          )}
          renderTrailing={(s) => (
            <span className="text-muted-foreground flex-none text-xs tabular-nums">
              {s.cardCount}
            </span>
          )}
        />
      </section>

      <Button onClick={begin} size="lg" className="w-full gap-2 shadow-sm">
        {mode === "exam" ? "Start exam" : "Start quiz"}
        <ArrowRight className="size-4" />
      </Button>

      {pastTests}
    </div>
  );
}
