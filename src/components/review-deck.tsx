"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { recordReview } from "@/actions/review";
import { DeckCard } from "@/components/deck-card";
import { RATINGS, RatingButtons } from "@/components/rating-buttons";
import { WhyThisCard } from "@/components/why-this-card";
import { Button } from "@/components/ui/button";
import type { CardMemory, RatingValue } from "@/lib/srs/fsrs";
import type { FlashcardWithSubject } from "@/lib/queries/flashcards";

export interface ReviewCard {
  card: FlashcardWithSubject;
  memory: CardMemory | null;
}

export function ReviewDeck({ items: initialItems }: { items: ReviewCard[] }) {
  // A session is a fixed queue decided at the start. `recordReview` refreshes
  // the route's RSC, so ignore later prop changes and keep the snapshot.
  const [items] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [round, setRound] = useState(0);
  const [tally, setTally] = useState<Record<RatingValue, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });

  const done = index >= items.length;
  const current = items[index];

  const rate = useCallback(
    (rating: RatingValue) => {
      if (index >= items.length) return;
      const item = items[index];
      setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
      setFlipped(false);
      setRound((r) => r + 1);
      setIndex((i) => i + 1);
      void recordReview({
        flashcardId: item.card.id,
        rating,
        source: "review",
      }).then((res) => {
        if (res && !res.ok) toast.error(res.error);
        else if (res?.ok && res.data.suspended) {
          toast.message(
            "That card's now a leech — parked until you reactivate it.",
          );
        }
      });
    },
    [index, items],
  );

  // Keyboard: space/enter flips, 1–4 rate once revealed. Ref-guarded so the
  // listener is attached once (dep churn here previously broke event handling).
  const kb = useRef({ flipped, done, rate });
  useEffect(() => {
    kb.current = { flipped, done, rate };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }
      const s = kb.current;
      if (s.done) return;
      if ((e.key === " " || e.key === "Enter") && !s.flipped) {
        e.preventDefault();
        setFlipped(true);
      } else if (s.flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        s.rate(Number(e.key) as RatingValue);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (done) {
    const total = items.length;
    const soon = tally[1] + tally[2];
    return (
      <div className="mx-auto max-w-md space-y-5 py-6 text-center">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold">
            Session complete
          </h1>
          <p className="text-muted-foreground text-sm">
            {total} card{total === 1 ? "" : "s"} reviewed
            {soon > 0
              ? ` · ${soon} coming back soon`
              : " · all on track"}
          </p>
        </div>

        <div className="border-rule grid grid-cols-4 overflow-hidden rounded-xl border text-sm">
          {RATINGS.map((r) => (
            <div key={r.value} className="border-rule border-r px-2 py-3 last:border-r-0">
              <p className="text-lg font-semibold tabular-nums">
                {tally[r.value]}
              </p>
              <p className="text-muted-foreground text-xs">{r.label}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/review">Review more</Link>
          </Button>
        </div>
      </div>
    );
  }

  const pct = Math.round((index / items.length) * 100);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs tabular-nums">
          <span>
            {index + 1} / {items.length}
          </span>
          <div className="flex items-center gap-4">
            <WhyThisCard memory={current.memory} />
            <Link href="/dashboard" className="hover:text-foreground transition">
              End session
            </Link>
          </div>
        </div>
        <div className="bg-secondary mt-1 h-1 overflow-hidden rounded-full">
          <div
            className="bg-highlight h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div
        key={round}
        className={round > 0 ? "deck-slide" : undefined}
        style={{ "--dir": 1 } as React.CSSProperties}
      >
        <DeckCard
          card={current.card}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          remaining={items.length - 1 - index}
          footer={
            <RatingButtons memory={current.memory} onRate={rate} />
          }
        />
      </div>

      {!flipped ? (
        <p className="text-muted-foreground text-center text-xs">
          Tap the card or press Space to reveal
        </p>
      ) : (
        <p className="text-muted-foreground text-center text-xs">
          How well did you recall it? · keys 1–4
        </p>
      )}
    </div>
  );
}
