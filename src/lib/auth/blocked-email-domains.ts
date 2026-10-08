/**
 * App-level mirror of the seed list in
 * supabase/migrations/0023_block_disposable_email_domains.sql. Kept as a
 * plain, self-contained TypeScript list — not an RPC into that migration's
 * table — because this migration is written but deliberately not yet
 * applied; a check that depended on it would break signup entirely (not
 * just for blocked domains) until someone remembers to run it. If you add a
 * domain to the DB table later, add it here too (and vice versa) to keep
 * both checks in sync. Once the migration is live, consider switching this
 * to call is_blocked_email_domain() via .rpc() instead of maintaining two
 * lists.
 */
export const BLOCKED_EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "mailinator.com",
  "mailinator.net",
  "guerrillamail.com",
  "guerrillamail.org",
  "guerrillamail.net",
  "guerrillamail.biz",
  "guerrillamail.de",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "trashmail.com",
  "sharklasers.com",
  "maildrop.cc",
  "dispostable.com",
  "throwawaymail.com",
  "getnada.com",
  "fakeinbox.com",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "mailcatch.com",
  "spamgourmet.com",
  "discard.email",
] as const;

const BLOCKED_SET = new Set<string>(BLOCKED_EMAIL_DOMAINS);

/** The part after the LAST "@", lowercased — null if there isn't one (or nothing follows it). */
export function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/** True if the email's domain is a known disposable/placeholder one. */
export function isBlockedEmailDomain(email: string): boolean {
  const domain = extractEmailDomain(email);
  return domain !== null && BLOCKED_SET.has(domain);
}
