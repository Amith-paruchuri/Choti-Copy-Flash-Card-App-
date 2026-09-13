/**
 * Compact backlog breakdown — how overdue each due card actually is, not
 * just a lump "carried over" total. A few days behind and genuinely stale
 * are very different situations; this makes that visible at a glance.
 */
export function DueBreakdown({
  dueToday,
  overdue1to2,
  overdue3to6,
  overdue7to13,
  overdue14plus,
  newAvailable,
}: {
  dueToday: number;
  overdue1to2: number;
  overdue3to6: number;
  overdue7to13: number;
  overdue14plus: number;
  newAvailable: number;
}) {
  const rows = [
    { n: dueToday, label: "due today", color: "var(--sage)" },
    { n: overdue1to2, label: "1–2 days overdue", color: "var(--highlight)" },
    {
      n: overdue3to6,
      label: "3–6 days overdue",
      color: "color-mix(in srgb, var(--highlight) 55%, var(--clay) 45%)",
    },
    {
      n: overdue7to13,
      label: "7–13 days overdue",
      color: "color-mix(in srgb, var(--highlight) 20%, var(--clay) 80%)",
    },
    { n: overdue14plus, label: "14+ days overdue", color: "var(--clay)" },
    { n: newAvailable, label: "new", color: "var(--color-muted-foreground)" },
  ].filter((r) => r.n > 0);

  if (rows.length === 0) return null;

  return (
    <div className="border-rule divide-border w-full divide-y overflow-hidden rounded-lg border text-sm">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between gap-3 px-3 py-1.5"
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span
              className="size-2 flex-none rounded-full"
              style={{ background: r.color }}
            />
            {r.label}
          </span>
          <span className="text-foreground font-medium tabular-nums">
            {r.n}
          </span>
        </div>
      ))}
    </div>
  );
}
