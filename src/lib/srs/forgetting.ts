/**
 * "Your forgetting curve" — how the learner's recall probability drops with
 * days since last review, built from their real review outcomes and their own
 * FSRS stability, not a generic textbook curve. Pure.
 */
import { projectRecall } from "@/lib/srs/fsrs";

export interface ForgettingBin {
  label: string;
  /** x position: bucket midpoint, in days */
  days: number;
  recalled: number;
  total: number;
  /** recalled / total */
  rate: number;
}

export interface ForgettingCurve {
  /** empirical recall rate per days-since-review bucket (buckets with enough data) */
  bins: ForgettingBin[];
  /** smooth FSRS curve for the learner's median stability */
  model: { days: number; recall: number }[];
  /** median stability (days) the model uses */
  medianStability: number;
  /** whole days at which the model dips below 90% recall — "your interval" */
  intervalAt90: number;
  /** how many qualifying review events fed the empirical points */
  sample: number;
}

const BUCKETS = [
  { min: 1, max: 2, label: "1d", mid: 1 },
  { min: 2, max: 4, label: "2–3d", mid: 3 },
  { min: 4, max: 7, label: "4–6d", mid: 5.5 },
  { min: 7, max: 14, label: "1wk", mid: 10 },
  { min: 14, max: 30, label: "2–4wk", mid: 21 },
  { min: 30, max: 60, label: "1–2mo", mid: 45 },
  { min: 60, max: 120, label: "2–4mo", mid: 90 },
  { min: 120, max: Infinity, label: "4mo+", mid: 150 },
] as const;

const MIN_BIN_SAMPLE = 3;
const MODEL_STEPS = 48;

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function buildForgettingCurve(
  reviews: { elapsedDays: number; recalled: boolean }[],
  stabilities: number[],
): ForgettingCurve {
  const qualifying = reviews.filter((r) => r.elapsedDays >= 1);

  const tally = BUCKETS.map(() => ({ recalled: 0, total: 0 }));
  for (const r of qualifying) {
    const i = BUCKETS.findIndex(
      (b) => r.elapsedDays >= b.min && r.elapsedDays < b.max,
    );
    if (i < 0) continue;
    tally[i].total += 1;
    if (r.recalled) tally[i].recalled += 1;
  }

  const bins: ForgettingBin[] = BUCKETS.map((b, i) => ({
    label: b.label,
    days: b.mid,
    recalled: tally[i].recalled,
    total: tally[i].total,
    rate: tally[i].total > 0 ? tally[i].recalled / tally[i].total : 0,
  })).filter((b) => b.total >= MIN_BIN_SAMPLE);

  const medianStability = Math.max(
    0.5,
    median(stabilities.filter((s) => s > 0)),
  );

  // Span the x-axis to roughly where recall halves — but cap it, because the
  // FSRS-6 tail is very gentle and a 200-day axis is mostly dead flat. The
  // chart uses a sqrt scale so the meaningful early drop still gets room.
  // Always cover the last bin that has data.
  let halfDay = 21;
  for (let t = 3; t <= 240; t += 3) {
    halfDay = t;
    if (projectRecall(medianStability, t) <= 0.5) break;
  }
  const maxDay = Math.min(
    150,
    Math.max(21, halfDay, ...bins.map((b) => b.days * 1.1)),
  );

  const model: { days: number; recall: number }[] = [];
  for (let i = 0; i <= MODEL_STEPS; i += 1) {
    // quadratic spacing → dense near t=0 (where the curve bends), sparse in the
    // flat tail. Lines up evenly on the chart's sqrt x-axis.
    const f = i / MODEL_STEPS;
    const days = f * f * maxDay;
    model.push({ days, recall: projectRecall(medianStability, days) });
  }

  let intervalAt90 = maxDay;
  for (let t = 1; t <= maxDay; t += 1) {
    if (projectRecall(medianStability, t) < 0.9) {
      intervalAt90 = t;
      break;
    }
  }

  return {
    bins,
    model,
    medianStability: Math.round(medianStability * 10) / 10,
    intervalAt90,
    sample: qualifying.length,
  };
}
