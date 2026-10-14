"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { CountUp } from "@/components/motion/count-up";
import { EASE_OUT } from "@/lib/motion";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Top-of-page story for the Progress screen: how many reviews this week,
 * the seven days as bars that rise in, and one clear thing to do next.
 */
export function WeekHero({
  week,
  focus,
}: {
  week: { date: string; count: number }[];
  focus: { id: string; name: string } | null;
}) {
  const reduce = useReducedMotion();
  const total = week.reduce((n, d) => n + d.count, 0);
  const max = Math.max(1, ...week.map((d) => d.count));
  const best = week.reduce((a, d) => (d.count > a.count ? d : a), week[0]);
  const bestName = best
    ? DAYS[new Date(`${best.date}T00:00:00Z`).getUTCDay()]
    : "";

  return (
    <section className="border-rule bg-card rounded-2xl border p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs">Last 7 days</p>
          <p className="font-display text-4xl leading-none font-semibold tabular-nums">
            <CountUp value={total} />
            <span className="text-muted-foreground ml-2 text-base font-normal">
              reviews
            </span>
          </p>
        </div>
        {total > 0 && (
          <p className="text-muted-foreground text-right text-xs">
            Best day
            <span className="text-foreground block text-sm font-semibold">
              {bestName} · {best.count}
            </span>
          </p>
        )}
      </div>

      <div className="mt-5 flex h-24 items-end gap-2" aria-hidden>
        {week.map((d, i) => {
          const isToday = i === week.length - 1;
          const h = d.count === 0 ? 6 : Math.max(10, (d.count / max) * 100);
          return (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <motion.div
                className={
                  isToday
                    ? "bg-highlight w-full rounded-md"
                    : d.count === 0
                      ? "bg-secondary w-full rounded-md"
                      : "bg-sage w-full rounded-md"
                }
                initial={reduce ? false : { height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.15 + i * 0.06 }}
              />
              <span className="text-muted-foreground text-[10px]">
                {DAYS[new Date(`${d.date}T00:00:00Z`).getUTCDay()].slice(0, 1)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-4 text-sm">
        {total === 0
          ? "Nothing logged yet. One review today puts you on the board."
          : focus
            ? "Worth a look next: "
            : "Nice and steady. Keep it going."}
        {total > 0 && focus && (
          <Link
            href={`/subjects/${focus.id}`}
            className="text-ink font-medium hover:underline"
          >
            {focus.name} →
          </Link>
        )}
      </p>
    </section>
  );
}
