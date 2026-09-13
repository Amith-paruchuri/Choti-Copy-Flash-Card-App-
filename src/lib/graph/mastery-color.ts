/**
 * Concept-map node fill: a red → yellow → green gradient driven by Mastery %
 * (0–100). Stops are the app palette — clay / turmeric / sage — passed in as
 * resolved colours so the caller can read them live from CSS tokens (dark mode
 * works for free). Interpolated in sRGB; these earthy tones stay tasteful
 * through the midpoints.
 */

type RGB = [number, number, number];

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Parse `#rgb`, `#rrggbb`, or `rgb(r, g, b[ / a])` to an RGB triple. */
export function parseColor(input: string): RGB {
  const s = input.trim();
  const hex = s.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map((p) => parseFloat(p));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  return [128, 128, 128];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

export interface MasteryStops {
  /** 0% */
  low: string;
  /** 50% */
  mid: string;
  /** 100% */
  high: string;
}

/**
 * `pct` 0–100 → an `rgb(...)` string on the low→mid→high ramp. Values outside
 * the range are clamped.
 */
export function masteryColor(pct: number, stops: MasteryStops): string {
  const p = clamp(pct, 0, 100) / 100;
  const low = parseColor(stops.low);
  const mid = parseColor(stops.mid);
  const high = parseColor(stops.high);
  const rgb =
    p <= 0.5 ? mix(low, mid, p / 0.5) : mix(mid, high, (p - 0.5) / 0.5);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
