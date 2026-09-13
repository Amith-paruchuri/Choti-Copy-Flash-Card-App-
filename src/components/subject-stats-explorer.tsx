"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SubjectDrilldown } from "@/components/subject-drilldown";
import { scoreColor } from "@/lib/stats-color";
import type { SubjectStat } from "@/lib/queries/stats";

function MiniBar({ fraction }: { fraction: number }) {
  return (
    <div className="w-24 flex-none space-y-1 sm:w-32">
      <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(3, fraction * 100)}%`,
            background: scoreColor(fraction),
          }}
        />
      </div>
    </div>
  );
}

/**
 * "Every subject", one level at a time. Same drill-down component as the quiz
 * picker — the top level shows the roots with their rolled-up bars, tapping one
 * drops into its direct children only. Each level's header carries that
 * subject's own combined stats.
 */
export function SubjectStatsExplorer({ subjects }: { subjects: SubjectStat[] }) {
  const [focus, setFocus] = useState<string | null>(null);

  return (
    <SubjectDrilldown
      items={subjects}
      value={focus}
      onChange={setFocus}
      leafHint="No sub-topics — open the subject for its cards."
      renderHeader={(s) => {
        if (!s) return null;
        const reviewed = s.cards - s.fresh;
        return (
          <div className="border-rule bg-secondary/40 space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{s.name}</p>
              <Link
                href={`/subjects/${s.id}`}
                className="text-ink inline-flex flex-none items-center gap-1 text-xs font-medium hover:underline"
              >
                Open <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="bg-secondary h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(3, s.confidence * 100)}%`,
                  background: scoreColor(s.confidence),
                }}
              />
            </div>
            <p className="text-muted-foreground flex flex-wrap gap-x-3 text-[11px] tabular-nums">
              <span>{Math.round(s.confidence * 100)}% recall</span>
              {reviewed > 0 && <span>{Math.round(s.mastery)}% mastery</span>}
              <span>{s.cards} cards</span>
              {s.mastered > 0 && (
                <span className="text-sage">{s.mastered} mastered</span>
              )}
              {s.struggling > 0 && (
                <span className="text-clay">{s.struggling} struggling</span>
              )}
              {s.due > 0 && <span>{s.due} due</span>}
            </p>
          </div>
        );
      }}
      renderTrailing={(s) => (
        <div className="flex flex-none items-center gap-2">
          <MiniBar fraction={s.confidence} />
          <span className="text-muted-foreground w-14 text-right text-[11px] tabular-nums">
            {Math.round(s.confidence * 100)}% · {s.cards}
          </span>
        </div>
      )}
    />
  );
}
