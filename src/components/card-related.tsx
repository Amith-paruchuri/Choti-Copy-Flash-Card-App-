"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Network, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  findRelatedCards,
  removeCardLink,
} from "@/actions/flashcard-links";
import { cn } from "@/lib/utils";
import type { RelatedCard } from "@/lib/queries/flashcard-links";

/**
 * The "Related" section on a card back — AI-detected links to the learner's
 * other cards. These links are also the edges of the knowledge-map graph.
 */
export function CardRelated({
  flashcardId,
  related,
}: {
  flashcardId: string;
  related: RelatedCard[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  function find() {
    start(async () => {
      const res = await findRelatedCards({ flashcardId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.added === 0) {
        toast.message("No new related cards found.");
      } else {
        toast.success(
          `Linked ${res.data.added} related card${res.data.added === 1 ? "" : "s"}.`,
        );
      }
      router.refresh();
    });
  }

  function remove(relatedId: string) {
    setRemoving(relatedId);
    start(async () => {
      const res = await removeCardLink({ flashcardId, relatedId });
      setRemoving(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (related.length === 0) {
    return (
      <button
        type="button"
        onClick={find}
        disabled={pending}
        className="text-ink hover:text-ink/80 mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition disabled:opacity-60"
      >
        <Sparkles className={cn("size-3.5", pending && "animate-pulse")} />
        {pending ? "Looking for connections…" : "Find related concepts"}
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
        <Network className="size-3" /> Related
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {related.map((r) => (
          <li key={r.id}>
            <span
              className={cn(
                "border-rule bg-secondary/60 inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2 text-xs",
                removing === r.id && "opacity-50",
              )}
            >
              <Link
                href={`/subjects/${r.subjectId}?card=${r.id}`}
                className="hover:text-ink inline-flex items-center gap-1.5 transition"
              >
                <span
                  className="size-1.5 flex-none rounded-full"
                  style={{
                    backgroundColor:
                      r.subjectColor ?? "var(--color-muted-foreground)",
                  }}
                />
                <span className="max-w-[11rem] truncate">
                  {r.title ?? "Untitled"}
                </span>
                {r.relation && (
                  <span className="text-muted-foreground/70">· {r.relation}</span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={pending}
                aria-label={`Remove link to ${r.title ?? "card"}`}
                className="text-muted-foreground hover:text-clay grid size-4 place-items-center rounded-full transition"
              >
                <X className="size-3" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={find}
        disabled={pending}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition disabled:opacity-60"
      >
        <Sparkles className="size-3" />
        {pending ? "Looking…" : "Find more"}
      </button>
    </div>
  );
}
