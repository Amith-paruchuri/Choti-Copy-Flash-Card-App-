/**
 * One-off: registers Choti Copy Pro as a ₹150/month Razorpay Plan.
 *
 * Usage:
 *   npx tsx scripts/create-razorpay-plan.ts
 *
 * Reads RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET from .env.local and prints the
 * new plan_id to add as RAZORPAY_PLAN_ID.
 *
 * SAFE TO RUN AGAINST TEST KEYS AS OFTEN AS YOU LIKE — creating a Plan
 * doesn't charge anyone, it just registers a price/interval combination.
 * Re-run this exact script with LIVE keys once, when you're ready to go
 * live, to get the live-mode plan_id. A test-mode plan_id only works
 * against test-mode keys and vice versa — the two are never interchangeable.
 */
import fs from "node:fs";
import path from "node:path";

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

const AMOUNT_PAISE = 150 * 100; // ₹150/month

interface PlanResponse {
  id: string;
  error?: { description?: string };
}

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error(
      "Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env.local.",
    );
    process.exit(1);
  }

  const isTest = keyId.startsWith("rzp_test_");
  console.log(
    isTest
      ? "Detected a TEST-mode key (rzp_test_...) — this plan will only exist in Razorpay's test mode.\n"
      : "⚠️  Detected a LIVE-mode key — this will create a REAL plan customers could be billed against.\n",
  );

  const auth =
    "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: {
        name: "Choti Copy Pro",
        description: "Choti Copy Pro — monthly subscription",
        amount: AMOUNT_PAISE,
        currency: "INR",
      },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as PlanResponse;
  if (!res.ok) {
    console.error(
      "Razorpay API error:",
      json.error?.description ?? res.statusText,
    );
    process.exit(1);
  }

  console.log(
    `Created plan: ${json.id} (₹150/month, ${isTest ? "test" : "LIVE"} mode)\n`,
  );
  console.log(
    `Add this to .env.local${isTest ? "" : " (and your Vercel production env)"}:\n`,
  );
  console.log(`  RAZORPAY_PLAN_ID=${json.id}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
