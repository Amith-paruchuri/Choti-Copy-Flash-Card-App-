import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ShieldCheck } from "lucide-react";

import { CancelSubscriptionButton } from "@/components/cancel-subscription-button";
import { ProgressRing } from "@/components/motion/progress-ring";
import { PlanPicker } from "@/components/plan-picker";
import { Button } from "@/components/ui/button";
import {
  PRO_PRICE_RUPEES,
  TRIAL_DAYS,
} from "@/lib/billing/plan-copy";
import {
  canStartTrial,
  formatBillingDate,
  trialDaysRemaining,
} from "@/lib/billing/tier";
import { getBillingProfile } from "@/lib/queries/account";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Plans" };

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rise lift border-highlight/40 bg-card space-y-4 rounded-2xl border p-5 shadow-[0_10px_40px_-16px_var(--color-highlight)]"
      style={{ "--i": 1 } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export default async function BillingPage() {
  const supabase = await createClient();
  const [billing, { data: userData }] = await Promise.all([
    getBillingProfile(),
    supabase.auth.getUser(),
  ]);
  const canTrial = canStartTrial(billing);
  const email = userData.user?.email ?? undefined;

  const inGracePeriod =
    billing.rawTier === "canceled" &&
    !!billing.currentPeriodEnd &&
    new Date(billing.currentPeriodEnd).getTime() > new Date().getTime();
  const periodEnd = billing.currentPeriodEnd
    ? formatBillingDate(billing.currentPeriodEnd)
    : null;
  const trialEnd = billing.trialEndsAt
    ? formatBillingDate(billing.trialEndsAt)
    : null;
  const daysLeft = trialDaysRemaining(billing.trialEndsAt);

  const onPro = billing.rawTier === "pro";
  // A trial with an autopay mandate attached (new flow) vs. one without
  // (started before payment details were required).
  const trialWithAutopay =
    billing.tier === "trialing" &&
    billing.rawTier === "trialing" &&
    !!billing.subscriptionId;
  const trialAutopayOff =
    billing.tier === "trialing" && billing.rawTier === "canceled";
  const showPicker = !(onPro || inGracePeriod || trialWithAutopay || trialAutopayOff);

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
      <header
        className="rise space-y-1 text-center"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {showPicker ? "Pick your plan" : "Your plan"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {showPicker && canTrial
            ? `Start with ${TRIAL_DAYS} days of Pro. Cancel before day ${TRIAL_DAYS} and you pay nothing.`
            : showPicker
              ? "Free is always available. Pro is ₹150 a month."
              : "Manage billing and autopay here."}
        </p>
      </header>

      {billing.rawTier === "past_due" && (
        <p className="border-clay/30 bg-clay-tint text-clay rounded-xl border px-4 py-3 text-sm">
          Your last payment didn&rsquo;t go through. Razorpay is retrying it
          automatically. Contact support if this continues.
        </p>
      )}

      {showPicker && (
        <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <PlanPicker tier={billing.tier} email={email} canTrial={canTrial} />
        </div>
      )}

      {onPro && (
        <StatusCard>
          <div className="flex items-center gap-3">
            <span className="bg-highlight-tint text-ink grid size-11 place-items-center rounded-xl">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">
                You&rsquo;re on Pro
              </h2>
              <p className="text-muted-foreground text-sm">
                ₹{PRO_PRICE_RUPEES}/month by autopay
                {periodEnd ? ` · next charge ${periodEnd}` : ""}
              </p>
            </div>
          </div>
          <CancelSubscriptionButton currentPeriodEnd={billing.currentPeriodEnd} />
        </StatusCard>
      )}

      {inGracePeriod && (
        <StatusCard>
          <div className="flex items-center gap-3">
            <span className="bg-highlight-tint text-ink grid size-11 place-items-center rounded-xl">
              <CalendarClock className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">
                Autopay is off
              </h2>
              <p className="text-muted-foreground text-sm">
                Pro access continues until {periodEnd}. No further charges.
              </p>
            </div>
          </div>
        </StatusCard>
      )}

      {trialWithAutopay && (
        <StatusCard>
          <div className="flex items-center gap-4">
            <ProgressRing
              value={Math.max(0, TRIAL_DAYS - (daysLeft ?? 0))}
              max={TRIAL_DAYS}
              size={64}
              className="text-highlight flex-none"
            />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">
                Free trial · {daysLeft ?? 0} day{daysLeft === 1 ? "" : "s"} left
              </h2>
              <p className="text-muted-foreground text-sm">
                ₹{PRO_PRICE_RUPEES} will be charged on {trialEnd}, then every
                month, unless you turn autopay off.
              </p>
            </div>
          </div>
          <CancelSubscriptionButton
            trial
            currentPeriodEnd={billing.trialEndsAt}
          />
        </StatusCard>
      )}

      {trialAutopayOff && (
        <StatusCard>
          <div className="flex items-center gap-3">
            <span className="bg-highlight-tint text-ink grid size-11 place-items-center rounded-xl">
              <CalendarClock className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">
                Trial running, autopay is off
              </h2>
              <p className="text-muted-foreground text-sm">
                Pro features until {trialEnd}. You won&rsquo;t be charged.
              </p>
            </div>
          </div>
        </StatusCard>
      )}

      <p className="text-muted-foreground text-center text-xs">
        Billing is handled by Razorpay. See the{" "}
        <Link href="/legal/terms" className="underline">
          Terms
        </Link>{" "}
        for subscription and refund conditions.
      </p>

      <div className="text-center">
        <Button asChild size="sm" variant="ghost">
          <Link href="/account">← Back to profile</Link>
        </Button>
      </div>
    </main>
  );
}
