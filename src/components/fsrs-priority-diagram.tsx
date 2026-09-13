const W = 300;
const H = 250;

const BOX_A = { x: 10, y: 10, w: 132, h: 56 }; // Your review rating
const BOX_B = { x: 158, y: 10, w: 132, h: 56 }; // Quiz performance
const ENGINE = { x: 65, y: 96, w: 170, h: 54 };
const QUEUE = { x: 35, y: 178, w: 230, h: 62 };

const cx = (b: typeof BOX_A) => b.x + b.w / 2;

function Box({
  b,
  title,
  subtitle,
  fill,
  titleColor = "var(--foreground)",
}: {
  b: { x: number; y: number; w: number; h: number };
  title: string;
  subtitle?: string;
  fill: string;
  titleColor?: string;
}) {
  return (
    <g>
      <rect
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        rx={10}
        fill={fill}
        stroke="var(--border)"
      />
      <text
        x={cx(b)}
        y={b.y + (subtitle ? b.h / 2 - 3 : b.h / 2 + 3)}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={600}
        fill={titleColor}
      >
        {title}
      </text>
      {subtitle && (
        <text
          x={cx(b)}
          y={b.y + b.h / 2 + 12}
          textAnchor="middle"
          fontSize={7.5}
          fill="var(--muted-foreground)"
        >
          {subtitle}
        </text>
      )}
    </g>
  );
}

/** A curved connector with an arrowhead, from the bottom of one box to a point
 * near the top of another. */
function Connector({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const midY = (y1 + y2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
      fill="none"
      stroke="var(--muted-foreground)"
      strokeWidth={1.25}
      markerEnd="url(#fsrs-arrow)"
    />
  );
}

/**
 * Two input sources — self-ratings and quiz answers — feeding one FSRS
 * engine, which outputs a single ordered queue. Illustrates that both inputs
 * drive the same priority system, not separate tracks.
 */
export function FsrsPriorityDiagram() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Diagram: 'Your review rating' and 'Quiz performance' both feed into the FSRS engine, which outputs today's queue, ordered from most urgent to least urgent."
    >
      <defs>
        <marker
          id="fsrs-arrow"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--muted-foreground)" />
        </marker>
      </defs>

      <Connector
        from={[cx(BOX_A), BOX_A.y + BOX_A.h]}
        to={[ENGINE.x + ENGINE.w * 0.28, ENGINE.y - 2]}
      />
      <Connector
        from={[cx(BOX_B), BOX_B.y + BOX_B.h]}
        to={[ENGINE.x + ENGINE.w * 0.72, ENGINE.y - 2]}
      />
      <Connector
        from={[cx(ENGINE), ENGINE.y + ENGINE.h]}
        to={[cx(QUEUE), QUEUE.y - 2]}
      />

      <Box
        b={BOX_A}
        title="Your review rating"
        subtitle="Again · Hard · Good · Easy"
        fill="var(--sage-tint)"
      />
      <Box
        b={BOX_B}
        title="Quiz performance"
        subtitle="Correct · Incorrect"
        fill="var(--sage-tint)"
      />
      <Box
        b={ENGINE}
        title="FSRS engine"
        subtitle="one priority score per card"
        fill="var(--highlight-tint)"
        titleColor="var(--ink)"
      />

      <rect
        x={QUEUE.x}
        y={QUEUE.y}
        width={QUEUE.w}
        height={QUEUE.h}
        rx={10}
        fill="var(--card)"
        stroke="var(--sage)"
        strokeWidth={1.5}
      />
      <text
        x={cx(QUEUE)}
        y={QUEUE.y + 13}
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={600}
        fill="var(--foreground)"
      >
        Today&rsquo;s queue
      </text>
      {/* most-urgent-first ordering, as shrinking bars */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={QUEUE.x + 14}
          y={QUEUE.y + 22 + i * 11}
          width={QUEUE.w - 28 - i * 34}
          height={6}
          rx={3}
          fill="var(--sage)"
          opacity={1 - i * 0.28}
        />
      ))}
      <text
        x={QUEUE.x + QUEUE.w - 14}
        y={QUEUE.y + 19}
        textAnchor="end"
        fontSize={6.5}
        fill="var(--muted-foreground)"
      >
        most urgent
      </text>
      <text
        x={QUEUE.x + QUEUE.w - 14}
        y={QUEUE.y + QUEUE.h - 4}
        textAnchor="end"
        fontSize={6.5}
        fill="var(--muted-foreground)"
      >
        least urgent
      </text>
    </svg>
  );
}
