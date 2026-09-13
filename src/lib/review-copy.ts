/**
 * The at-a-glance line that explains the due pile: "5 due today · 8 overdue ·
 * 12 new". Splitting overdue from newly-due keeps a big number after a gap
 * from feeling like an unexplained heap — the full day-by-day breakdown lives
 * in the due-breakdown table, this is just the headline. `newAvailable` is
 * how many new cards the daily cap still permits, not the raw new count.
 */
export function dueSummary(
  due: { dueToday: number; overdue: number },
  newAvailable = 0,
): string {
  const parts: string[] = [];
  if (due.dueToday > 0) parts.push(`${due.dueToday} due today`);
  if (due.overdue > 0) parts.push(`${due.overdue} overdue`);
  if (newAvailable > 0) parts.push(`${newAvailable} new`);
  return parts.length > 0 ? parts.join(" · ") : "all caught up";
}
