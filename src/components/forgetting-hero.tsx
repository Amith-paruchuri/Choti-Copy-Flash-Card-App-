"use client";

import { useEffect, useId } from "react";
import {
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

/**
 * The sign-in hero. It shows what the product does: a card fades from memory,
 * a review brings it back sharp, and each gap before the next review is
 * longer than the last (spaced repetition).
 *
 * One motion value `t` (0 → 1) drives everything: the card's blur and
 * opacity, the curve being drawn, and the review marks.
 */

// Each segment is one forgetting run: it starts at 100% at `s`, decays to
// `end` by `e`, then a review resets it to 100%.
const SEGMENTS = [
  { s: 0, e: 0.2, end: 0.5, label: "Day 1" },
  { s: 0.2, e: 0.41, end: 0.6, label: "Day 3" },
  { s: 0.41, e: 0.66, end: 0.72, label: "Day 8" },
  { s: 0.66, e: 0.92, end: 0.84, label: "Day 21" },
] as const;
const REVIEW_TIMES = SEGMENTS.map((seg) => seg.e);
const LOOP_SECONDS = 11;
const HOLD_SECONDS = 2.5;

function retention(t: number): number {
  for (const seg of SEGMENTS) {
    if (t >= seg.s && t < seg.e) {
      const x = (t - seg.s) / (seg.e - seg.s);
      const f = (1 - Math.exp(-3 * x)) / (1 - Math.exp(-3));
      return 1 - (1 - seg.end) * f;
    }
  }
  return 1;
}

function pulse(t: number): number {
  let p = 0;
  for (const r of REVIEW_TIMES) {
    if (t >= r) p = Math.max(p, Math.max(0, 1 - (t - r) / 0.06));
  }
  return p;
}

const W = 320;
const H = 120;
const PAD_L = 40;
const PAD_R = 10;
const TOP = 12;
const BOTTOM = 22;
const R_MIN = 0.4;

const xAt = (t: number) => PAD_L + t * (W - PAD_L - PAD_R);
const yAt = (r: number) =>
  TOP + ((1 - Math.max(r, R_MIN)) / (1 - R_MIN)) * (H - TOP - BOTTOM);

function buildCurve(): string {
  const parts: string[] = [];
  for (const seg of SEGMENTS) {
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = seg.s + ((seg.e - seg.s) * i) / steps;
      const r = i === steps ? 1 - (1 - seg.end) : retention(Math.min(t, seg.e - 1e-6));
      parts.push(`${parts.length === 0 ? "M" : "L"}${xAt(t).toFixed(1)} ${yAt(r).toFixed(1)}`);
    }
    // review: straight back up to 100%
    parts.push(`L${xAt(seg.e).toFixed(1)} ${yAt(1).toFixed(1)}`);
  }
  parts.push(`L${xAt(1).toFixed(1)} ${yAt(1).toFixed(1)}`);
  return parts.join(" ");
}

const CURVE = buildCurve();

export function ForgettingHero({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const t = useMotionValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      t.set(1);
      return;
    }
    const cycle = (LOOP_SECONDS + HOLD_SECONDS) * 1000;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const phase = ((now - start) % cycle) / 1000;
      t.set(Math.min(1, phase / LOOP_SECONDS));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, t]);

  const cardFilter = useTransform(t, (v) => `blur(${((1 - retention(v)) * 9).toFixed(2)}px)`);
  const cardOpacity = useTransform(t, (v) => 0.3 + 0.7 * retention(v));
  const cardGlow = useTransform(t, (v) => {
    const p = pulse(v);
    return `0 0 ${(p * 44).toFixed(0)}px ${(p * 4).toFixed(1)}px color-mix(in oklch, var(--color-sage) ${(p * 55).toFixed(0)}%, transparent)`;
  });
  const clipWidth = useTransform(t, (v) => xAt(v));
  const memory = useTransform(t, (v) => `${Math.round(retention(v) * 100)}%`);

  return (
    <div
      className={className}
      role="img"
      aria-label="A flashcard fades from memory, a review brings it back sharp, and each gap before the next review gets longer."
    >
      {/* the card that is being forgotten */}
      <motion.div
        style={{ filter: cardFilter, opacity: cardOpacity, boxShadow: cardGlow }}
        className="border-rule bg-card rounded-xl border p-5 will-change-[filter,opacity]"
      >
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className="bg-clay inline-block size-2 rounded-full" />
          Pharmacology
        </p>
        <p className="font-display mt-3 text-lg leading-snug font-semibold text-balance sm:text-xl">
          How does cefiderocol get into bacteria?
        </p>
        <p className="text-muted-foreground mt-1.5 text-sm">
          It hijacks iron transport, like a Trojan horse.
        </p>
      </motion.div>

      {/* the curve */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" aria-hidden>
        <defs>
          <clipPath id={`${uid}-clip`}>
            <motion.rect x={0} y={0} height={H} width={clipWidth} />
          </clipPath>
        </defs>

        {/* y axis: how much of the card you still remember */}
        {[1, 0.7, 0.4].map((r) => (
          <g key={r}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yAt(r)}
              y2={yAt(r)}
              stroke="var(--color-rule)"
              strokeDasharray={r === 1 ? undefined : "2 4"}
              opacity={r === 1 ? 0 : 0.7}
            />
            <text
              x={PAD_L - 6}
              y={yAt(r) + 3}
              textAnchor="end"
              fontSize={9}
              fill="var(--color-muted-foreground)"
            >
              {Math.round(r * 100)}%
            </text>
          </g>
        ))}
        <text
          transform={`translate(9 ${(yAt(1) + yAt(0.4)) / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={9}
          fill="var(--color-muted-foreground)"
        >
          Memory
        </text>

        {/* faint guide lines */}
        <line x1={PAD_L} x2={W - PAD_R} y1={yAt(1)} y2={yAt(1)} stroke="var(--color-rule)" strokeDasharray="2 4" />
        <line x1={PAD_L} x2={W - PAD_R} y1={H - BOTTOM} y2={H - BOTTOM} stroke="var(--color-rule)" />

        <path
          d={CURVE}
          fill="none"
          stroke="var(--color-highlight)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#${uid}-clip)`}
        />

        {SEGMENTS.map((seg) => (
          <ReviewMark key={seg.label} t={t} at={seg.e} label={seg.label} />
        ))}
      </svg>

      <p className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
        <span>Each review pushes the next one further away.</span>
        <motion.span className="tabular-nums">{memory}</motion.span>
      </p>
    </div>
  );
}

function ReviewMark({
  t,
  at,
  label,
}: {
  t: MotionValue<number>;
  at: number;
  label: string;
}) {
  const opacity = useTransform(t, [at - 0.015, at], [0, 1]);
  return (
    <g>
      <motion.circle
        cx={xAt(at)}
        cy={yAt(1)}
        r={4}
        fill="var(--color-sage)"
        style={{ opacity }}
      />
      <text
        x={xAt(at)}
        y={H - 6}
        textAnchor="middle"
        fontSize={9}
        fill="var(--color-muted-foreground)"
      >
        {label}
      </text>
    </g>
  );
}
