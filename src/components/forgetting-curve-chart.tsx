import type { ForgettingCurve } from "@/lib/srs/forgetting";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const W = 320;
const H = 176;
const PAD = { l: 22, r: 10, t: 10, b: 20 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const Y_BOTTOM = PAD.t + PLOT_H;

/**
 * "Your forgetting curve" — the FSRS decay curve for the learner's own median
 * stability, with dots for their real per-interval recall rate laid over it.
 * Static SVG in the app palette; no chart library.
 */
export function ForgettingCurveChart({ curve }: { curve: ForgettingCurve }) {
  const { model, bins, medianStability, intervalAt90, sample } = curve;
  const maxDay = model[model.length - 1]?.days || 60;

  // sqrt x-scale: the meaningful decay happens in the first days, and FSRS-6
  // has a long gentle tail — sqrt gives the early drop room while still
  // showing the tail.
  const x = (d: number) =>
    PAD.l + Math.sqrt(Math.max(0, d) / maxDay) * PLOT_W;
  const y = (r: number) => PAD.t + (1 - clamp01(r)) * PLOT_H;

  const line = model
    .map((p, i) => `${i ? "L" : "M"} ${x(p.days).toFixed(1)} ${y(p.recall).toFixed(1)}`)
    .join(" ");
  const area =
    `M ${x(0).toFixed(1)} ${Y_BOTTOM} ` +
    model
      .map((p) => `L ${x(p.days).toFixed(1)} ${y(p.recall).toFixed(1)}`)
      .join(" ") +
    ` L ${x(maxDay).toFixed(1)} ${Y_BOTTOM} Z`;

  const xTicks = [7, 14, 30, 60, 90, 150]
    .filter((d) => d <= maxDay)
    .filter((d, i, a) => a.indexOf(d) === i)
    .concat(maxDay)
    .filter((d, i, a) => a.indexOf(d) === i)
    .slice(0, 5);

  const personal = sample >= 10 && bins.length >= 2;

  return (
    <section className="border-rule bg-card space-y-3 rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Your forgetting curve</h2>
        <span className="text-sage text-xs font-medium tabular-nums">
          ~{intervalAt90}d above 90%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Recall probability against days since last review. It stays above 90% for about ${intervalAt90} days, based on a median stability of ${medianStability} days.`}
      >
        {[0.9, 0.5].map((r) => (
          <g key={r}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(r)}
              y2={y(r)}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray={r === 0.9 ? "3 3" : "1 4"}
            />
            <text
              x={PAD.l - 4}
              y={y(r) + 3}
              fontSize={8}
              textAnchor="end"
              fill="var(--color-muted-foreground)"
            >
              {r * 100}%
            </text>
          </g>
        ))}

        <path d={area} fill="var(--highlight)" opacity={0.12} />
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinecap="round"
        />

        <line
          x1={x(intervalAt90)}
          x2={x(intervalAt90)}
          y1={y(0.9)}
          y2={Y_BOTTOM}
          stroke="var(--sage)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />

        {personal &&
          bins.map((b) => (
            <circle
              key={b.label}
              cx={x(b.days)}
              cy={y(b.rate)}
              r={Math.max(2.5, Math.min(6, 2 + Math.sqrt(b.total)))}
              fill="var(--foreground)"
              stroke="var(--card)"
              strokeWidth={1.5}
            >
              <title>{`${b.label}: ${Math.round(b.rate * 100)}% recalled (${b.total} reviews)`}</title>
            </circle>
          ))}

        {xTicks.map((d) => (
          <text
            key={d}
            x={x(d)}
            y={H - 6}
            fontSize={8}
            textAnchor="middle"
            fill="var(--color-muted-foreground)"
          >
            {d}d
          </text>
        ))}
      </svg>

      <p className="text-muted-foreground text-xs leading-relaxed">
        {personal ? (
          <>
            Your recall holds above 90% for roughly{" "}
            <strong className="text-foreground">{intervalAt90} days</strong>{" "}
            after a review (median stability {medianStability}d). The dots are
            your {sample.toLocaleString()} real review outcomes; the line is what
            FSRS predicts for you. Every successful review pushes the curve right
            — you forget slower.
          </>
        ) : (
          <>
            Projected from your current cards: a median stability of{" "}
            {medianStability}d means recall stays above 90% for about{" "}
            {intervalAt90} days after a review. This gets personal — with dots
            from your real results — as you log more reviews.
          </>
        )}
      </p>
    </section>
  );
}
