"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { startCheckout, verifyCheckoutCallback } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import type { SubscriptionTier } from "@/types/database";

interface RazorpayCheckoutHandlerResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: { email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayCheckoutHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, handler: () => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 10; // ~20s — the webhook usually lands within a couple of seconds

/** Loads Razorpay's Checkout.js once, only when this component (the billing page) mounts. */
function loadRazorpayScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Couldn't load Razorpay checkout.")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Razorpay checkout."));
    document.body.appendChild(script);
  });
}

/**
 * The real "Upgrade to Pro" button — only rendered on the billing page, so
 * Checkout.js is never fetched anywhere else. Pro access is never granted
 * from the client: on success this shows "activating…" and polls (via
 * `router.refresh()`, which re-runs the server-rendered `tier` prop) until
 * the webhook has actually flipped the account to Pro, or times out with a
 * clear "still processing" message rather than hanging forever.
 */
export function CheckoutButton({
  email,
  tier,
}: {
  email?: string;
  tier: SubscriptionTier;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "activating" | "timed-out" | "cancelled"
  >("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => stopPolling, []);

  // Clears the poll + confirms once the server-rendered `tier` prop flips to
  // "pro" (after a `router.refresh()` picks up the webhook's write). Reading
  // `status` here without listing it as a dependency is deliberate: this
  // should only react to `tier` changing, not re-fire if `status` alone
  // changes while tier is already "pro".
  useEffect(() => {
    if (tier === "pro" && status === "activating") {
      stopPolling();
      toast.success("You're on Pro!");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  // Derived, not stored: once `tier` actually flips to "pro" the stale
  // "activating"/"timed-out" state should stop rendering immediately,
  // without a redundant setState inside the effect above.
  const isActivating = status === "activating" && tier !== "pro";
  const isTimedOut = status === "timed-out" && tier !== "pro";

  function startPolling() {
    pollCount.current = 0;
    stopPolling();
    pollRef.current = setInterval(() => {
      pollCount.current += 1;
      router.refresh();
      if (pollCount.current >= MAX_POLLS) {
        stopPolling();
        setStatus((s) => (s === "activating" ? "timed-out" : s));
      }
    }, POLL_INTERVAL_MS);
  }

  function run() {
    start(async () => {
      setStatus("idle");
      const res = await startCheckout();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      try {
        await loadRazorpayScript();
      } catch {
        toast.error("Couldn't load Razorpay checkout — check your connection.");
        return;
      }
      if (!window.Razorpay) return;

      const rzp = new window.Razorpay({
        key: res.data.keyId,
        subscription_id: res.data.subscriptionId,
        name: "Choti Copy Pro",
        description: "₹150/month",
        prefill: email ? { email } : undefined,
        theme: { color: "#6a58e8" },
        handler: (response) => {
          start(async () => {
            const verify = await verifyCheckoutCallback({
              paymentId: response.razorpay_payment_id,
              subscriptionId: response.razorpay_subscription_id,
              signature: response.razorpay_signature,
            });
            if (!verify.ok) {
              toast.error(verify.error);
              return;
            }
            setStatus("activating");
            startPolling();
            router.refresh();
          });
        },
        modal: {
          ondismiss: () => setStatus("cancelled"),
        },
      });
      rzp.on("payment.failed", () => {
        toast.error(
          "Payment failed — you haven't been charged. Try again or use a different card.",
        );
      });
      rzp.open();
    });
  }

  if (isActivating || isTimedOut) {
    return (
      <div className="border-rule bg-secondary/60 space-y-1 rounded-lg border p-3 text-center text-sm">
        <p className="font-medium">
          {isActivating ? "Activating your Pro plan…" : "Still processing…"}
        </p>
        <p className="text-muted-foreground text-xs">
          {isActivating
            ? "This usually takes a few seconds."
            : "This is taking longer than usual — refresh the page in a moment to check again."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button onClick={run} disabled={pending} className="w-full">
        {pending ? "One moment…" : "Upgrade to Pro — ₹150/month"}
      </Button>
      {status === "cancelled" && (
        <p className="text-muted-foreground text-center text-xs">
          Checkout cancelled — you haven&rsquo;t been charged.
        </p>
      )}
    </div>
  );
}
