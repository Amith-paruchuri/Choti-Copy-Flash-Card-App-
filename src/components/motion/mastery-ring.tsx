"use client";

import { motion, useReducedMotion } from "motion/react";

import { EASE_OUT } from "@/lib/motion";

/** A small ring showing 0–100 mastery. It draws itself in on mount. */
export function MasteryRing({
  pct,
  color,
  size = 30,
  delay = 0.2,
}: {
  pct: number;
  color: string;
  size?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <span
      className="relative inline-grid flex-none place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)}% mastered`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={stroke} />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: clamped / 100 }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay }}
        />
      </svg>
      <span className="relative text-[9px] font-semibold tabular-nums">
        {Math.round(clamped)}
      </span>
    </span>
  );
}
