import { scoreColor } from "@/lib/stats-color";
import type { SubjectStat } from "@/lib/queries/stats";

/**
 * Top-level subjects compared on Mastery % (rating history) side by side,
 * weakest first — so the lagging subject is obvious without scrolling the full
 * "Every subject" list. Hand-drawn bars in the app's palette; no chart lib.
 */
export function SubjectMasteryChart({ subjects }: { subjects: SubjectStat[] }) {
  const rows = subjects
    .filter((s) => s.parentId === null && s.cards > 0)
    .map((s) => ({ stat: s, reviewed: s.cards - s.fresh }))
    .sort((a, b) => a.stat.mastery - b.stat.mastery);

  if (rows.length < 2) return null;

  return (
    <section className="border-rule bg-card space-y-3 rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Mastery by subject</h2>
        <span className="text-muted-foreground text-xs">weakest first</span>
      </div>

      <ul className="space-y-2.5">
        {rows.map(({ stat, reviewed }) => (
          <li key={stat.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-medium">{stat.name}</span>
              <span className="text-muted-foreground flex-none tabular-nums">
                {reviewed > 0 ? `${Math.round(stat.mastery)}%` : "—"}
                <span className="text-muted-foreground/70">
                  {" · "}
                  {reviewed}/{stat.cards}
                </span>
              </span>
            </div>
            <div className="bg-secondary h-2 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${Math.max(reviewed > 0 ? 3 : 0, stat.mastery)}%`,
                  background: scoreColor(stat.mastery / 100),
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground/90 text-[11px] leading-relaxed">
        Rating history, not time — rises with correct reviews, dips on lapses.
        Cards you haven&rsquo;t reviewed yet don&rsquo;t count toward the bar.
      </p>
    </section>
  );
}
