"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Check, Clock, Flag, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { recordReview } from "@/actions/review";
import { regenerateQuizQuestion } from "@/actions/quiz";
import { BlankQuestion } from "@/components/session-breakdown";
import { SubjectIcon } from "@/components/subject-icon";
import { WhyThisCard } from "@/components/why-this-card";
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
import { ratingForQuiz } from "@/lib/srs/fsrs";
import { cn } from "@/lib/utils";
import type { QuizSessionItem } from "@/actions/quiz";

export type QuizMode = "practice" | "exam";
export interface QuizTimeLimit {
  seconds: number;
  kind: "overall" | "per_question";
}

export interface QuizResult {
  cardId: string;
  questionId: string;
  correct: boolean;
  /** null when the question was skipped / timed out. */
  picked: string | null;
  question: QuizSessionItem["question"];
  card: QuizSessionItem["card"];
}

export interface QuizFinishMeta {
  durationS: number;
}

const KEYS = ["1", "2", "3", "4", "5", "6"];

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function QuizRunner({
  items: initialItems,
  mode = "practice",
  timeLimit,
  onFinish,
}: {
  items: QuizSessionItem[];
  mode?: QuizMode;
  timeLimit?: QuizTimeLimit | null;
  onFinish: (results: QuizResult[], meta: QuizFinishMeta) => void;
}) {
  const exam = mode === "exam";

  const [items, setItems] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null); // practice reveal only
  const [remaining, setRemaining] = useState<number | null>(
    timeLimit ? timeLimit.seconds : null,
  );
  const [regenerating, startRegen] = useTransition();
  const [confirmEnd, setConfirmEnd] = useState(false);

  // index → the learner's answer for that question
  type Answer = { picked: string; correct: boolean };
  const [answers, setAnswers] = useState<Record<number, Answer>>({});

  const startedAtRef = useRef(0);
  const questionStartRef = useRef(0);
  const finishedRef = useRef(false);
  const onTimeoutRef = useRef<() => void>(() => {});

  const item = items[index];
  const answeredHere = index in answers;
  const revealed = !exam && picked !== null;
  const correct = picked === item?.question.correctAnswer;
  const doneCount = Object.keys(answers).length;
  const rightCount = Object.values(answers).filter((a) => a.correct).length;

  const finish = useCallback(
    (opts?: { scope?: "all" | "reached"; final?: Record<number, Answer> }) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const map = opts?.final ?? answers;
      // "reached" (ended early) → only score the questions actually shown.
      const upTo = opts?.scope === "reached" ? index + 1 : items.length;
      const results: QuizResult[] = items.slice(0, upTo).map((it, i) => {
        const a = map[i];
        return {
          cardId: it.card.id,
          questionId: it.question.id,
          correct: a?.correct ?? false,
          picked: a?.picked ?? null,
          question: it.question,
          card: it.card,
        };
      });
      onFinish(results, {
        durationS: Math.round((Date.now() - startedAtRef.current) / 1000),
      });
    },
    [items, answers, index, onFinish],
  );

  const advance = useCallback(() => {
    setPicked(null);
    if (index + 1 >= items.length) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  }, [index, items.length, finish]);

  const answer = useCallback(
    (option: string) => {
      if (!item || index in answers) return;
      const isRight = option === item.question.correctAnswer;
      const next = { ...answers, [index]: { picked: option, correct: isRight } };
      setAnswers(next);

      void recordReview({
        flashcardId: item.card.id,
        questionId: item.question.id,
        rating: ratingForQuiz(isRight),
        source: "quiz",
      }).then((res) => {
        if (res && !res.ok) toast.error(res.error);
        else if (res?.ok && res.data.suspended) {
          toast.message(
            "That card's now a leech — parked until you reactivate it.",
          );
        }
      });

      if (!exam) {
        setPicked(option);
      } else if (index + 1 >= items.length) {
        finish({ final: next }); // state hasn't flushed yet
      } else {
        setIndex((i) => i + 1);
      }
    },
    [item, index, answers, exam, items.length, finish],
  );

  function regenerate() {
    if (!item || answeredHere) return;
    const questionId = item.question.id;
    startRegen(async () => {
      const res = await regenerateQuizQuestion({ questionId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.question.id === questionId ? { ...it, question: res.data } : it,
        ),
      );
    });
  }

  // Anchor both clocks at mount.
  useEffect(() => {
    const t = Date.now();
    startedAtRef.current = t;
    questionStartRef.current = t;
  }, []);

  // Keep the "what to do at 0" action current without re-arming the interval.
  useEffect(() => {
    onTimeoutRef.current =
      timeLimit?.kind === "overall" ? () => finish() : advance;
  });

  // Countdown. One interval, re-armed per question so per-question mode resets.
  useEffect(() => {
    if (!timeLimit) return;
    if (timeLimit.kind === "per_question") questionStartRef.current = Date.now();
    const tick = () => {
      if (finishedRef.current) return;
      const from =
        timeLimit.kind === "overall"
          ? startedAtRef.current
          : questionStartRef.current;
      const left = timeLimit.seconds - (Date.now() - from) / 1000;
      setRemaining(Math.max(0, left));
      if (left <= 0) onTimeoutRef.current();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timeLimit, index]);

  // Keyboard: number keys answer; in practice, Enter/Space advances after reveal.
  const kb = useRef({ exam, revealed, answeredHere, answer, advance, item });
  useEffect(() => {
    kb.current = { exam, revealed, answeredHere, answer, advance, item };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = kb.current;
      if (!s.item) return;
      if (s.exam ? !s.answeredHere : !s.revealed) {
        const idx = KEYS.indexOf(e.key);
        if (idx >= 0 && idx < s.item.question.options.length) {
          e.preventDefault();
          s.answer(s.item.question.options[idx]);
        }
      } else if (!s.exam && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        s.advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!item) return null;

  const pct = Math.round((index / items.length) * 100);
  const lowTime = remaining !== null && remaining <= 10;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <div className="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
          <span>
            {index + 1} / {items.length}
            {exam && ` · ${doneCount} answered`}
          </span>
          {remaining !== null ? (
            <span
              className={cn(
                "flex items-center gap-1 font-medium",
                lowTime ? "text-clay" : "text-foreground",
              )}
            >
              <Clock className="size-3.5" />
              {fmt(remaining)}
              {timeLimit?.kind === "per_question" && (
                <span className="text-muted-foreground font-normal">
                  / question
                </span>
              )}
            </span>
          ) : (
            <span>{!exam && doneCount > 0 && `${rightCount}/${doneCount} right`}</span>
          )}
        </div>
        <div className="bg-secondary mt-1 h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              lowTime ? "bg-clay" : "bg-highlight",
            )}
            style={{
              width:
                remaining !== null && timeLimit?.kind === "overall"
                  ? `${100 - (remaining / timeLimit.seconds) * 100}%`
                  : `${pct}%`,
            }}
          />
        </div>
      </div>

      <div
        className="dogear border-rule bg-card relative space-y-4 rounded-xl border p-5 shadow-[0_1px_2px_rgba(42,38,34,0.05),0_10px_30px_-12px_rgba(42,38,34,0.18)]"
        style={
          {
            "--dogear-color":
              item.card.subjectColor ?? "var(--color-muted-foreground)",
          } as React.CSSProperties
        }
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span
              className="grid size-5 place-items-center rounded-md text-white"
              style={{
                backgroundColor:
                  item.card.subjectColor ?? "var(--color-muted-foreground)",
              }}
            >
              <SubjectIcon icon={null} className="size-3" />
            </span>
            {item.card.subjectName}
            {item.question.format === "blank" && (
              <span className="text-muted-foreground/70">· fill the blank</span>
            )}
          </span>
          {!exam && <WhyThisCard memory={item.card.memory} />}
        </div>

        <p className="font-display text-lg leading-snug font-semibold text-balance">
          {item.question.format === "blank" ? (
            <BlankQuestion text={item.question.questionText} />
          ) : (
            item.question.questionText
          )}
        </p>

        <div className="grid gap-2">
          {item.question.options.map((option, i) => {
            const isAnswer = option === item.question.correctAnswer;
            const isPicked = option === picked;
            return (
              <button
                key={option}
                type="button"
                disabled={revealed}
                onClick={() => answer(option)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                  !revealed &&
                    "border-rule hover:border-foreground/30 hover:bg-secondary",
                  revealed && isAnswer && "border-sage/40 bg-sage-tint text-sage",
                  revealed &&
                    isPicked &&
                    !isAnswer &&
                    "border-clay/40 bg-clay-tint text-clay",
                  revealed && !isAnswer && !isPicked && "border-rule opacity-55",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 flex-none place-items-center rounded border text-[11px] font-medium",
                    revealed && isAnswer && "border-sage/40 bg-sage text-white",
                    revealed &&
                      isPicked &&
                      !isAnswer &&
                      "border-clay/40 bg-clay text-white",
                    (!revealed || (!isAnswer && !isPicked)) &&
                      "border-rule text-muted-foreground",
                  )}
                >
                  {revealed && isAnswer ? (
                    <Check className="size-3" />
                  ) : revealed && isPicked ? (
                    <X className="size-3" />
                  ) : (
                    KEYS[i]
                  )}
                </span>
                <span className="flex-1">{option}</span>
              </button>
            );
          })}
        </div>

        {!revealed && !answeredHere && (
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            className="text-muted-foreground hover:text-foreground mx-auto flex items-center gap-1.5 text-xs transition disabled:opacity-60"
          >
            <RefreshCw
              className={cn("size-3", regenerating && "animate-spin")}
            />
            {regenerating ? "Rewriting…" : "Try a different question"}
          </button>
        )}

        {revealed && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm">
              <span
                className={cn(
                  "font-semibold",
                  correct ? "text-sage" : "text-clay",
                )}
              >
                {correct ? "Correct." : "Not quite."}
              </span>{" "}
              <span className="text-muted-foreground">
                {item.question.explanation}
              </span>
            </p>
            <Button onClick={advance} size="sm" className="w-full">
              {index + 1 >= items.length ? "See results" : "Next question"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {exam
            ? "No feedback until the end · keys 1–4"
            : revealed
              ? "Enter for the next question"
              : "Tap an answer · keys 1–4"}
        </p>
        <button
          type="button"
          onClick={() => setConfirmEnd(true)}
          className="text-muted-foreground hover:text-clay inline-flex items-center gap-1 text-xs font-medium transition"
        >
          <Flag className="size-3" />
          {exam ? "End exam" : "End quiz"}
        </button>
      </div>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              End {exam ? "the exam" : "this quiz"} now?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You&rsquo;ve answered {doneCount} of {items.length}. You&rsquo;ll
              see your results for the questions so far — the rest won&rsquo;t
              count against you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={() => finish({ scope: "reached" })}>
              End &amp; see results
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
