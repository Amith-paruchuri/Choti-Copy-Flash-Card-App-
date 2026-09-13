"use client";

import { BrainCircuit } from "lucide-react";

import { FsrsForgettingDemo } from "@/components/fsrs-forgetting-demo";
import { FsrsPriorityDiagram } from "@/components/fsrs-priority-diagram";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * "Powered by FSRS" label + a "Read more" trigger that opens a modal with two
 * visual explainers. A modal (not an inline accordion) so the picker's real
 * job — pick a count, start reviewing — never shifts position for a curious
 * click; this is a deliberately skippable aside.
 */
export function FsrsExplainer() {
  return (
    <Dialog>
      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
        <BrainCircuit className="size-3" />
        Powered by FSRS
        <DialogTrigger className="text-ink font-medium underline underline-offset-2 outline-none">
          Read more
        </DialogTrigger>
      </p>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Powered by FSRS</DialogTitle>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Choti Copy schedules every card with FSRS (Free Spaced Repetition
            Scheduler) — the same algorithm behind Anki and other serious
            spaced-repetition tools.
          </p>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Reviewing resets forgetting
          </h3>
          <FsrsForgettingDemo />
          <p className="text-muted-foreground text-xs leading-relaxed">
            This shows how likely you are to still remember a card over time
            — it drops fast at first, then slows down.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Each catch pushes the next review further away.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Every answer feeds the same engine
          </h3>
          <FsrsPriorityDiagram />
          <div className="bg-highlight-tint rounded-lg p-2.5 text-xs leading-relaxed">
            <strong className="text-ink">What decides priority:</strong>{" "}
            Cards you&rsquo;re about to forget rank higher. Cards you rated
            Again or got wrong on a quiz recently rank higher too. Cards you
            know well can wait.
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Self-ratings in the deck and quiz answers both count — there&rsquo;s
            no separate quiz score, just one priority per card.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
