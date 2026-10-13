"use client";

import { motion, useReducedMotion } from "motion/react";

import { EASE_OUT } from "@/lib/motion";

/** A bar fill that grows from 0 to `pct` on mount. Parent supplies the track. */
export function ProgressFill({
  pct,
  className,
}: {
  pct: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { width: "0%" }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 }}
    />
  );
}
