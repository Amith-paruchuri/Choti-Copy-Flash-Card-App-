"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { setCardSuspended } from "@/actions/leech";
import { Button } from "@/components/ui/button";

export function ReactivateButton({ flashcardId }: { flashcardId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setCardSuspended({ flashcardId, suspended: false });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Card is back in rotation.");
          router.refresh();
        })
      }
    >
      <RotateCcw className="size-3.5" />
      {pending ? "Reactivating…" : "Reactivate"}
    </Button>
  );
}
