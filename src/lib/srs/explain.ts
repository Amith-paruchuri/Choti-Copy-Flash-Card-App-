/**
 * Plain-language "why is this card in my session" reasons, derived from the
 * card's FSRS state. Pure and client-safe — mirrors the signals in
 * `studyPriority` (due-ness, retrievability, lapses, relearning).
 */
import { isDue, retrievability, State, type CardMemory } from "@/lib/srs/fsrs";

function agoLabel(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function explainSchedule(
  memory: CardMemory | null,
  now: Date = new Date(),
): string[] {
  if (!memory || memory.reps === 0) {
    return ["New card — you haven’t studied this one yet."];
  }

  const out: string[] = [];

  if (memory.last_review) {
    out.push(`Last reviewed ${agoLabel(memory.last_review, now)}.`);
  }

  const r = retrievability(memory, now);
  out.push(`Estimated recall right now: ~${Math.round(r * 100)}%.`);

  if (isDue(memory, now)) {
    const overdue = Math.floor(
      (now.getTime() - new Date(memory.due).getTime()) / 864e5,
    );
    out.push(
      overdue >= 1
        ? `Due ${overdue} day${overdue === 1 ? "" : "s"} ago — overdue.`
        : "Due for review today.",
    );
  } else {
    out.push("Not strictly due yet — pulled in to reinforce a weak spot.");
  }

  if (memory.state === State.Relearning) {
    out.push("Currently relearning after a recent miss.");
  }
  if (memory.lapses >= 2) {
    out.push(`Missed ${memory.lapses} times before — it needs the extra reps.`);
  }

  return out;
}

/** One-line summary for a compact affordance. */
export function scheduleHeadline(
  memory: CardMemory | null,
  now: Date = new Date(),
): string {
  if (!memory || memory.reps === 0) return "New card";
  const r = Math.round(retrievability(memory, now) * 100);
  if (memory.state === State.Relearning) return `Relearning · ~${r}% recall`;
  if (isDue(memory, now)) return `Due · ~${r}% recall`;
  return `~${r}% recall`;
}
