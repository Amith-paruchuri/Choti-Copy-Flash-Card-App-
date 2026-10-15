"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CreditCard, Gift, Sparkles } from "lucide-react";

import { CheckoutButton } from "@/components/checkout-button";
import { Button } from "@/components/ui/button";
import { TIER_LIMITS } from "@/lib/billing/limits";
import {
  PRO_PRICE_RUPEES,
  TRIAL_DAYS,
  UNLIMITED_FOR_EVERYONE,
  tierLines,
} from "@/lib/billing/plan-copy";
import { EASE_OUT, SPRING_SNAPPY } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/types/database";

type PlanId = "free" | "trial" | "pro";

const FREE_FEATURES = [...UNLIMITED_FOR_EVERYONE, ...tierLines(TIER_LIMITS.free)];
const PRO_FEATURES = [...UNLIMITED_FOR_EVERYONE, ...tierLines(TIER_LIMITS.pro)];

/** Lines that are new on Pro (everything but the shared unlimited block). */
const PRO_ONLY = new Set(tierLines(TIER_LIMITS.pro));

function Features({ items, accent }: { items: string[]; accent: string }) {
  const reduce = useReducedMotion();
  return (
    <ul className="space-y-2 text-sm">
      {items.map((f, i) => (
        <motion.li
          key={f}
          className="flex gap-2.5"
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT, delay: i * 0.03 }}
        >
          <Check className={cn("mt-0.5 size-4 flex-none", accent)} aria-hidden />
          <span>{f}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function TrialTimeline() {
  const reduce = useReducedMotion();
  const steps = [
    { when: "Today", what: "₹0", note: "Approve autopay. Full Pro starts." },
    { when: `Day ${TRIAL_DAYS}`, what: `₹${PRO_PRICE_RUPEES}`, note: "First charge, then monthly." },
    { when: "Any time", what: "Cancel", note: "Cancel before day 15 and pay nothing." },
  ];
  return (
    <ol className="relative space-y-4 pl-8">
      <motion.span
        aria-hidden
        className="bg-highlight/40 absolute top-1.5 bottom-1.5 left-[9px] w-0.5 origin-top rounded-full"
        initial={reduce ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      />
      {steps.map((s, i) => (
        <motion.li
          key={s.when}
          className="relative"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.15 + i * 0.12 }}
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-1 -left-8 grid size-5 place-items-center rounded-full border-2 bg-background",
              i === 0 ? "border-sage" : i === 1 ? "border-highlight" : "border-rule",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                i === 0 ? "bg-sage" : i === 1 ? "bg-highlight" : "bg-muted-foreground",
              )}
            />
          </span>
          <p className="text-sm">
            <span className="font-semibold">{s.when}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-semibold tabular-nums">{s.what}</span>
          </p>
          <p className="text-muted-foreground text-xs">{s.note}</p>
        </motion.li>
      ))}
    </ol>
  );
}

const OPTIONS: {
  id: PlanId;
  title: string;
  price: string;
  sub: string;
  icon: typeof Gift;
}[] = [
  { id: "free", title: "Free", price: "₹0", sub: "Forever", icon: Gift },
  {
    id: "trial",
    title: "Free trial",
    price: "15 days",
    sub: `then ₹${PRO_PRICE_RUPEES}/mo`,
    icon: Sparkles,
  },
  {
    id: "pro",
    title: "Pro",
    price: `₹${PRO_PRICE_RUPEES}`,
    sub: "per month",
    icon: CreditCard,
  },
];

/**
 * The three-way plan choice, shared by the Plans page and onboarding.
 * - Free: nothing to pay.
 * - Free trial: approve an autopay mandate with Razorpay, 15 days of Pro,
 *   then ₹150 is charged and renews monthly until cancelled.
 * - Pro: ₹150 now, renews monthly until cancelled.
 */
export function PlanPicker({
  tier,
  email,
  canTrial,
  onChooseFree,
}: {
  /** Effective tier, so the checkout button knows when activation landed. */
  tier: SubscriptionTier;
  email?: string;
  canTrial: boolean;
  /** Onboarding passes this to close the flow; otherwise Free links home. */
  onChooseFree?: () => void;
}) {
  const reduce = useReducedMotion();
  const options = OPTIONS.filter((o) => o.id !== "trial" || canTrial);
  const [selected, setSelected] = useState<PlanId>(canTrial ? "trial" : "pro");

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Choose a plan"
        className={cn("grid gap-2", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}
      >
        {options.map((o) => {
          const active = selected === o.id;
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(o.id)}
              className={cn(
                "relative flex touch-manipulation flex-col items-start gap-1 rounded-2xl border px-3 py-3 text-left transition-colors [-webkit-tap-highlight-color:transparent]",
                active ? "border-transparent" : "border-rule hover:border-foreground/25",
              )}
            >
              {active && (
                <motion.span
                  layoutId="plan-ring"
                  aria-hidden
                  className="border-highlight bg-highlight-tint/50 absolute inset-0 rounded-2xl border-2 shadow-[0_10px_30px_-14px_var(--color-highlight)]"
                  transition={reduce ? { duration: 0 } : SPRING_SNAPPY}
                />
              )}
              {o.id === "trial" && (
                <span className="bg-highlight text-background absolute -top-2.5 left-3 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  Best start
                </span>
              )}
              <Icon className="text-highlight relative size-4" aria-hidden />
              <span className="relative text-sm font-semibold">{o.title}</span>
              <span className="font-display relative text-lg leading-none font-semibold tabular-nums">
                {o.price}
              </span>
              <span className="text-muted-foreground relative text-[11px]">
                {o.sub}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selected}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="border-rule bg-card space-y-5 rounded-2xl border p-5"
        >
          {selected === "trial" && (
            <>
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Try everything in Pro for {TRIAL_DAYS} days
                </h2>
                <p className="text-muted-foreground text-sm">
                  Add a card or UPI autopay now. Nothing is charged today.
                </p>
              </div>
              <TrialTimeline />
              <Features items={PRO_FEATURES.filter((f) => PRO_ONLY.has(f))} accent="text-highlight" />
              <div className="space-y-2">
                <CheckoutButton
                  mode="trial"
                  tier={tier}
                  email={email}
                  label={`Start ${TRIAL_DAYS}-day free trial`}
                />
                <p className="text-muted-foreground text-center text-xs leading-relaxed">
                  After day {TRIAL_DAYS}, ₹{PRO_PRICE_RUPEES} is charged
                  automatically every month through Razorpay until you cancel.
                  You can turn autopay off any time on this page.
                </p>
              </div>
            </>
          )}

          {selected === "pro" && (
            <>
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Pro · ₹{PRO_PRICE_RUPEES}/month
                </h2>
                <p className="text-muted-foreground text-sm">
                  Higher daily limits and bigger imports.
                </p>
              </div>
              <Features items={PRO_FEATURES} accent="text-highlight" />
              <div className="space-y-2">
                <CheckoutButton
                  mode="pro"
                  tier={tier}
                  email={email}
                  label={`Subscribe · ₹${PRO_PRICE_RUPEES}/month`}
                />
                <p className="text-muted-foreground text-center text-xs leading-relaxed">
                  Charged today, then every month by autopay until you cancel.
                  Full refund if you write to us within 7 days of a payment.
                </p>
              </div>
            </>
          )}

          {selected === "free" && (
            <>
              <div>
                <h2 className="font-display text-lg font-semibold">Free</h2>
                <p className="text-muted-foreground text-sm">
                  Everything core, with daily AI limits. Upgrade whenever.
                </p>
              </div>
              <Features items={FREE_FEATURES} accent="text-sage" />
              {onChooseFree ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={onChooseFree}
                >
                  Continue with Free
                </Button>
              ) : (
                <Button asChild size="lg" variant="outline" className="w-full">
                  <Link href="/dashboard">Keep using Free</Link>
                </Button>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
