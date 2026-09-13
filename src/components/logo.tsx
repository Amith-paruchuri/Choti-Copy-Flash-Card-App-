import { cn } from "@/lib/utils";

/**
 * The Choti Copy mark: an open white "C" with a mint and a violet flashcard
 * fanned beside it. One 64×64 vector, reused for the header, favicon, the
 * app-icon plate and the opening animation.
 *
 * Geometry constants are exported so the intro animation lands on exactly the
 * same shapes.
 */
export const MARK = {
  viewBox: "0 0 64 64",
  c: "M30.5 19 A15 15 0 1 0 30.5 45",
  cStroke: 18,
  mint: { x: 35, y: 18.5, w: 9.5, h: 31, r: 4.5, rot: 9, cx: 39.75, cy: 34 },
  violet: { x: 49, y: 23, w: 8.5, h: 25, r: 4.5, rot: 15, cx: 53.25, cy: 35.5 },
} as const;

export function Logo({
  className,
  withBackdrop = false,
  title = "Choti Copy",
}: {
  className?: string;
  withBackdrop?: boolean;
  title?: string;
}) {
  const m = MARK.mint;
  const v = MARK.violet;
  return (
    <svg
      viewBox={MARK.viewBox}
      role="img"
      aria-label={title}
      className={cn("block", className)}
    >
      <title>{title}</title>

      {withBackdrop && (
        <rect x="-2" y="-2" width="68" height="68" rx="16" fill="#191b21" />
      )}

      <path
        d={MARK.c}
        fill="none"
        stroke={withBackdrop ? "#ffffff" : "var(--logo-c, var(--foreground))"}
        strokeWidth={MARK.cStroke}
        strokeLinecap="round"
      />
      <rect
        x={m.x}
        y={m.y}
        width={m.w}
        height={m.h}
        rx={m.r}
        transform={`rotate(${m.rot} ${m.cx} ${m.cy})`}
        fill={withBackdrop ? "#3ddbb4" : "var(--logo-mint, var(--sage))"}
      />
      <rect
        x={v.x}
        y={v.y}
        width={v.w}
        height={v.h}
        rx={v.r}
        transform={`rotate(${v.rot} ${v.cx} ${v.cy})`}
        fill={withBackdrop ? "#7c6cf3" : "var(--logo-violet, var(--highlight))"}
      />
    </svg>
  );
}
