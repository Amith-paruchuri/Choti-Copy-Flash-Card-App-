import type { ActivityHeatmap, HeatmapDay } from "@/lib/queries/activity";

export interface DailyCount {
  date: string;
  count: number;
}

/**
 * Flatten the heatmap's week-grid into a plain chronological series and take
 * the trailing `days` entries — same `review_events` counts as the heatmap,
 * just reshaped for a line chart. No extra query: the heatmap is already
 * fetched wider (26 weeks) than any reasonable trend window.
 */
export function dailyReviewCounts(
  heatmap: Pick<ActivityHeatmap, "weeks">,
  days = 30,
): DailyCount[] {
  const flat = heatmap.weeks
    .flat()
    .filter((d): d is HeatmapDay => d !== null);
  return flat.slice(-days);
}

/**
 * Default chart window: the last 7 days, or fewer if real activity only
 * started more recently than that — never pad the chart with empty days
 * that predate any actual use. `series` is oldest-first, ending today.
 */
export function autoWindow(series: DailyCount[]): number {
  const firstActive = series.findIndex((d) => d.count > 0);
  if (firstActive === -1) return Math.min(7, series.length);
  const sinceFirstActivity = series.length - firstActive;
  return Math.min(7, sinceFirstActivity) || 1;
}
