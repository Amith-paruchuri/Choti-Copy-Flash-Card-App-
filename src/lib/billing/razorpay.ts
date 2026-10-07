import "server-only";

import crypto from "node:crypto";

const API_BASE = "https://api.razorpay.com/v1";

export interface RazorpayPlan {
  id: string;
  entity: "plan";
  period: string;
  interval: number;
}

export interface RazorpaySubscription {
  id: string;
  entity: "subscription";
  plan_id: string;
  customer_id: string | null;
  status: string;
  current_start: number | null;
  current_end: number | null;
  short_url: string;
  notes: Record<string, string>;
}

function authHeader(keyId: string, keySecret: string): string {
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

async function request<T>(
  keyId: string,
  keySecret: string,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: authHeader(keyId, keySecret),
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => null)) as
    | (T & { error?: { description?: string } })
    | null;
  if (!res.ok) {
    const desc = json?.error?.description ?? `Razorpay API error (${res.status})`;
    throw new Error(desc);
  }
  return json as T;
}

/** One-time setup call — registers a recurring billing plan. Not a charge. */
export async function createPlan(
  keyId: string,
  keySecret: string,
  opts: {
    period: "monthly" | "yearly" | "weekly" | "daily";
    interval: number;
    amountPaise: number;
    name: string;
    description?: string;
  },
): Promise<RazorpayPlan> {
  return request<RazorpayPlan>(keyId, keySecret, "POST", "/plans", {
    period: opts.period,
    interval: opts.interval,
    item: {
      name: opts.name,
      description: opts.description,
      amount: opts.amountPaise,
      currency: "INR",
    },
  });
}

/**
 * Creates a subscription for a customer to pay against. Not a charge either —
 * the customer still has to complete the hosted/Checkout.js authorization
 * before any money moves.
 */
export async function createSubscription(
  keyId: string,
  keySecret: string,
  opts: {
    planId: string;
    totalCount: number;
    notes?: Record<string, string>;
  },
): Promise<RazorpaySubscription> {
  return request<RazorpaySubscription>(
    keyId,
    keySecret,
    "POST",
    "/subscriptions",
    {
      plan_id: opts.planId,
      total_count: opts.totalCount,
      customer_notify: 1,
      notes: opts.notes,
    },
  );
}

/** `cancelAtCycleEnd: true` lets the current paid period run out before access ends. */
export async function cancelSubscription(
  keyId: string,
  keySecret: string,
  subscriptionId: string,
  cancelAtCycleEnd: boolean,
): Promise<RazorpaySubscription> {
  return request<RazorpaySubscription>(
    keyId,
    keySecret,
    "POST",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 },
  );
}

function hmacHex(message: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

/** Constant-time compare — never use `===` on a signature. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Webhook signature: HMAC-SHA256 of the RAW request body, hashed with the webhook secret. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  return safeEqual(hmacHex(rawBody, secret), signature);
}

/**
 * Checkout.js success-callback signature: HMAC-SHA256 of
 * `razorpay_payment_id|razorpay_subscription_id`, hashed with the account's
 * key secret (NOT the webhook secret — a different secret, same algorithm).
 * This only proves the callback really came from Razorpay; it is NOT used to
 * grant Pro access by itself — the webhook is the source of truth for that.
 */
export function verifyCheckoutSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  keySecret: string,
): boolean {
  return safeEqual(hmacHex(`${paymentId}|${subscriptionId}`, keySecret), signature);
}
