import { cn } from "@/lib/utils";

/**
 * "14 of 30 AI cards used today" — a small, inline readout next to the
 * feature it describes, not a big progress bar. `cap: null` (Pro's
 * uncapped weekly imports) renders nothing. `trialDaysLeft` appends
 * "(Pro trial — N days left)" so a trialing user knows why their limit is
 * the generous Pro number and that it's temporary.
 */
export function FeatureUsageNote({
  used,
  cap,
  label,
  period = "today",
  trialDaysLeft = null,
}: {
  used: number;
  cap: number | null;
  label: string;
  period?: string;
  trialDaysLeft?: number | null;
}) {
  if (cap === null) return null;
  const over = used >= cap;
  return (
    <p
      className={cn(
        "text-xs tabular-nums",
        over ? "text-clay font-medium" : "text-muted-foreground",
      )}
    >
      {used} of {cap} {label} used {period}
      {trialDaysLeft != null &&
        ` (Pro trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left)`}
    </p>
  );
}
