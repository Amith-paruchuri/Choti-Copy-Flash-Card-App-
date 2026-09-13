import type { Metadata } from "next";
import Link from "next/link";

import { ReviewDeck } from "@/components/review-deck";
import { Button } from "@/components/ui/button";
import { buildReviewSession } from "@/lib/queries/review";

export const metadata: Metadata = { title: "Reviewing" };

export default async function ReviewSessionPage(
  props: PageProps<"/review/session">,
) {
  const sp = await props.searchParams;
  const requested = Number.parseInt(
    typeof sp.n === "string" ? sp.n : "20",
    10,
  );
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), 200)
    : 20;
  const smart = sp.smart === "1";

  const items = await buildReviewSession(limit, { smart });

  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="font-display text-xl font-semibold">Nothing to review</h1>
        <p className="text-muted-foreground text-sm">
          Add or import some cards first, then come back.
        </p>
        <Button asChild size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <ReviewDeck items={items} />
    </main>
  );
}
