import type { ActivityHeatmap } from "@/lib/queries/activity";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DOW = ["", "Mon", "", "Wed", "", "Fri", ""];

/** count → 0–4 intensity bucket. */
function level(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

// Sage green — the same "good / mastered" colour used for subject mastery and
// the concept-map gradient, so activity reads consistently across the app.
const FILL = [
  "var(--secondary)",
  "color-mix(in srgb, var(--sage) 28%, var(--card))",
  "color-mix(in srgb, var(--sage) 52%, var(--card))",
  "color-mix(in srgb, var(--sage) 78%, var(--card))",
  "var(--sage)",
];

/**
 * GitHub-style contribution calendar of daily study activity. Static (no
 * animation), scrolls horizontally on narrow screens.
 */
export function Heatmap({ data }: { data: ActivityHeatmap }) {
  // Month label sits above the first week whose Sunday is in a new month.
  const monthLabels = data.weeks.map((week, w) => {
    const first = week.find(Boolean);
    if (!first) return "";
    const d = new Date(first.date + "T00:00:00");
    const prev = data.weeks[w - 1]?.find(Boolean);
    const prevMonth = prev
      ? new Date(prev.date + "T00:00:00").getMonth()
      : -1;
    return d.getMonth() !== prevMonth ? MONTHS[d.getMonth()] : "";
  });

  return (
    <div className="border-rule bg-card space-y-3 rounded-xl border p-4">
      <div className="overflow-x-auto">
        <div className="inline-flex gap-2">
          <div className="text-muted-foreground grid grid-rows-7 gap-[3px] pt-[18px] text-[9px] leading-[11px]">
            {DOW.map((d, i) => (
              <span key={i} className="h-[11px]">
                {d}
              </span>
            ))}
          </div>
          <div>
            <div className="text-muted-foreground mb-1 flex text-[10px] leading-none">
              {monthLabels.map((m, i) => (
                <span key={i} className="w-[14px] shrink-0">
                  {m}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {data.weeks.map((week, w) => (
                <div key={w} className="grid grid-rows-7 gap-[3px]">
                  {week.map((day, d) =>
                    day ? (
                      <span
                        key={d}
                        title={`${day.date}: ${day.count} review${day.count === 1 ? "" : "s"}`}
                        className={cn(
                          "size-[11px] rounded-[2px]",
                          day.count === 0 && "ring-1 ring-inset ring-[var(--border)]",
                        )}
                        style={{ background: FILL[level(day.count)] }}
                      />
                    ) : (
                      <span key={d} className="size-[11px]" />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span>
          {data.total > 0
            ? `${data.total} reviews · ${data.activeDays} active day${data.activeDays === 1 ? "" : "s"}`
            : "No reviews in this window yet"}
        </span>
        <span className="flex items-center gap-1">
          Less
          {FILL.map((f, i) => (
            <span
              key={i}
              className={cn(
                "size-[10px] rounded-[2px]",
                i === 0 && "ring-1 ring-inset ring-[var(--border)]",
              )}
              style={{ background: f }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
