import type { Metadata } from "next";
import Link from "next/link";
import { Bug } from "lucide-react";

import { SubjectIcon } from "@/components/subject-icon";
import { ReactivateButton } from "@/components/leech-actions";
import { listLeeches } from "@/lib/queries/leech";
import { LEECH_LAPSES } from "@/lib/srs/leech";

export const metadata: Metadata = { title: "Leeches" };

export default async function LeechesPage() {
  const leeches = await listLeeches();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="bg-clay-tint text-clay grid size-9 place-items-center rounded-xl">
            <Bug className="size-5" />
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Leeches
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Cards you&rsquo;ve missed {LEECH_LAPSES}+ times get parked here, out of
          review and quiz rotation. Rewrite the card so it&rsquo;s easier to
          recall, then reactivate it.
        </p>
      </header>

      {leeches.length === 0 ? (
        <div className="border-rule text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
          No leeches — nothing has tripped the {LEECH_LAPSES}-lapse threshold.
          <br />
          That&rsquo;s the good outcome.
        </div>
      ) : (
        <ul className="border-rule divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {leeches.map(({ card, lapses }) => (
            <li
              key={card.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <span
                className="grid size-6 flex-none place-items-center rounded-md text-white"
                style={{
                  backgroundColor:
                    card.subject?.color ?? "var(--color-muted-foreground)",
                }}
              >
                <SubjectIcon icon={card.subject?.icon ?? null} className="size-3.5" />
              </span>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/subjects/${card.subject_id}?card=${card.id}`}
                  className="hover:text-ink block truncate text-sm font-medium transition"
                >
                  {card.title || card.content.slice(0, 80)}
                </Link>
                <p className="text-muted-foreground truncate text-xs">
                  {card.subject?.name ?? "—"} · {lapses} lapses
                </p>
              </div>

              <ReactivateButton flashcardId={card.id} />
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/stats"
        className="text-muted-foreground hover:text-foreground block text-center text-sm transition"
      >
        ← Back to progress
      </Link>
    </main>
  );
}
