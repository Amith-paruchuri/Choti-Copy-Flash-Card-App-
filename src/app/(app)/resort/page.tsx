import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { ResortStarter } from "@/components/resort-starter";
import { Button } from "@/components/ui/button";
import { getResortCandidates } from "@/lib/queries/subjects";

export const metadata: Metadata = { title: "Re-sort with AI" };

export default async function ResortPage() {
  const candidates = await getResortCandidates();

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Sparkles className="text-ink size-5" />
          Re-sort with AI
        </h1>
        <p className="text-muted-foreground text-sm">
          Loose top-level subjects with just a few cards get folded under shared
          parents like Nephrology or Pulmonology.
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="border-rule flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold">Nothing to re-sort</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            Your subjects are already nested, or have enough cards to stand on
            their own.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      ) : (
        <ResortStarter candidates={candidates} />
      )}
    </main>
  );
}
