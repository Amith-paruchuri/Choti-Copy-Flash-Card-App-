/**
 * Centralised environment access.
 *
 * Values are read lazily so a missing key only fails the code path that
 * actually needs it (e.g. `npm run build` still succeeds without Supabase
 * creds). Import the helpers, don't read `process.env` directly elsewhere.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Copy .env.local.example to .env.local and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/** Public Supabase config — safe to expose to the browser. */
export const supabasePublic = {
  get url() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get anonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
};

/** Server-only config. Never import the values of these into a client component. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return optional("SUPABASE_SERVICE_ROLE_KEY");
  },
  get aiProvider() {
    return optional("AI_PROVIDER", "gemini");
  },

  // xAI / Grok
  get xaiApiKey() {
    return required("XAI_API_KEY");
  },
  get xaiModel() {
    return optional("XAI_MODEL", "grok-4");
  },
  get xaiBaseUrl() {
    return optional("XAI_BASE_URL", "https://api.x.ai/v1");
  },

  // Google Gemini
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  get geminiModel() {
    return optional("GEMINI_MODEL", "gemini-3.1-flash-lite");
  },
  get geminiBaseUrl() {
    return optional(
      "GEMINI_BASE_URL",
      "https://generativelanguage.googleapis.com/v1beta",
    );
  },

  // ── Billing (not live) ────────────────────────────────────────────────
  // Payments stay disabled until `billingProvider` is set AND real keys are
  // filled in. The webhook + checkout routes 503 until then.
  get billingProvider(): "stripe" | "razorpay" | null {
    const v = optional("BILLING_PROVIDER").toLowerCase();
    return v === "stripe" || v === "razorpay" ? v : null;
  },
  get stripeSecretKey() {
    return optional("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return optional("STRIPE_WEBHOOK_SECRET");
  },
  get stripePricePro() {
    return optional("STRIPE_PRICE_PRO");
  },
  get razorpayKeyId() {
    return optional("RAZORPAY_KEY_ID");
  },
  get razorpayKeySecret() {
    return optional("RAZORPAY_KEY_SECRET");
  },
  get razorpayWebhookSecret() {
    return optional("RAZORPAY_WEBHOOK_SECRET");
  },
  /** The ₹150/month Plan id — created once via `scripts/create-razorpay-plan.ts`. */
  get razorpayPlanId() {
    return optional("RAZORPAY_PLAN_ID");
  },
};

/**
 * Current Terms/Privacy version — bump when the policy text materially changes.
 * Read literally (not via the dynamic helper) so Next inlines it for the client.
 */
export const TERMS_VERSION =
  process.env.NEXT_PUBLIC_TERMS_VERSION || "2026-09-08";

export const siteUrl = (): string =>
  optional("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
