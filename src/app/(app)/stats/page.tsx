import type { Metadata } from "next";
import Link from "next/link";
import {
  Bug,
  Flame,
  GraduationCap,
  Sparkles,
  Target,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import { ForgettingCurveChart } from "@/components/forgetting-curve-chart";
import { Heatmap } from "@/components/heatmap";
import { ReviewActivityChart } from "@/components/review-activity-chart";
import { SubjectIcon } from "@/components/subject-icon";
import { SubjectMasteryChart } from "@/components/subject-mastery-chart";
import { SubjectStatsExplorer } from "@/components/subject-stats-explorer";
import { Button } from "@/components/ui/button";
import { getActivityHeatmap } from "@/lib/queries/activity";
import { countLeeches } from "@/lib/queries/leech";
import { getForgettingCurve } from "@/lib/queries/forgetting";
import { getStats } from "@/lib/queries/stats";
import { dailyReviewCounts } from "@/lib/stats/daily-review-counts";

export const metadata: Metadata = { title: "Progress" };

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tint: string;
}) {
  return (
    <div className="border-rule bg-card relative overflow-hidden rounded-xl border p-4">
      <span
        aria-hidden
        className="absolute -top-6 -right-6 size-16 rounded-full opacity-15"
        style={{ background: tint }}
      />
      <Icon className="mb-2 size-4" style={{ color: tint }} />
      <p className="font-display text-2xl leading-none font-semibold tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
      {sub && <p className="text-muted-foreground/70 text-[11px]">{sub}</p>}
    </div>
  );
}

function MasteryBar({
  mastered,
  learning,
  struggling,
  fresh,
}: {
  mastered: number;
  learning: number;
  struggling: number;
  fresh: number;
}) {
  const total = mastered + learning + struggling + fresh || 1;
  const seg = [
    { n: mastered, color: "var(--sage)", label: "mastered" },
    { n: learning, color: "var(--highlight)", label: "learning" },
    { n: struggling, color: "var(--clay)", label: "struggling" },
    { n: fresh, color: "var(--color-muted-foreground)", label: "not started" },
  ];
  return (
    <div className="space-y-2">
      <div className="border-rule flex h-3 overflow-hidden rounded-full border">
        {seg.map(
          (s) =>
            s.n > 0 && (
              <div
                key={s.label}
                style={{ width: `${(s.n / total) * 100}%`, background: s.color }}
              />
            ),
        )}
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {seg.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: s.color }}
            />
            {s.n} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function StatsPage() {
  const [s, leechCount, heatmap, forgetting] = await Promise.all([
    getStats(),
    countLeeches(),
    getActivityHeatmap(26),
    getForgettingCurve(),
  ]);

  if (s.totalCards === 0) {
    return (
      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-16 text-center">
        <h1 className="font-display text-xl font-semibold">No progress yet</h1>
        <p className="text-muted-foreground text-sm">
          Add some cards and start reviewing — this page fills in as you go.
        </p>
        <Button asChild size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Your progress
          </h1>
          <Link
            href="/map"
            className="text-ink hover:text-ink/80 mt-1 inline-flex items-center gap-1 text-sm font-medium transition"
          >
            <Waypoints className="size-4" /> Concept map
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          {s.mastered > 0
            ? `${s.mastered} of ${s.totalCards} cards are sticking. Keep going.`
            : `${s.totalCards} cards in. Review a few and watch this fill in.`}
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <StatTile
          label="day streak"
          value={String(s.streakDays)}
          sub={
            s.studiedToday > 0
              ? `${s.studiedToday} today`
              : "study today to keep it"
          }
          icon={Flame}
          tint="var(--clay)"
        />
        <StatTile
          label="cards mastered"
          value={String(s.mastered)}
          sub={`${pct(s.mastered, s.totalCards)}% of your deck`}
          icon={Sparkles}
          tint="var(--sage)"
        />
        <StatTile
          label="reviews logged"
          value={
            s.reviewsAllTime >= 1000
              ? `${(s.reviewsAllTime / 1000).toFixed(1)}k`
              : String(s.reviewsAllTime)
          }
          sub="ratings + quiz answers"
          icon={GraduationCap}
          tint="var(--primary)"
        />
      </section>

      <ReviewActivityChart data={dailyReviewCounts(heatmap, 90)} />

      <section className="border-rule bg-card space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Where your deck stands</h2>
          {s.due > 0 && (
            <Link
              href={`/review/session?n=${Math.min(s.due, 20)}`}
              className="text-ink text-xs font-medium hover:underline"
            >
              {s.due} due · review →
            </Link>
          )}
        </div>
        <MasteryBar
          mastered={s.mastered}
          learning={s.learning}
          struggling={s.struggling}
          fresh={s.fresh}
        />
        {leechCount > 0 && (
          <Link
            href="/leeches"
            className="text-clay hover:text-clay/80 flex items-center gap-1.5 text-xs font-medium transition"
          >
            <Bug className="size-3.5" />
            {leechCount} leech{leechCount === 1 ? "" : "es"} parked — review and
            reactivate →
          </Link>
        )}
      </section>

      <SubjectMasteryChart subjects={s.subjects} />

      {s.reviewedCards >= 3 && <ForgettingCurveChart curve={forgetting} />}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-semibold">Study activity</h2>
            <p className="text-muted-foreground text-xs">
              The longer view — every day for 6 months, for consistency.
            </p>
          </div>
          <span className="text-muted-foreground flex-none text-xs">
            {heatmap.currentStreak > 0
              ? `${heatmap.currentStreak}-day streak`
              : heatmap.bestStreak > 0
                ? `best: ${heatmap.bestStreak} days`
                : "last 6 months"}
          </span>
        </div>
        <Heatmap data={heatmap} />
      </section>

      {s.weakest.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="text-clay size-4" />
            <h2 className="text-sm font-semibold">Weakest areas</h2>
          </div>
          <ul className="border-rule divide-border bg-card divide-y overflow-hidden rounded-xl border">
            {s.weakest.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="grid size-7 flex-none place-items-center rounded-md text-white"
                  style={{ backgroundColor: w.color }}
                >
                  <SubjectIcon icon={w.icon} className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {w.path.length > 1
                      ? w.path.slice(-2).join(" › ")
                      : w.name}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {Math.round(w.confidence * 100)}% confidence ·{" "}
                    {w.struggling} struggling · {w.cards} cards
                  </p>
                </div>
                <Button asChild size="xs" variant="outline">
                  <Link href={`/quiz?subjects=${w.id}`}>Drill</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold">Every subject</h2>
        <SubjectStatsExplorer subjects={s.subjects} />
      </section>
    </main>
  );
}
