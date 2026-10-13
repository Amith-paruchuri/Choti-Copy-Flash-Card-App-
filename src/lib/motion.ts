/**
 * Shared motion tokens so every animation in the app feels like one system.
 * Use these instead of ad-hoc numbers. All motion also honours the user's
 * reduced-motion setting (see `useReducedMotion` in each component).
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN = [0.5, 0, 0.75, 0] as const;

export const SPRING_SNAPPY = {
  type: "spring",
  stiffness: 520,
  damping: 30,
  mass: 0.7,
} as const;

export const SPRING_SOFT = {
  type: "spring",
  stiffness: 220,
  damping: 26,
} as const;

export const DURATION = { fast: 0.16, base: 0.28, slow: 0.5 } as const;
