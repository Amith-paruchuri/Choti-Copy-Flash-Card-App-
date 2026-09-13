import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface HeatmapDay {
  /** YYYY-MM-DD, local time */
  date: string;
  count: number;
}

export interface ActivityHeatmap {
  /** Sundays-aligned grid, oldest week first. `days[w][d]` — d 0=Sun … 6=Sat. */
  weeks: (HeatmapDay | null)[][];
  total: number;
  activeDays: number;
  /** Longest run of consecutive active days ending today or yesterday. */
  currentStreak: number;
  /** Longest run anywhere in the window. */
  bestStreak: number;
}

const DAY = 864e5;
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/**
 * GitHub-style contribution calendar from `review_events` timestamps. Default
 * 26 weeks keeps it readable on a phone; the /stats page can pass more.
 */
export async function getActivityHeatmap(
  weeks = 26,
): Promise<ActivityHeatmap> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Grid starts on the Sunday `weeks-1` weeks before this week's Sunday.
  const thisSunday = new Date(now.getTime() - now.getDay() * DAY);
  const start = new Date(thisSunday.getTime() - (weeks - 1) * 7 * DAY);

  const supabase = await createClient();
  const { data } = await supabase
    .from("review_events")
    .select("reviewed_at")
    .gte("reviewed_at", start.toISOString())
    .limit(20000);

  const perDay = new Map<string, number>();
  for (const row of data ?? []) {
    const k = key(new Date(row.reviewed_at));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }

  const grid: (HeatmapDay | null)[][] = [];
  let total = 0;
  let activeDays = 0;
  for (let w = 0; w < weeks; w += 1) {
    const week: (HeatmapDay | null)[] = [];
    for (let d = 0; d < 7; d += 1) {
      const cell = new Date(start.getTime() + (w * 7 + d) * DAY);
      if (cell.getTime() > now.getTime()) {
        week.push(null); // future days in the current week
        continue;
      }
      const k = key(cell);
      const count = perDay.get(k) ?? 0;
      if (count > 0) {
        total += count;
        activeDays += 1;
      }
      week.push({ date: k, count });
    }
    grid.push(week);
  }

  // Streaks from the flat per-day series.
  const todayKey = key(now);
  const yesterdayKey = key(new Date(now.getTime() - DAY));
  let currentStreak = 0;
  const anchor = perDay.has(todayKey)
    ? now
    : perDay.has(yesterdayKey)
      ? new Date(now.getTime() - DAY)
      : null;
  if (anchor) {
    for (let i = 0; i < weeks * 7; i += 1) {
      if (perDay.has(key(new Date(anchor.getTime() - i * DAY)))) currentStreak += 1;
      else break;
    }
  }

  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < weeks * 7; i += 1) {
    if (perDay.has(key(new Date(start.getTime() + i * DAY)))) {
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }

  return { weeks: grid, total, activeDays, currentStreak, bestStreak };
}
