"use client";

import { motion, useReducedMotion } from "motion/react";

const COLORS = [
  "var(--color-sage)",
  "var(--color-highlight)",
  "var(--color-ink)",
  "var(--color-clay)",
];

/** A small one-shot burst of dots, radiating from the centre of its parent. */
export function Celebrate({ count = 16 }: { count?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.2;
        const dist = 70 + (i % 3) * 28;
        return (
          <motion.span
            key={i}
            className="absolute size-2 rounded-full"
            style={{ backgroundColor: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              scale: [0, 1.2, 0.6],
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
        );
      })}
    </div>
  );
}
