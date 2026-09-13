/** The one place the support / feedback address lives. */
export const SUPPORT_EMAIL = "choticopy33@gmail.com";

/** A `mailto:` link, optionally with a pre-filled subject line. */
export function supportMailto(subject?: string): string {
  const base = `mailto:${SUPPORT_EMAIL}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}
