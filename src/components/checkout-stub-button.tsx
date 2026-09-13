"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startCheckout } from "@/actions/billing";
import { Button } from "@/components/ui/button";

export function CheckoutStubButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startCheckout();
          if (res.ok) window.location.href = res.data.url;
          else toast.message(res.error);
        })
      }
    >
      {pending ? "One moment…" : "Upgrade to Pro"}
    </Button>
  );
}
