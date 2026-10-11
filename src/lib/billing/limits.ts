import type { SubscriptionTier } from "@/types/database";

/**
 * Single source of truth for free-vs-Pro feature limits — read by server
 * enforcement, the usage meters, and the /billing pricing cards, so the
 * three can never drift out of sync with each other.
 *
 * Day boundary: UTC (matches the existing `ai_usage_daily`/`record_ai_call`
 * convention from migration 0021). Week boundary: UTC calendar week,
 * starting Monday 00:00 UTC.
 *
 * Call `limitsForTier()` with the EFFECTIVE tier (`effectiveTier()` in
 * `src/lib/billing/tier.ts`), not the raw stored one — Pro limits apply
 * during an active 15-day trial and during a canceled subscription's
 * remaining paid period, exactly like the rest of the billing model.
 */
export interface TierLimits {
  aiCardsPerDay: number;
  aiMnemonicsPerDay: number;
  aiQuizSetsPerDay: number;
  /** null = no weekly cap (Pro). */
  importsPerWeek: number | null;
  importMaxBytes: number;
  /** PDF only — a single image import has no page concept. */
  importMaxPages: number;
  processingLabel: string;
}

export const TIER_LIMITS: Record<"free" | "pro", TierLimits> = {
  free: {
    aiCardsPerDay: 30,
    aiMnemonicsPerDay: 5,
    aiQuizSetsPerDay: 2,
    importsPerWeek: 3,
    importMaxBytes: 5 * 1024 * 1024,
    importMaxPages: 20,
    processingLabel: "Standard processing queue",
  },
  pro: {
    aiCardsPerDay: 300,
    aiMnemonicsPerDay: 100,
    aiQuizSetsPerDay: 30,
    importsPerWeek: null,
    importMaxBytes: 50 * 1024 * 1024,
    importMaxPages: 300,
    processingLabel: "Priority processing",
  },
} as const;

export function limitsForTier(tier: SubscriptionTier | string): TierLimits {
  return tier === "pro" || tier === "trialing"
    ? TIER_LIMITS.pro
    : TIER_LIMITS.free;
}

/** The three AI features with their own daily counter (see migration 0024). */
export const FEATURE = {
  cards: "ai_cards",
  mnemonics: "ai_mnemonics",
  quizSets: "ai_quiz_sets",
} as const;
export type FeatureKey = (typeof FEATURE)[keyof typeof FEATURE];

export interface LimitCheck {
  allowed: boolean;
  used: number;
  cap: number;
  /** How much of the requested amount still fits — 0 when already at/over cap. */
  remaining: number;
}

/**
 * Pure budget check: is there room for `amount` more today (or this week)?
 * `cap: null` means uncapped (Pro imports/week) — always allowed.
 */
export function checkLimit(
  used: number,
  cap: number | null,
  amount = 1,
): LimitCheck {
  if (cap === null) {
    return { allowed: true, used, cap: Infinity, remaining: Infinity };
  }
  const remaining = Math.max(0, cap - used);
  return { allowed: remaining >= amount, used, cap, remaining };
}

const FEATURE_LABEL: Record<FeatureKey, string> = {
  [FEATURE.cards]: "AI-generated cards",
  [FEATURE.mnemonics]: "AI mnemonics",
  [FEATURE.quizSets]: "AI quiz sets",
};

/** "Pro gives you 300 AI cards a day" — the upgrade-prompt copy for a given feature. */
export function upgradeCopyForFeature(feature: FeatureKey): string {
  const proCap = TIER_LIMITS.pro[
    feature === FEATURE.cards
      ? "aiCardsPerDay"
      : feature === FEATURE.mnemonics
        ? "aiMnemonicsPerDay"
        : "aiQuizSetsPerDay"
  ];
  return `Pro gives you ${proCap} ${FEATURE_LABEL[feature].toLowerCase()} a day`;
}

/**
 * Start of the current UTC calendar week (Monday 00:00 UTC) — the boundary
 * for the weekly PDF/image import cap. ISO-style: Monday is day 1 of the
 * week regardless of the viewer's own locale/timezone.
 */
export function startOfUtcWeek(now: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const sinceMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d;
}
