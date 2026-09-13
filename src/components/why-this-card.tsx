"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

import { explainSchedule } from "@/lib/srs/explain";
import type { CardMemory } from "@/lib/srs/fsrs";

/**
 * A small "Why this card?" affordance that expands a plain-language
 * explanation of the FSRS scheduling decision. Builds trust in the schedule.
 */
export function WhyThisCard({ memory }: { memory: CardMemory | null }) {
  const [open, setOpen] = useState(false);
  const reasons = explainSchedule(memory);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition"
      >
        <HelpCircle className="size-3.5" />
        Why this card?
      </button>

      {open && (
        <div className="border-rule bg-popover absolute right-0 z-20 mt-1.5 w-64 space-y-1.5 rounded-lg border p-3 text-xs shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-semibold">How this was scheduled</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <ul className="text-muted-foreground space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden className="text-highlight">
                  •
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground/70 border-t pt-1.5">
            Powered by FSRS-6 spaced repetition.
          </p>
        </div>
      )}
    </div>
  );
}
