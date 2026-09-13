"use client";

import { useMemo, useState } from "react";
import { GitBranch } from "lucide-react";

import { CardMnemonic } from "@/components/card-mnemonic";
import { CardRelated } from "@/components/card-related";
import { FlashcardActions } from "@/components/flashcard-actions";
import { MechanismFlow } from "@/components/mechanism-flow";
import { parseMechanism } from "@/lib/mechanism";
import { cn } from "@/lib/utils";
import type { RelatedCard } from "@/lib/queries/flashcard-links";
import type { FlashcardWithSubject } from "@/lib/queries/flashcards";
import type { Subject } from "@/types/database";

/** A flashcard shown fully (list / scan view). */
export function FlashcardItem({
  card,
  subjects,
  related = [],
}: {
  card: FlashcardWithSubject;
  subjects: Subject[];
  related?: RelatedCard[];
}) {
  const steps = useMemo(() => parseMechanism(card.content), [card.content]);
  const [asText, setAsText] = useState(false);
  const showFlow = steps && !asText;

  return (
    <div
      className="dogear border-rule bg-card relative rounded-xl border p-4"
      style={
        {
          "--dogear-color":
            card.subject?.color ?? "var(--color-muted-foreground)",
        } as React.CSSProperties
      }
    >
      {card.title && (
        <div className="mb-2">
          <p className="font-display text-sm font-semibold">{card.title}</p>
          {card.subtitle && (
            <p className="text-muted-foreground text-xs">{card.subtitle}</p>
          )}
        </div>
      )}

      {showFlow ? (
        <div className="@container">
          <MechanismFlow steps={steps} />
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {card.content}
        </p>
      )}

      {card.imageUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {card.imageUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="border-rule max-h-40 rounded-lg border object-contain"
            />
          ))}
        </div>
      )}

      {steps && (
        <button
          type="button"
          onClick={() => setAsText((v) => !v)}
          className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs transition"
        >
          <GitBranch className="size-3" />
          {asText ? "Show as flowchart" : "Show as text"}
        </button>
      )}

      <CardMnemonic flashcardId={card.id} mnemonic={card.mnemonic} />
      <CardRelated flashcardId={card.id} related={related} />

      <div className="text-muted-foreground mt-3 flex items-center justify-between gap-2 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            !card.subject && "invisible",
          )}
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: card.subject?.color }}
          />
          {card.subject?.name}
        </span>
        <FlashcardActions card={card} subjects={subjects} />
      </div>
    </div>
  );
}
