"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";

import { Logo, MARK } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEEN_KEY = "choti:firstRun";

type Phase = "intro" | "onboard" | "done";

const STEPS = [
  {
    title: "Welcome — this is your error notebook",
    body: "Add the concepts and questions you keep getting wrong. Choti Copy keeps them and brings each one back before you forget it.",
  },
  {
    title: "Review, and the schedule adapts",
    body: "Rate how well you recalled each card (Again → Easy). Wrong quiz answers count too — struggling cards come back sooner.",
  },
  {
    title: "See where you stand",
    body: "The concept map and Progress page show mastery per subject and your own forgetting curve — so effort goes where it's needed.",
  },
];

/**
 * First-open experience: the brand mark assembles itself from three cards, a
 * glow pulses, then a few onboarding cards. Shown once (localStorage), and
 * skipped to a static mark under prefers-reduced-motion.
 */
export function FirstRun() {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [step, setStep] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private mode → just show it */
      seen = false;
    }
    const r =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduced(r);
    setPhase(seen ? "done" : "intro");
  }, []);

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("onboard"), reduced ? 700 : 2400);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  function finish() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setPhase("done");
  }

  if (phase === null || phase === "done") return null;

  if (phase === "intro") {
    return (
      <div className="bg-background animate-none fixed inset-0 z-[100] grid place-items-center">
        <Mark animate={!reduced} />
      </div>
    );
  }

  // onboard
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="bg-background/70 fixed inset-0 z-[100] grid place-items-center p-6 backdrop-blur-sm">
      <div className="border-rule bg-card w-full max-w-sm space-y-4 rounded-2xl border p-6 shadow-xl">
        <Mark animate={false} className="h-10 w-11" />
        <div className="space-y-1.5">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {s.title}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {s.body}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  i === step
                    ? "bg-primary h-1.5 w-5 rounded-full transition-all"
                    : "bg-border h-1.5 w-1.5 rounded-full transition-all"
                }
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!last && (
              <button
                type="button"
                onClick={finish}
                className="text-muted-foreground hover:text-foreground text-sm transition"
              >
                Skip
              </button>
            )}
            <Button
              size="sm"
              className="gap-1"
              onClick={() => (last ? finish() : setStep((n) => n + 1))}
            >
              {last ? (
                <>
                  Get started <Check className="size-3.5" />
                </>
              ) : (
                <>
                  Next <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The animated (or static) brand mark for the intro — 64-unit space, same
 * geometry as `<Logo>`. */
function Mark({
  animate,
  className = "h-40 w-40",
}: {
  animate: boolean;
  className?: string;
}) {
  const m = MARK.mint;
  const v = MARK.violet;

  if (!animate) {
    return <Logo className={className} />;
  }

  return (
    <svg viewBox={MARK.viewBox} className={cn("h-44 w-44", className)} aria-label="Choti Copy">
      <circle
        cx="30"
        cy="32"
        r="24"
        fill="none"
        stroke="var(--sage)"
        strokeWidth="1"
        style={{
          transformOrigin: "30px 32px",
          animation: "brand-ring-pulse .8s ease 1.45s both",
        }}
      />

      {/* white card → becomes the C */}
      <rect
        x="16"
        y="19"
        width="10"
        height="26"
        rx="4.5"
        fill="#ffffff"
        style={
          {
            "--from-x": "-22px",
            "--from-y": "-16px",
            "--from-rot": "-24deg",
            transformOrigin: "21px 32px",
            animation:
              "brand-card-in .55s cubic-bezier(.34,1.4,.64,1) both, brand-fade-out .3s ease .95s forwards",
          } as React.CSSProperties
        }
      />
      <path
        d={MARK.c}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={MARK.cStroke}
        strokeLinecap="round"
        style={
          {
            "--c-len": "78",
            strokeDasharray: 78,
            animation: "brand-c-reveal .6s ease .92s both",
          } as React.CSSProperties
        }
      />

      {/* mint card */}
      <rect
        x={m.x}
        y={m.y}
        width={m.w}
        height={m.h}
        rx={m.r}
        fill="var(--sage)"
        style={
          {
            "--from-x": "24px",
            "--from-y": "18px",
            "--from-rot": "22deg",
            "--to-rot": `${m.rot}deg`,
            transformOrigin: `${m.cx}px ${m.cy}px`,
            animation:
              "brand-card-in .55s cubic-bezier(.34,1.35,.64,1) .12s both",
          } as React.CSSProperties
        }
      />

      {/* violet card */}
      <rect
        x={v.x}
        y={v.y}
        width={v.w}
        height={v.h}
        rx={v.r}
        fill="var(--highlight)"
        style={
          {
            "--from-x": "30px",
            "--from-y": "-20px",
            "--from-rot": "-18deg",
            "--to-rot": `${v.rot}deg`,
            transformOrigin: `${v.cx}px ${v.cy}px`,
            animation:
              "brand-card-in .55s cubic-bezier(.34,1.35,.64,1) .22s both",
          } as React.CSSProperties
        }
      />
    </svg>
  );
}
