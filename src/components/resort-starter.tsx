"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { startResort } from "@/actions/resort";
import { Button } from "@/components/ui/button";
import { SubjectIcon } from "@/components/subject-icon";
import { guessSubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";
import type { ResortCandidate } from "@/lib/queries/subjects";

export function ResortStarter({ candidates }: { candidates: ResortCandidate[] }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.map((c) => c.id)),
  );
  const [running, start] = useTransition();

  const allOn = selected.size === candidates.length;
  const count = selected.size;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run() {
    if (count === 0) {
      toast.error("Pick at least one subject to re-sort.");
      return;
    }
    start(async () => {
      const res = await startResort([...selected]);
      // On success the action redirects; we only get here on failure.
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {count} of {candidates.length} selected
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() =>
            setSelected(
              allOn ? new Set() : new Set(candidates.map((c) => c.id)),
            )
          }
        >
          {allOn ? "Clear all" : "Select all"}
        </Button>
      </div>

      <ul className="border-rule divide-border divide-y overflow-hidden rounded-xl border">
        {candidates.map((c) => {
          const on = selected.has(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                  on ? "bg-secondary" : "hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 flex-none place-items-center rounded-md border",
                    on
                      ? "border-transparent text-white"
                      : "border-rule text-transparent",
                  )}
                  style={on ? { backgroundColor: c.color } : undefined}
                >
                  <Check className="size-3.5" />
                </span>
                <span
                  className="grid size-6 flex-none place-items-center rounded-md text-white"
                  style={{ backgroundColor: c.color }}
                >
                  <SubjectIcon
                    icon={guessSubjectIcon(c.name)}
                    className="size-3.5"
                  />
                </span>
                <span className="flex-1 text-sm font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {c.cardCount} card{c.cardCount === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Button onClick={run} disabled={running} size="lg" className="w-full">
        {running
          ? "Asking the AI…"
          : `Re-sort ${count} subject${count === 1 ? "" : "s"} with AI`}
      </Button>
      <p className="text-muted-foreground text-xs">
        The AI suggests a broad → specific home for every card. You review and
        adjust the grouping before anything moves.
      </p>
    </div>
  );
}
