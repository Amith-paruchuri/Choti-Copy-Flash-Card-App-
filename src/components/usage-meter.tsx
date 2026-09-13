import { Progress } from "@/components/ui/progress";

/**
 * One usage metric against its tier cap: a labelled bar plus a soft-warn note
 * once it's close to or past the limit. Enforcement is soft for now (see
 * `src/lib/usage/caps.ts`) — nothing here blocks anything, it just tells the
 * user where they stand.
 */
export function UsageMeter({
  label,
  used,
  cap,
  format = (n) => n.toLocaleString(),
  note,
}: {
  label: string;
  used: number;
  cap: number;
  format?: (n: number) => string;
  note?: string;
}) {
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  const over = used >= cap;
  const near = !over && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {format(used)} / {format(cap)}
        </span>
      </div>
      <Progress
        value={pct}
        indicatorClassName={over ? "bg-clay" : near ? "bg-highlight" : "bg-primary"}
      />
      {(over || near) && (
        <p className={over ? "text-clay text-xs" : "text-muted-foreground text-xs"}>
          {over
            ? "Over today's soft limit — nothing is blocked, but consider spacing things out."
            : "Nearing today's soft limit."}
        </p>
      )}
      {note && !over && !near && (
        <p className="text-muted-foreground text-xs">{note}</p>
      )}
    </div>
  );
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
