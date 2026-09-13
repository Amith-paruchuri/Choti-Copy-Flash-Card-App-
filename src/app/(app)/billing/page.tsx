import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { CheckoutStubButton } from "@/components/checkout-stub-button";
import { Button } from "@/components/ui/button";
import { getBillingProfile } from "@/lib/queries/account";
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
  const billing = await getBillingProfile();
  const onFree = billing.tier === "free";

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
      <header className="space-y-1 text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Plans
        </h1>
        <p className="text-muted-foreground text-sm">
          Paid plans aren&rsquo;t live yet — you&rsquo;re on Free with no limits.
          Pricing, currency, and trial length are still being finalised.
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
            <span className="text-muted-foreground text-[11px]">
              coming soon
            </span>
          </div>
          <p className="font-display text-2xl font-semibold">
            <span className="text-muted-foreground text-base">₹—</span>
            <span className="text-muted-foreground ml-1 text-xs">/ month</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            {PRO.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="text-highlight mt-0.5 size-4 flex-none" />
                {f}
              </li>
            ))}
          </ul>
          <CheckoutStubButton />
        </div>
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Billing will be handled by Stripe or Razorpay. See the{" "}
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
