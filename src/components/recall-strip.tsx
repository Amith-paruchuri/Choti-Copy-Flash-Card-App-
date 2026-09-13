"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";

import { shuffleRecall } from "@/actions/recall";
import { RECALL_COUNT } from "@/lib/constants";
import type { FlashcardWithSubject } from "@/lib/queries/flashcards";
import { cn } from "@/lib/utils";

export function RecallStrip({ initial }: { initial: FlashcardWithSubject[] }) {
  const [cards, setCards] = useState(initial);
  const [round, setRound] = useState(0);
  const [pending, start] = useTransition();
  const scrollerRef = useRef<HTMLDivElement>(null);

  function reroll() {
    start(async () => {
      try {
        setCards(await shuffleRecall(RECALL_COUNT));
        setRound((r) => r + 1);
        scrollerRef.current?.scrollTo({ left: 0 });
      } catch {
        toast.error("Couldn't shuffle. Try again.");
      }
    });
  }

  if (cards.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold">Today&rsquo;s recall</h2>
        <button
          type="button"
          onClick={reroll}
          disabled={pending}
          aria-label="Shuffle recall cards"
          className="text-ink focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium transition disabled:opacity-50"
        >
          <Shuffle
            className="text-highlight size-3.5 transition-transform duration-300"
            style={{ transform: `rotate(${round * 180}deg)` }}
          />
          Shuffle
        </button>
      </div>

      <div
        ref={scrollerRef}
        className={cn(
          "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 transition-opacity",
          pending && "opacity-50",
        )}
      >
        {cards.map((card, i) => (
          <Link
            key={`${round}-${card.id}`}
            href={`/subjects/${card.subject_id}`}
            style={
              {
                "--i": i,
                "--dogear-color": card.subject?.color ?? "var(--color-muted-foreground)",
              } as React.CSSProperties
            }
            className="dogear card-in border-rule bg-card hover:border-foreground/15 relative flex w-60 shrink-0 snap-start flex-col gap-1.5 rounded-xl border p-4 shadow-[0_1px_2px_rgba(42,38,34,0.05),0_6px_20px_-8px_rgba(42,38,34,0.14)] transition"
          >
            {card.title ? (
              <>
                <span className="font-display line-clamp-2 text-sm font-semibold">
                  {card.title}
                </span>
                {card.subtitle && (
                  <span className="text-muted-foreground line-clamp-2 text-xs">
                    {card.subtitle}
                  </span>
                )}
              </>
            ) : (
              <span className="line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap">
                {card.content}
              </span>
            )}

            {card.subject && (
              <span className="text-muted-foreground mt-auto inline-flex items-center gap-1.5 pt-1.5 text-xs">
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: card.subject.color }}
                />
                {card.subject.name}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
