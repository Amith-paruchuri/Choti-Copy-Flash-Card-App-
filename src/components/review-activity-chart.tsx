"use client";

import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { autoWindow, type DailyCount } from "@/lib/stats/daily-review-counts";

const W = 320;
const H = 150;
const PAD = { l: 24, r: 8, t: 14, b: 20 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const Y_BOTTOM = PAD.t + PLOT_H;

const RANGE_OPTIONS = [7, 30, 90] as const;

/** "2026-09-01" → "Sep 1", parsed as local calendar date (no UTC shift). */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * "Reviews per day" — a line chart of the actual review-events count for
 * each day in the selected window (7/30/90 days, default auto-fit to recent
 * activity). This is the primary daily-activity visual: it reads a recent
 * trend (climbing / flat / dropping) at a glance, which a line does far
 * better than the heatmap's colour intensity. The heatmap further down
 * /stats stays as the secondary, longer view (6 months, consistency/
 * streaks) — different question, different shape. Static SVG + a small
 * amount of pointer-tracking for the tooltip, no chart library.
 */
export function ReviewActivityChart({ data }: { data: DailyCount[] }) {
  const [selectedDays, setSelectedDays] = useState(() => autoWindow(data));
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const shown = useMemo(
    () => data.slice(-selectedDays),
    [data, selectedDays],
  );

  if (shown.length < 1) return null;

  const counts = shown.map((d) => d.count);
  const max = Math.max(...counts);
  const yMax = Math.max(4, Math.ceil(max * 1.15));
  const total = counts.reduce((a, b) => a + b, 0);
  const n = shown.length;

  const x = (i: number) => PAD.l + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
  const y = (v: number) => PAD.t + (1 - v / yMax) * PLOT_H;
  const dotR = n > 45 ? 1.5 : n > 20 ? 2 : 2.5;

  const line = shown
    .map((d, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`)
    .join(" ");
  const area =
    n > 1
      ? `M ${x(0).toFixed(1)} ${Y_BOTTOM} ` +
        shown
          .map((d, i) => `L ${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`)
          .join(" ") +
        ` L ${x(n - 1).toFixed(1)} ${Y_BOTTOM} Z`
      : "";

  const tickIdx =
    n <= 4
      ? shown.map((_, i) => i)
      : [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);

  function nearestIndex(clientX: number): number | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    if (n <= 1) return 0;
    const raw = ((svgX - PAD.l) / PLOT_W) * (n - 1);
    return Math.min(n - 1, Math.max(0, Math.round(raw)));
  }

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const idx = nearestIndex(e.clientX);
    if (idx !== null) setActiveIdx(idx);
  }

  const active = activeIdx !== null ? shown[activeIdx] : null;

  return (
    <section className="border-rule bg-card space-y-3 rounded-xl border p-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Reviews per day</h2>
          <span className="text-sage text-xs font-medium tabular-nums">
            {total} in the last {selectedDays} day{selectedDays === 1 ? "" : "s"}
          </span>
        </div>
        <div className="border-rule bg-secondary inline-flex w-fit rounded-lg border p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setSelectedDays(opt);
                setActiveIdx(null);
              }}
              aria-pressed={selectedDays === opt}
              className={cn(
                "rounded-[7px] px-2.5 py-1 text-[11px] font-medium transition",
                selectedDays === opt
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt}d
            </button>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Cards reviewed each day over the last ${selectedDays} days, totalling ${total}. Hover or tap a point for that day's exact count.`}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        onPointerLeave={() => setActiveIdx(null)}
      >
        {[yMax, yMax / 2].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={PAD.l - 4}
              y={y(v) + 3}
              fontSize={8}
              textAnchor="end"
              fill="var(--color-muted-foreground)"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={Y_BOTTOM}
          y2={Y_BOTTOM}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {area && <path d={area} fill="var(--sage)" opacity={0.14} />}
        {n > 1 && (
          <path
            d={line}
            fill="none"
            stroke="var(--sage)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {shown.map((d, i) => (
          <circle
            key={d.date}
            cx={x(i)}
            cy={y(d.count)}
            r={activeIdx === i ? dotR + 1.5 : dotR}
            fill="var(--sage)"
            stroke="var(--card)"
            strokeWidth={activeIdx === i ? 1.5 : 1}
          />
        ))}

        {tickIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            fontSize={8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fill="var(--color-muted-foreground)"
          >
            {i === n - 1 ? "Today" : shortDate(shown[i].date)}
          </text>
        ))}

        {active && activeIdx !== null && (
          <g pointerEvents="none">
            <line
              x1={x(activeIdx)}
              x2={x(activeIdx)}
              y1={PAD.t}
              y2={Y_BOTTOM}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            {(() => {
              const boxW = 78;
              const boxH = 30;
              const cx = x(activeIdx);
              const bx = Math.max(
                PAD.l - 2,
                Math.min(W - PAD.r - boxW + 2, cx - boxW / 2),
              );
              const preferAbove = y(active.count) - boxH - 8 >= 0;
              const by = preferAbove ? y(active.count) - boxH - 8 : PAD.t + 2;
              return (
                <g>
                  <rect
                    x={bx}
                    y={by}
                    width={boxW}
                    height={boxH}
                    rx={5}
                    fill="var(--popover)"
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                  <text
                    x={bx + boxW / 2}
                    y={by + 12}
                    fontSize={8}
                    fontWeight={600}
                    textAnchor="middle"
                    fill="var(--popover-foreground)"
                  >
                    {shortDate(active.date)}
                  </text>
                  <text
                    x={bx + boxW / 2}
                    y={by + 23}
                    fontSize={8}
                    textAnchor="middle"
                    fill="var(--color-muted-foreground)"
                  >
                    {active.count} review{active.count === 1 ? "" : "s"}
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </section>
  );
}
