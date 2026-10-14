"use client";

import { useSyncExternalStore } from "react";
import { Flame } from "lucide-react";

const noop = () => () => {};
const clientHour = () => new Date().getHours();
const serverHour = () => -1;

function greetingFor(hour: number): string {
  if (hour < 0) return "Welcome back";
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Time-aware greeting (uses the viewer's clock) plus the study streak. */
export function HomeGreeting({
  name,
  streak,
}: {
  name: string | null;
  streak: number;
}) {
  const hour = useSyncExternalStore(noop, clientHour, serverHour);
  const raw = name?.trim().split(/\s+/)[0] ?? null;
  // Some sign-in providers return names in ALL CAPS; show them as a name.
  const first = raw
    ? raw === raw.toUpperCase()
      ? raw.charAt(0) + raw.slice(1).toLowerCase()
      : raw
    : null;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display truncate text-2xl leading-tight font-semibold tracking-tight">
          {greetingFor(hour)}
          {first ? `, ${first}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm">
          {streak > 0
            ? "Keep the chain going today."
            : "One review today starts a new streak."}
        </p>
      </div>
      <span
        className="border-rule bg-card flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums"
        aria-label={`${streak} day streak`}
      >
        <Flame
          className={streak > 0 ? "text-clay size-4" : "text-muted-foreground size-4"}
          aria-hidden
        />
        {streak}
      </span>
    </div>
  );
}
