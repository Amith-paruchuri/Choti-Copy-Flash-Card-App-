import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { CancelSubscriptionButton } from "@/components/cancel-subscription-button";
import { CheckoutButton } from "@/components/checkout-button";
import { StartTrialButton } from "@/components/start-trial-button";
import { Button } from "@/components/ui/button";
import { canStartTrial } from "@/lib/billing/tier";
import { getBillingProfile } from "@/lib/queries/account";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans" };

const FREE = [
  "Unlimited flashcards & subjects",
  "Spaced repetition (FSRS) reviews",
  "AI flashcard & quiz generation",
  "Imports, search, stats",
];

const PRO = [
  "Everything in Free",
  "Higher AI generation limits",
  "Priority processing for large imports",
  "Early access to new features",
];

export default async function BillingPage() {
  const supabase = await createClient();
  const [billing, { data: userData }] = await Promise.all([
    getBillingProfile(),
    supabase.auth.getUser(),
  ]);
  const onFree = billing.tier === "free";
  const canTrial = canStartTrial(billing);

  const inGracePeriod =
    billing.rawTier === "canceled" &&
    !!billing.currentPeriodEnd &&
    new Date(billing.currentPeriodEnd).getTime() > new Date().getTime();
  const periodEndCopy = billing.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
      <header className="space-y-1 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Plans
        </h1>
        <p className="text-muted-foreground text-sm">
          Everyone gets one 15-day Pro trial, no card needed, whenever
          they want to start it.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div
          className={cn(
            "border-rule space-y-3 rounded-xl border p-4",
            onFree && "ring-primary/30 ring-2",
          )}
        >
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Free</h2>
            {onFree && (
              <span className="bg-ink-tint text-ink rounded-full px-2 py-0.5 text-[11px] font-semibold">
                Current
              </span>
            )}
          </div>
          <p className="font-display text-2xl font-semibold">₹0</p>
          <ul className="space-y-1.5 text-sm">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="text-sage mt-0.5 size-4 flex-none" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-rule bg-card space-y-3 rounded-xl border p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Pro</h2>
            {(billing.rawTier === "pro" || inGracePeriod) && (
              <span className="bg-highlight-tint text-ink rounded-full px-2 py-0.5 text-[11px] font-semibold">
                Current
              </span>
            )}
          </div>
          <p className="font-display text-2xl font-semibold">
            ₹150<span className="text-muted-foreground ml-1 text-xs">/ month</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            {PRO.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="text-highlight mt-0.5 size-4 flex-none" />
                {f}
              </li>
            ))}
          </ul>

          {billing.rawTier === "pro" ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                {periodEndCopy ? `Renews ${periodEndCopy}` : "Active"}
              </p>
              <CancelSubscriptionButton
                currentPeriodEnd={billing.currentPeriodEnd}
              />
            </div>
          ) : inGracePeriod ? (
            <p className="text-muted-foreground text-xs">
              Canceled — Pro access continues until {periodEndCopy}.
            </p>
          ) : (
            <div className="space-y-2">
              {billing.rawTier === "past_due" && (
                <p className="text-clay text-xs">
                  Your last payment didn&rsquo;t go through — Razorpay is
                  retrying it automatically.
                </p>
              )}
              {canTrial && <StartTrialButton className="w-full" />}
              <CheckoutButton
                email={userData.user?.email ?? undefined}
                tier={billing.tier}
              />
            </div>
          )}
        </div>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Billing is handled by Razorpay. See the{" "}
        <Link href="/legal/terms" className="underline">
          Terms
        </Link>{" "}
        for subscription conditions.
      </p>

      <div className="text-center">
        <Button asChild size="sm" variant="ghost">
          <Link href="/account">← Back to profile</Link>
        </Button>
      </div>
    </main>
  );
}
