"use client";

import { motion, useReducedMotion } from "motion/react";

import { CountUp } from "@/components/motion/count-up";
import { EASE_OUT } from "@/lib/motion";

/**
 * A circular goal meter. The arc draws itself on mount and the number counts
 * up with it. Colours come from `currentColor` (track at low opacity) so the
 * parent decides the palette.
 */
export function ProgressRing({
  value,
  max,
  size = 64,
  className,
}: {
  value: number;
  max: number;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const pct = max > 0 ? Math.min(1, value / max) : 0;

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${value} of ${max} cards reviewed today`}
    >
      <div className="relative grid size-full place-items-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
          <motion.circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: Math.max(pct, value > 0 ? 0.04 : 0) }}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.25 }}
          />
        </svg>
        <span className="relative text-sm font-semibold tabular-nums leading-none">
          <CountUp value={value} delay={0.25} />
        </span>
      </div>
    </div>
  );
}
