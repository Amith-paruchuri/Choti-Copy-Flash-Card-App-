"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

import {
  projectIntervals,
  type CardMemory,
  type RatingValue,
} from "@/lib/srs/fsrs";
import { SPRING_SNAPPY } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const RATINGS: {
  value: RatingValue;
  label: string;
  className: string;
}[] = [
  { value: 1, label: "Again", className: "bg-clay-tint text-clay border-clay/25" },
  { value: 2, label: "Hard", className: "bg-secondary text-foreground border-rule" },
  { value: 3, label: "Good", className: "bg-sage-tint text-sage border-sage/25" },
  {
    value: 4,
    label: "Easy",
    className: "bg-highlight-tint text-ink border-highlight/30",
  },
];

export const ratingLabel = (v: RatingValue) =>
  RATINGS.find((r) => r.value === v)?.label ?? "";

/** The four FSRS self-rating buttons with projected-interval sublabels. */
export function RatingButtons({
  memory,
  onRate,
  disabled = false,
}: {
  memory: CardMemory | null;
  onRate: (rating: RatingValue) => void;
  disabled?: boolean;
}) {
  const intervals = useMemo(() => projectIntervals(memory), [memory]);
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {RATINGS.map((r, i) => (
        <motion.button
          key={r.value}
          type="button"
          disabled={disabled}
          onClick={() => onRate(r.value)}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_SNAPPY, delay: reduce ? 0 : i * 0.045 }}
          whileHover={reduce ? undefined : { y: -2, scale: 1.03 }}
          whileTap={reduce ? undefined : { scale: 0.93 }}
          className={cn(
            "flex touch-manipulation flex-col items-center gap-0.5 min-h-14 justify-center rounded-xl border px-1 py-2.5 disabled:opacity-60 [-webkit-tap-highlight-color:transparent]",
            r.className,
          )}
        >
          <span className="text-xs font-semibold">{r.label}</span>
          <span className="text-[10px] opacity-70 tabular-nums">
            {intervals[r.value]}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
