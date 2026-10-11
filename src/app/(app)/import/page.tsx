import type { Metadata } from "next";
import Link from "next/link";

import { AnkiImporter } from "@/components/anki-importer";
import { ImportUploader } from "@/components/import-uploader";
import { requireUser } from "@/lib/auth/session";
import { FEATURE } from "@/lib/billing/limits";
import { trialDaysRemaining } from "@/lib/billing/tier";
import { getBillingProfile } from "@/lib/queries/account";
import { getWeeklyImportUsage } from "@/lib/queries/imports-usage";
import { getFeatureUsageToday } from "@/lib/usage/feature";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  const { user, supabase } = await requireUser();
  const [billing, weeklyImports, cardsToday] = await Promise.all([
    getBillingProfile(),
    getWeeklyImportUsage(supabase),
    getFeatureUsageToday(supabase, FEATURE.cards),
  ]);

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Import material</h1>
        <Link href="/dashboard" className="text-muted-foreground text-sm">
          Cancel
        </Link>
      </div>
      <p className="text-muted-foreground text-sm">
        Upload a photo of your notes, a PDF, or a WhatsApp chat export. The AI
        reads it and drafts flashcards for you to review before saving.
      </p>
      <ImportUploader
        userId={user.id}
        tier={billing.tier}
        weeklyImportsUsed={weeklyImports}
        cardsUsedToday={cardsToday}
        trialDaysLeft={
          billing.tier === "trialing"
            ? trialDaysRemaining(billing.trialEndsAt)
            : null
        }
      />

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">
          already have an Anki deck?
        </span>
        <span className="bg-border h-px flex-1" />
      </div>

      <AnkiImporter userId={user.id} />
    </main>
  );
}
