/**
 * A card's coarse learning state, derived from its FSRS memory. Pure and
 * client-safe. Shared by the Progress dashboard and the knowledge-map graph so
 * the two stay visually consistent.
 */
import { retrievability, State, type CardMemory } from "@/lib/srs/fsrs";

export type CardStatus = "new" | "learning" | "struggling" | "mastered";

export function statusOf(
  memory: CardMemory | null,
  now: Date = new Date(),
): CardStatus {
  if (!memory || memory.reps === 0) return "new";
  const r = retrievability(memory, now);
  if (
    memory.lapses >= 2 ||
    memory.state === State.Relearning ||
    (r < 0.7 && memory.reps >= 2)
  ) {
    return "struggling";
  }
  if (
    memory.state === State.Review &&
    memory.stability >= 21 &&
    memory.lapses <= 1
  ) {
    return "mastered";
  }
  return "learning";
}

/** CSS colour token for a status — matches the stats `MasteryBar` segments. */
export function statusColor(status: CardStatus): string {
  switch (status) {
    case "mastered":
      return "var(--sage)";
    case "struggling":
      return "var(--clay)";
    case "learning":
      return "var(--highlight)";
    default:
      return "var(--color-muted-foreground)";
  }
}

export const STATUS_LABEL: Record<CardStatus, string> = {
  mastered: "mastered",
  learning: "learning",
  struggling: "struggling",
  new: "new",
};
