"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  List,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { recordReview } from "@/actions/review";
import { DeckCard } from "@/components/deck-card";
import { FlashcardActions } from "@/components/flashcard-actions";
import { FlashcardItem } from "@/components/flashcard-item";
import { MoveCardsDialog } from "@/components/move-cards-dialog";
import { RatingButtons, ratingLabel } from "@/components/rating-buttons";
import { WhyThisCard } from "@/components/why-this-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RelatedCard } from "@/lib/queries/flashcard-links";
import type { CardMemory, RatingValue } from "@/lib/srs/fsrs";
import type { FlashcardWithSubject } from "@/lib/queries/flashcards";
import type { Subject } from "@/types/database";

export function SubjectDeck({
  cards,
  subjects,
  initialCardId,
  memoryByCard = {},
  relatedByCard = {},
}: {
  cards: FlashcardWithSubject[];
  subjects: Subject[];
  initialCardId?: string;
  /** FSRS state per card id — enables self-rating straight from the folder view. */
  memoryByCard?: Record<string, CardMemory>;
  /** AI-detected related cards per card id. */
  relatedByCard?: Record<string, RelatedCard[]>;
}) {
  const startIndex = initialCardId
    ? Math.max(
        cards.findIndex((c) => c.id === initialCardId),
        0,
      )
    : 0;

  const [view, setView] = useState<"deck" | "list">("deck");
  const [index, setIndex] = useState(startIndex);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const [round, setRound] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [rated, setRated] = useState<Record<string, RatingValue>>({});
  const [rating, setRating] = useState(false);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clampedIndex = Math.min(index, cards.length - 1);

  function go(delta: number) {
    const next = Math.min(Math.max(clampedIndex + delta, 0), cards.length - 1);
    if (next === clampedIndex) return;
    setDir(delta > 0 ? 1 : -1);
    setIndex(next);
    setFlipped(false);
    setRound((r) => r + 1);
  }
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });

  const atLast = clampedIndex === cards.length - 1;

  function rate(value: RatingValue) {
    const c = cards[clampedIndex];
    if (!c || rating) return;
    setRating(true);
    void recordReview({
      flashcardId: c.id,
      rating: value,
      source: "review",
    }).then((res) => {
      setRating(false);
      if (res && !res.ok) {
        toast.error(res.error);
        return;
      }
      setRated((prev) => ({ ...prev, [c.id]: value }));
      if (res?.ok && res.data.suspended) {
        toast.message(
          "That card's now a leech — parked until you reactivate it.",
        );
      }
      if (!atLast) go(1);
    });
  }

  const kbRef = useRef({ flipped, rate, cardId: "", isRated: false });
  useEffect(() => {
    kbRef.current = {
      flipped,
      rate,
      cardId: cards[clampedIndex]?.id ?? "",
      isRated: Boolean(rated[cards[clampedIndex]?.id ?? ""]),
    };
  });

  useEffect(() => {
    if (view !== "deck") return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (typing || document.querySelector('[role="dialog"][data-state="open"]'))
        return;

      const kb = kbRef.current;
      if (
        kb.flipped &&
        !kb.isRated &&
        ["1", "2", "3", "4"].includes(e.key)
      ) {
        e.preventDefault();
        kb.rate(Number(e.key) as RatingValue);
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goRef.current(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") goRef.current(-1);
      else if (e.key === " " || e.key === "Enter") {
        if (el instanceof HTMLElement && el.tagName === "BUTTON") return;
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      `${c.title ?? ""} ${c.subtitle ?? ""} ${c.content}`
        .toLowerCase()
        .includes(q),
    );
  }, [cards, query]);

  const toggle = (
    <div className="border-rule bg-secondary inline-flex rounded-md border p-0.5 text-xs">
      {(
        [
          ["deck", "Deck", Layers],
          ["list", "List", List],
        ] as const
      ).map(([v, label, Icon]) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-[6px] px-2 py-1 transition",
            view === v
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  if (view === "list") {
    const selectedIds = [...selected].filter((id) =>
      cards.some((c) => c.id === id),
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${cards.length} cards…`}
            className="h-9 max-w-xs"
          />
          {toggle}
        </div>

        {selectedIds.length > 0 && (
          <div className="border-rule bg-secondary sticky top-16 z-10 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="font-medium tabular-nums">
              {selectedIds.length} selected
            </span>
            <span className="flex items-center gap-1">
              <Button size="xs" onClick={() => setMoveOpen(true)}>
                Move to…
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </span>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No cards match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((card) => (
              <li key={card.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${card.title ?? "card"}`}
                  checked={selected.has(card.id)}
                  onChange={() => toggleSelect(card.id)}
                  className="mt-4 size-4 flex-none"
                />
                <div className="min-w-0 flex-1">
                  <FlashcardItem
                    card={card}
                    subjects={subjects}
                    related={relatedByCard[card.id] ?? []}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <MoveCardsDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          cardIds={selectedIds}
          subjects={subjects}
          currentSubjectId={cards[0]?.subject_id}
          onMoved={() => setSelected(new Set())}
        />
      </div>
    );
  }

  const card = cards[clampedIndex];
  const pct = Math.round(((clampedIndex + 1) / cards.length) * 100);
  const cardMemory = memoryByCard[card.id] ?? null;
  const cardRating = rated[card.id];

  const deckFooter = (
    <div className="space-y-2">
      {cardRating ? (
        <p className="text-muted-foreground text-center text-xs">
          Rated{" "}
          <span className="text-foreground font-semibold">
            {ratingLabel(cardRating)}
          </span>
          {" · "}
          <button
            type="button"
            onClick={() => setRated((p) => {
              const n = { ...p };
              delete n[card.id];
              return n;
            })}
            className="hover:text-foreground underline transition"
          >
            rate again
          </button>
        </p>
      ) : (
        <RatingButtons
          memory={cardMemory}
          onRate={rate}
          disabled={rating}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setFlipped(false)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition"
        >
          <RotateCcw className="size-3" />
          Flip back
        </button>
        <FlashcardActions card={card} subjects={subjects} />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-xs tabular-nums">
              Card {clampedIndex + 1} of {cards.length}
            </span>
            <WhyThisCard memory={cardMemory} />
          </div>
          <div className="bg-secondary mt-1 h-1 overflow-hidden rounded-full">
            <div
              className="bg-highlight h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {toggle}
      </div>

      <div
        key={round}
        className={round > 0 ? "deck-slide" : undefined}
        style={{ "--dir": dir } as React.CSSProperties}
      >
        <DeckCard
          card={card}
          subjects={subjects}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          remaining={cards.length - 1 - clampedIndex}
          footer={deckFooter}
          related={relatedByCard[card.id] ?? []}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => go(-1)}
          disabled={clampedIndex === 0}
        >
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => go(1)}
          disabled={clampedIndex === cards.length - 1}
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
      <p className="text-muted-foreground hidden text-center text-xs sm:block">
        {flipped
          ? "Rate how well you recalled it · keys 1–4"
          : "← → to move · space to flip"}
      </p>

      <p className="sr-only" aria-live="polite">
        Card {clampedIndex + 1} of {cards.length}
        {flipped ? ", answer shown" : ""}
      </p>
    </div>
  );
}
