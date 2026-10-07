import "server-only";

/**
 * Basic in-process sliding-window rate limiter. Deliberately NOT durable: it
 * resets on cold start and isn't shared across regions/instances, so it's a
 * best-effort guard against a double-click or a tight retry loop creating
 * duplicate Razorpay subscriptions — not a defense against a determined
 * attacker. A real multi-instance deployment under sustained abuse would
 * want a shared store (Upstash/Redis, or a DB-backed counter like
 * `record_ai_call()`) instead.
 */
const hits = new Map<string, number[]>();

export function rateLimited(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const existing = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (existing.length >= limit) {
    hits.set(key, existing);
    return true;
  }
  existing.push(now);
  hits.set(key, existing);
  return false;
}
