const W = 300;
const H = 172;
const PAD = { l: 20, r: 14, t: 22, b: 34 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

/** Memory strength at the "forgetting" threshold — purely illustrative. */
const FORGET_FRAC = 0.28;
/** Segment durations in arbitrary units — segment 2 is 2.6x longer, which is
 * the whole point being illustrated: a successful review pushes the next
 * review further away. */
const T1 = 1;
const T2 = 2.6;
const SEG1_W = PLOT_W * (T1 / (T1 + T2));
const SEG2_W = PLOT_W - SEG1_W;
const SAMPLES = 28;

const y = (strength: number) => PAD.t + (1 - strength) * PLOT_H;
/** Convex decay from 1 (just reviewed) to FORGET_FRAC (u=1, the next review). */
const strengthAt = (u: number) => Math.pow(FORGET_FRAC, u);

function segmentPath(x0: number, width: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const u = i / SAMPLES;
    const x = x0 + u * width;
    pts.push(`${i ? "L" : "M"} ${x.toFixed(1)} ${y(strengthAt(u)).toFixed(1)}`);
  }
  return pts.join(" ");
}

const x1 = PAD.l + SEG1_W; // first review — segment 1 ends exactly on the line
const x2 = PAD.l + SEG1_W + SEG2_W; // second review — segment 2 ends on the line
const forgetY = y(FORGET_FRAC);

/** One-shot CSS animation, reusing the intro's existing keyframes so this adds
 * no new ones. `.fsrs-anim` (globals.css) turns it off under
 * prefers-reduced-motion — the SVG just renders in its resting state. */
const anim = (rule: string): React.CSSProperties =>
  ({ animation: rule } as React.CSSProperties);

/**
 * Illustrative (not real-data) two-review demo of FSRS's core idea: memory
 * decays after a review, a review right before it crosses the forgetting
 * line resets it — and the next decay is slower and longer.
 */
export function FsrsForgettingDemo() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="A memory-strength chart: after a review, strength decays quickly and is caught right at the forgetting line; after that review, it decays much more slowly, so the next review is much further away."
    >
      {/* y-axis label */}
      <text
        x={9}
        y={PAD.t + PLOT_H / 2}
        textAnchor="middle"
        fontSize={7.5}
        fill="var(--muted-foreground)"
        fontWeight={500}
        transform={`rotate(-90 9 ${PAD.t + PLOT_H / 2})`}
      >
        Recall probability
      </text>

      {/* forgetting threshold */}
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={forgetY}
        y2={forgetY}
        stroke="var(--clay)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <text x={PAD.l} y={forgetY - 5} fontSize={7.5} fill="var(--clay)" fontWeight={500}>
        forgetting line
      </text>

      {/* segment 1 — steep drop */}
      <path
        d={segmentPath(PAD.l, SEG1_W)}
        fill="none"
        stroke="var(--sage)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={140}
        className="fsrs-anim"
        style={{ "--c-len": 140, ...anim("brand-c-reveal 0.9s ease both") } as React.CSSProperties}
      />
      <text
        x={PAD.l + SEG1_W * 0.5}
        y={PAD.t + 8}
        textAnchor="middle"
        fontSize={8}
        fill="var(--muted-foreground)"
        fontWeight={500}
      >
        Steep drop
      </text>

      {/* the reset — reviewed just before the line */}
      <line
        x1={x1}
        x2={x1}
        y1={forgetY}
        y2={PAD.t}
        stroke="var(--highlight)"
        strokeWidth={1}
        strokeDasharray="2 2"
        opacity={0.6}
      />

      {/* segment 2 — flatter, longer drop after a successful review */}
      <path
        d={segmentPath(x1, SEG2_W)}
        fill="none"
        stroke="var(--sage)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={300}
        className="fsrs-anim"
        style={{ "--c-len": 300, ...anim("brand-c-reveal 1.3s ease 0.5s both") } as React.CSSProperties}
      />
      <text
        x={x1 + SEG2_W * 0.5}
        y={PAD.t + 8}
        textAnchor="middle"
        fontSize={8}
        fill="var(--muted-foreground)"
        fontWeight={500}
      >
        Flatter, longer — after a successful review
      </text>

      {/* review markers */}
      {[x1, x2].map((cx, i) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy={forgetY}
            r={3.5}
            fill="var(--highlight)"
            stroke="var(--card)"
            strokeWidth={1.5}
            className="fsrs-anim"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              ...anim(`brand-ring-pulse 0.7s ease ${0.6 + i * 0.7}s both`),
            }}
          />
          <text
            x={cx}
            y={H - 8}
            textAnchor={i === 0 ? "middle" : "end"}
            fontSize={7.5}
            fill="var(--highlight)"
            fontWeight={500}
          >
            Reviewed
          </text>
        </g>
      ))}
    </svg>
  );
}
