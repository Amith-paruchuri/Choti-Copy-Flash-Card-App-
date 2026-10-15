import type { TierLimits } from "@/lib/billing/limits";

/** Same on every plan, never gated. */
export const UNLIMITED_FOR_EVERYONE = [
  "Unlimited flashcards & subjects",
  "Spaced repetition (FSRS) reviews",
  "Full stats & history",
  "Search and non-PDF/image imports",
];

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** Concrete numbers straight from limits.ts, so the cards can't drift from what is enforced. */
export function tierLines(limits: TierLimits): string[] {
  return [
    `${limits.aiCardsPerDay} AI-generated cards/day`,
    `${limits.aiMnemonicsPerDay} AI mnemonics/day`,
    `${limits.aiQuizSetsPerDay} AI quiz sets/day`,
    limits.importsPerWeek === null
      ? "No weekly cap on PDF/image imports"
      : `${limits.importsPerWeek} PDF/image imports/week`,
    `PDF/image imports up to ${mb(limits.importMaxBytes)} MB, ${limits.importMaxPages} pages`,
    limits.processingLabel,
  ];
}

export const PRO_PRICE_RUPEES = 150;
export const TRIAL_DAYS = 15;
