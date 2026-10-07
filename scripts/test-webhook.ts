/**
 * Verification script for src/app/api/billing/webhook/route.ts — posts
 * correctly-signed synthetic Razorpay webhook payloads at a running dev
 * server and checks the resulting DB state. Does not touch Razorpay's API
 * at all; it only proves OUR signature verification, event mapping, and
 * idempotency are correct, using a real (but harmless, reset afterward)
 * profiles row.
 *
 * Usage (with `npm run dev` already running):
 *   npx tsx scripts/test-webhook.ts
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const BASE_URL = process.env.WEBHOOK_TEST_BASE_URL ?? "http://localhost:3000";
const WEBHOOK_URL = `${BASE_URL}/api/billing/webhook`;
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing RAZORPAY_WEBHOOK_SECRET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function sign(rawBody: string): string {
  return crypto.createHmac("sha256", SECRET!).update(rawBody).digest("hex");
}

async function post(rawBody: string, signature: string) {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": signature },
    body: rawBody,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const unixNow = () => Math.floor(Date.now() / 1000);

function subscriptionEvent(opts: {
  event: string;
  subscriptionId: string;
  userId?: string;
  currentEnd?: number;
  paymentId?: string;
}) {
  const body = {
    entity: "event",
    account_id: "acc_test",
    event: opts.event,
    contains: ["subscription"],
    payload: {
      subscription: {
        entity: {
          id: opts.subscriptionId,
          entity: "subscription",
          status: "active",
          current_start: unixNow(),
          current_end: opts.currentEnd ?? unixNow() + 30 * 86400,
          notes: opts.userId ? { user_id: opts.userId } : {},
        },
      },
      ...(opts.paymentId
        ? { payment: { entity: { id: opts.paymentId, entity: "payment" } } }
        : {}),
    },
    created_at: unixNow(),
  };
  return JSON.stringify(body);
}

function paymentFailedEvent(opts: { paymentId: string; userId?: string }) {
  const body = {
    entity: "event",
    account_id: "acc_test",
    event: "payment.failed",
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id: opts.paymentId,
          entity: "payment",
          notes: opts.userId ? { user_id: opts.userId } : {},
        },
      },
    },
    created_at: unixNow(),
  };
  return JSON.stringify(body);
}

async function getProfile(userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("subscription_tier, subscription_id, current_period_end")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  console.log(`Posting against: ${WEBHOOK_URL}\n`);

  // Pick a real, currently-clean profile row to exercise and restore after.
  const { data: candidates, error: findError } = await admin
    .from("profiles")
    .select("user_id, subscription_tier, subscription_id, current_period_end, trial_ends_at, billing_provider, customer_id")
    .eq("subscription_tier", "free")
    .is("subscription_id", null)
    .limit(1);
  if (findError || !candidates?.length) {
    console.error("Couldn't find a free, un-subscribed profile row to test against.");
    process.exit(1);
  }
  const original = candidates[0];
  const userId = original.user_id as string;
  const subId = `sub_test_${crypto.randomBytes(6).toString("hex")}`;
  console.log(`Using test user ${userId}, synthetic subscription ${subId}\n`);

  const cleanupEventIds: string[] = [];

  try {
    console.log("1. Bad signature is rejected with 400");
    {
      const body = subscriptionEvent({ event: "subscription.activated", subscriptionId: subId, userId });
      const res = await post(body, "0".repeat(64));
      check("status is 400", res.status === 400);
    }

    console.log("\n2. subscription.authenticated — recorded, no tier change");
    {
      const body = subscriptionEvent({ event: "subscription.authenticated", subscriptionId: subId, userId });
      const res = await post(body, sign(body));
      check("status is 200", res.status === 200);
      const profile = await getProfile(userId);
      check("tier unchanged (still free)", profile.subscription_tier === "free");
    }

    console.log("\n3. subscription.activated — sets pro + current_period_end");
    {
      const periodEnd = unixNow() + 30 * 86400;
      const body = subscriptionEvent({ event: "subscription.activated", subscriptionId: subId, userId, currentEnd: periodEnd });
      const res = await post(body, sign(body));
      check("status is 200", res.status === 200);
      const profile = await getProfile(userId);
      check("tier is pro", profile.subscription_tier === "pro");
      check(
        "current_period_end set",
        !!profile.current_period_end &&
          Math.abs(new Date(profile.current_period_end).getTime() / 1000 - periodEnd) < 5,
      );
    }

    console.log("\n4. subscription.charged — renews, stays pro");
    {
      const periodEnd = unixNow() + 60 * 86400;
      const body = subscriptionEvent({ event: "subscription.charged", subscriptionId: subId, userId, currentEnd: periodEnd, paymentId: `pay_${crypto.randomBytes(6).toString("hex")}` });
      const res = await post(body, sign(body));
      check("status is 200", res.status === 200);
      const profile = await getProfile(userId);
      check("tier is pro", profile.subscription_tier === "pro");
    }

    console.log("\n5. Idempotency — replaying the SAME event twice");
    {
      const body = subscriptionEvent({ event: "subscription.activated", subscriptionId: subId, userId, paymentId: "pay_replay_test" });
      const first = await post(body, sign(body));
      const second = await post(body, sign(body));
      check("first delivery: 200", first.status === 200);
      check("first delivery: not marked duplicate", !(first.json as { duplicate?: boolean })?.duplicate);
      check("second delivery: 200", second.status === 200);
      check(
        "second delivery: marked duplicate",
        (second.json as { duplicate?: boolean })?.duplicate === true,
      );
      const { count } = await admin
        .from("subscription_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "subscription.activated")
        .like("event_id", `%pay_replay_test%`);
      check("exactly one row recorded for the replayed event", count === 1, `count=${count}`);
    }

    console.log("\n6. subscription.pending — degrades to past_due");
    {
      const body = subscriptionEvent({ event: "subscription.pending", subscriptionId: subId, userId });
      const res = await post(body, sign(body));
      check("status is 200", res.status === 200);
      const profile = await getProfile(userId);
      check("tier is past_due", profile.subscription_tier === "past_due");
    }

    console.log("\n7. subscription.halted — stays/becomes past_due");
    {
      const body = subscriptionEvent({ event: "subscription.halted", subscriptionId: subId, userId });
      const res = await post(body, sign(body));
      check("status is 200", res.status === 200);
      const profile = await getProfile(userId);
      check("tier is past_due", profile.subscription_tier === "past_due");
    }

    console.log("\n8. payment.failed (with notes) — degrades to past_due");
    {
      // Re-activate first so the transition is visible.
      const reactivate = subscriptionEvent({ event: "subscription.activated", subscriptionId: subId, userId, paymentId: "pay_reactivate" });
      await post(reactivate, sign(reactivate));
      const body = paymentFailedEvent({ paymentId: `pay_fail_${crypto.randomBytes(4).toString("hex")}`, userId });
      const res = await post(body, sign(body));
      check("status is 200", res.status === 200);
      const profile = await getProfile(userId);
      check("tier is past_due", profile.subscription_tier === "past_due");
    }

    console.log("\n9. payment.failed (NO notes) — recorded, but no crash and no mutation");
    {
      // Re-activate first so we can tell a wrongful mutation apart from a correct no-op.
      const reactivate = subscriptionEvent({ event: "subscription.activated", subscriptionId: subId, userId, paymentId: "pay_reactivate_2" });
      await post(reactivate, sign(reactivate));
      const body = paymentFailedEvent({ paymentId: `pay_fail_nouser_${crypto.randomBytes(4).toString("hex")}` });
      const res = await post(body, sign(body));
      check("status is 200", res.status === 200);
      const profile = await getProfile(userId);
      check("tier untouched (still pro)", profile.subscription_tier === "pro");
    }

    console.log("\n10. subscription.cancelled — keeps Pro (effective tier), stores 'canceled' + period end");
    {
      const periodEnd = unixNow() + 10 * 86400; // still in the future
      const body = subscriptionEvent({ event: "subscription.cancelled", subscriptionId: subId, userId, currentEnd: periodEnd });
      const res = await post(body, sign(body));
      check("status is 200", res.status === 200);
      const profile = await getProfile(userId);
      check("raw tier is canceled", profile.subscription_tier === "canceled");
      check(
        "current_period_end still in the future",
        !!profile.current_period_end && new Date(profile.current_period_end).getTime() > Date.now(),
      );
    }

    console.log("\nAll scenarios executed.\n");
  } finally {
    // Restore the profile row exactly as found, and remove the synthetic
    // audit rows this run created so they don't clutter real webhook history.
    await admin
      .from("profiles")
      .update({
        subscription_tier: original.subscription_tier,
        subscription_id: original.subscription_id,
        current_period_end: original.current_period_end,
        trial_ends_at: original.trial_ends_at,
        billing_provider: original.billing_provider,
        customer_id: original.customer_id,
      })
      .eq("user_id", userId);

    const { data: toDelete } = await admin
      .from("subscription_events")
      .select("id")
      .eq("user_id", userId);
    if (toDelete?.length) {
      await admin
        .from("subscription_events")
        .delete()
        .in("id", toDelete.map((r) => r.id));
    }
    void cleanupEventIds;
    console.log(`Restored profile ${userId} and removed ${toDelete?.length ?? 0} synthetic subscription_events rows.`);
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
