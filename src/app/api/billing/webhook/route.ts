import { NextResponse, type NextRequest } from "next/server";

import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Loosely-typed on purpose — this is attacker-reachable (modulo signature
 * verification) external input, not a trusted shape. Every field is read
 * with optional chaining; nothing here is assumed present.
 */
interface RazorpaySubscriptionEntity {
  id?: string;
  status?: string;
  current_end?: number; // unix seconds
  notes?: Record<string, unknown>;
}
interface RazorpayPaymentEntity {
  id?: string;
  notes?: Record<string, unknown>;
}
interface RazorpayWebhookBody {
  event?: string;
  created_at?: number;
  payload?: {
    subscription?: { entity?: RazorpaySubscriptionEntity };
    payment?: { entity?: RazorpayPaymentEntity };
  };
}

const PRO_EVENTS = new Set(["subscription.activated", "subscription.charged"]);
const PAST_DUE_EVENTS = new Set(["subscription.pending", "subscription.halted"]);
const CANCEL_EVENTS = new Set(["subscription.cancelled", "subscription.completed"]);
// subscription.authenticated is intentionally unmapped — it can fire for an
// initial mandate authorization before the first real charge is confirmed,
// so treating it as "pro" would risk granting access before a payment
// actually succeeded. It's still recorded below for audit/idempotency.

const toIso = (unixSeconds: number | undefined): string | null =>
  typeof unixSeconds === "number" ? new Date(unixSeconds * 1000).toISOString() : null;

/** Resolves the target user: notes.user_id first, else by stored subscription_id. */
async function resolveUserId(
  admin: AdminClient,
  notesUserId: unknown,
  subscriptionId: string | undefined,
): Promise<string | null> {
  if (typeof notesUserId === "string" && notesUserId) return notesUserId;
  if (!subscriptionId) return null;
  const { data } = await admin
    .from("profiles")
    .select("user_id")
    .eq("subscription_id", subscriptionId)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function applyTierTransition(
  admin: AdminClient,
  event: string,
  sub: RazorpaySubscriptionEntity | undefined,
  payment: RazorpayPaymentEntity | undefined,
): Promise<void> {
  if (event === "payment.failed") {
    // Generic, non-subscription-scoped event — only act on it when the
    // payment entity happens to carry our own notes (not guaranteed).
    const userId = await resolveUserId(admin, payment?.notes?.user_id, undefined);
    if (!userId) return;
    await admin
      .from("profiles")
      .update({ subscription_tier: "past_due" })
      .eq("user_id", userId);
    return;
  }

  if (!sub?.id) return; // nothing to act on without a subscription entity
  const userId = await resolveUserId(admin, sub.notes?.user_id, sub.id);
  if (!userId) return;

  if (PRO_EVENTS.has(event)) {
    await admin
      .from("profiles")
      .update({
        subscription_tier: "pro",
        subscription_id: sub.id,
        current_period_end: toIso(sub.current_end),
      })
      .eq("user_id", userId);
  } else if (PAST_DUE_EVENTS.has(event)) {
    await admin
      .from("profiles")
      .update({ subscription_tier: "past_due" })
      .eq("user_id", userId);
  } else if (CANCEL_EVENTS.has(event)) {
    // Keeps current_period_end as-is (or updates it if Razorpay sent a
    // newer one) — effectiveTier() grants 'pro' through that date even
    // though the stored tier flips to 'canceled' right away.
    await admin
      .from("profiles")
      .update({
        subscription_tier: "canceled",
        ...(sub.current_end ? { current_period_end: toIso(sub.current_end) } : {}),
      })
      .eq("user_id", userId);
  }
  // subscription.authenticated and anything else: recorded, no tier change.
}

export async function POST(request: NextRequest) {
  if (serverEnv.billingProvider !== "razorpay") {
    return NextResponse.json({ error: "Billing is not enabled." }, { status: 503 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature header." }, { status: 400 });
  }

  const rawBody = await request.text();
  const secret = serverEnv.razorpayWebhookSecret;
  if (!secret || !verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody;
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const event = body.event;
  if (typeof event !== "string" || !event) {
    return NextResponse.json({ error: "Missing event type." }, { status: 400 });
  }

  const sub = body.payload?.subscription?.entity;
  const payment = body.payload?.payment?.entity;

  // Razorpay doesn't hand us one root-level unique delivery id, so derive a
  // stable one ourselves: a payment id is unique per charge attempt and
  // disambiguates repeated events on the same subscription (e.g. multiple
  // `charged` events across billing cycles); without one, fall back to
  // subscription id + event + timestamp.
  const eventId = payment?.id
    ? `${event}:${payment.id}`
    : `${event}:${sub?.id ?? "unknown"}:${body.created_at ?? ""}`;

  const admin = createAdminClient();
  const notesUserId = sub?.notes?.user_id ?? payment?.notes?.user_id;

  const { error: insertError } = await admin.from("subscription_events").insert({
    provider: "razorpay",
    event_id: eventId,
    event_type: event,
    user_id: typeof notesUserId === "string" ? notesUserId : null,
    payload: body,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // Already processed this exact event — idempotent no-op, still 200
      // so Razorpay stops retrying a webhook we've already handled.
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: "Could not record event." }, { status: 500 });
  }

  await applyTierTransition(admin, event, sub, payment);

  return NextResponse.json({ received: true });
}
