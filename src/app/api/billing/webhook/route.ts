import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env";

/**
 * Subscription webhook — Stripe or Razorpay. Structural stub: it verifies the
 * shape of the flow but does NOT process real events yet. When going live:
 *
 *  1. Verify the signature:
 *     - stripe: `stripe.webhooks.constructEvent(rawBody, sig, serverEnv.stripeWebhookSecret)`
 *     - razorpay: HMAC-SHA256(rawBody, serverEnv.razorpayWebhookSecret) === header
 *  2. Idempotency: insert into `subscription_events (provider, event_id, ...)`;
 *     if the unique constraint trips, this event was already handled — return 200.
 *  3. On `customer.subscription.{created,updated,deleted}` /
 *     `subscription.{activated,charged,cancelled}`: upsert `profiles` for the
 *     mapped user_id with subscription_tier / subscription_id / customer_id /
 *     current_period_end / trial_ends_at.
 *  4. All DB writes here use a SERVICE-ROLE Supabase client (bypasses RLS),
 *     since there is no user session on a webhook request.
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` (already reserved in env) to be set.
 */
export async function POST(request: NextRequest) {
  const provider = serverEnv.billingProvider;
  if (!provider) {
    return NextResponse.json(
      { error: "Billing is not enabled." },
      { status: 503 },
    );
  }

  const signature =
    request.headers.get("stripe-signature") ??
    request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature header." },
      { status: 400 },
    );
  }

  // Real handling is intentionally not implemented until keys + pricing land.
  return NextResponse.json(
    { received: true, handled: false, note: "Webhook stub — not processing events yet." },
    { status: 202 },
  );
}
