"use client";

import { useMemo, useState } from "react";
import { GitBranch, RotateCcw } from "lucide-react";

import { CardMnemonic } from "@/components/card-mnemonic";
import { CardRelated } from "@/components/card-related";
import { FlashcardActions } from "@/components/flashcard-actions";
import { MechanismFlow } from "@/components/mechanism-flow";
import { SubjectIcon } from "@/components/subject-icon";
import { parseMechanism } from "@/lib/mechanism";
import { cn } from "@/lib/utils";
import type { RelatedCard } from "@/lib/queries/flashcard-links";
import type { FlashcardWithSubject } from "@/lib/queries/flashcards";
import type { Subject } from "@/types/database";

export function DeckCard({
  card,
  subjects = [],
  flipped,
  onFlip,
  remaining,
  footer,
  related,
}: {
  card: FlashcardWithSubject;
  subjects?: Subject[];
  flipped: boolean;
  onFlip: () => void;
  /** how many cards sit behind this one in the deck */
  remaining: number;
  /** Replaces the default "Flip back + edit" footer (used by the review deck). */
  footer?: React.ReactNode;
  /** When provided, shows the "Related" section (subject card view only). */
  related?: RelatedCard[];
}) {
  const steps = useMemo(() => parseMechanism(card.content), [card.content]);
  const [asText, setAsText] = useState(false);
  const showFlow = steps && !asText;
  const color = card.subject?.color ?? "var(--color-muted-foreground)";

  return (
    <div className="relative mx-auto max-w-md">
      {/* stack behind, hinting there's more */}
      {remaining >= 1 && (
        <div
          aria-hidden
          className="border-rule bg-card absolute inset-x-2 -bottom-1.5 -z-10 h-8 rounded-xl border"
        />
      )}
      {remaining >= 2 && (
        <div
          aria-hidden
          className="border-rule bg-card absolute inset-x-4 -bottom-3 -z-20 h-8 rounded-xl border"
        />
      )}

      <div
        className="dogear border-rule bg-card relative flex h-[19rem] flex-col rounded-xl border p-5 shadow-[0_1px_2px_rgba(42,38,34,0.05),0_10px_30px_-12px_rgba(42,38,34,0.18)] sm:h-[22rem]"
        style={{ "--dogear-color": color } as React.CSSProperties}
      >
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span
            className="grid size-5 place-items-center rounded-md text-white"
            style={{ backgroundColor: color }}
          >
            <SubjectIcon icon={card.subject?.icon} className="size-3" />
          </span>
          {card.subject?.name}
        </span>

        {flipped ? (
          <>
            <div className="card-face @container min-h-0 flex-1 overflow-y-auto pt-3">
              {showFlow ? (
                <MechanismFlow steps={steps} />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {card.content}
                </p>
              )}
              {card.imageUrls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
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
                  className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-xs transition"
                >
                  <GitBranch className="size-3" />
                  {asText ? "Show as flowchart" : "Show as text"}
                </button>
              )}
              <CardMnemonic
                flashcardId={card.id}
                mnemonic={card.mnemonic}
              />
              {related !== undefined && (
                <CardRelated flashcardId={card.id} related={related} />
              )}
            </div>
            {footer ? (
              <div className="mt-3 border-t pt-3">{footer}</div>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={onFlip}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition"
                >
                  <RotateCcw className="size-3" />
                  Flip back
                </button>
                <FlashcardActions card={card} subjects={subjects} />
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onFlip}
            className="card-face focus-visible:ring-ring -m-5 flex flex-1 flex-col rounded-xl p-5 text-left"
            aria-label="Reveal answer"
          >
            <span className="flex flex-1 flex-col justify-center gap-2 py-2">
              <span
                className={cn(
                  "font-display text-lg leading-snug font-semibold text-balance",
                  !card.title && "text-base font-normal",
                )}
              >
                {card.title ?? card.content}
              </span>
              {card.subtitle && (
                <span className="text-muted-foreground text-sm">
                  {card.subtitle}
                </span>
              )}
            </span>
            <span className="text-muted-foreground text-center text-xs">
              Tap to reveal
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
