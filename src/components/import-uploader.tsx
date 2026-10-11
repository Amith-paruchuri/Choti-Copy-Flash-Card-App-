"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { limitsForTier } from "@/lib/billing/limits";
import { IMPORT_CAPS, UPLOAD_ACCEPT, kindForUpload } from "@/lib/import/caps";
import { uuidv4 } from "@/lib/uuid";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/drop-zone";
import { FeatureUsageNote } from "@/components/feature-usage-note";
import { Progress } from "@/components/ui/progress";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import type { SubscriptionTier } from "@/types/database";

type Phase =
  | { name: "idle" }
  | { name: "uploading" }
  | { name: "parsing" }
  | { name: "processing"; done: number; total: number; cards: number }
  | { name: "error"; message: string; isLimit: boolean };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data } as {
    ok: boolean;
    status: number;
    data: Record<string, unknown>;
  };
}

class ImportError extends Error {
  isLimit: boolean;
  constructor(message: string, isLimit: boolean) {
    super(message);
    this.isLimit = isLimit;
  }
}

function errorFrom(
  res: { data: Record<string, unknown> },
  fallback: string,
): ImportError {
  return new ImportError(
    String(res.data.error ?? fallback),
    Boolean(res.data.limit),
  );
}

export function ImportUploader({
  userId,
  tier,
  weeklyImportsUsed,
  cardsUsedToday,
  trialDaysLeft,
}: {
  userId: string;
  tier: SubscriptionTier;
  weeklyImportsUsed: number;
  cardsUsedToday: number;
  trialDaysLeft: number | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const busy = phase.name !== "idle" && phase.name !== "error";
  const limits = limitsForTier(tier);

  async function onFile(file: File) {
    const kind = kindForUpload(file.name, file.type);
    if (!kind) {
      toast.error(
        "Upload an image (PNG/JPG), a PDF, a .txt file, or a .zip (e.g. a WhatsApp export).",
      );
      return;
    }
    // PDF/image share the tier-gated size cap; text/zip keep the flat
    // system ceiling (they're not gated — see src/lib/billing/limits.ts).
    const gated = kind === "pdf" || kind === "image";
    const maxBytes = gated ? limits.importMaxBytes : IMPORT_CAPS.maxUploadBytes;
    if (file.size > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      toast.error(
        gated
          ? `That file is over your ${mb} MB limit. Pro allows up to ${Math.round(limitsForTier("pro").importMaxBytes / (1024 * 1024))} MB.`
          : `That file is over ${mb} MB.`,
      );
      return;
    }

    try {
      setPhase({ name: "uploading" });
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${userId}/${uuidv4()}.${ext}`;
      const up = await supabase.storage.from("imports").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (up.error) throw new Error(up.error.message);

      const created = await postJson("/api/import/create", {
        storagePath: path,
        kind,
        originalName: file.name,
      });
      if (!created.ok) throw errorFrom(created, "Upload failed.");
      const importId = String(created.data.importId);

      setPhase({ name: "parsing" });
      const prep = await postJson("/api/import/parse", { importId });
      if (!prep.ok) throw errorFrom(prep, "Could not read that file.");
      const total = Number(prep.data.totalChunks ?? 0);
      if (prep.data.notes) toast.info(String(prep.data.notes));

      setPhase({ name: "processing", done: 0, total, cards: 0 });
      let cards = 0;
      for (let guard = 0; guard < total + 2; guard++) {
        const step = await postJson("/api/import/step", { importId });
        if (!step.ok) throw errorFrom(step, "Processing failed.");
        cards += Number(step.data.addedCards ?? 0);
        const done = Number(step.data.doneChunks ?? 0);
        setPhase({ name: "processing", done, total, cards });
        if (step.data.status === "ready") break;
        if (step.data.status === "error") {
          throw errorFrom(
            { data: { error: step.data.error } },
            "Processing failed.",
          );
        }
      }

      router.push(`/import/${importId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import failed.";
      const isLimit = e instanceof ImportError && e.isLimit;
      setPhase({ name: "error", message, isLimit });
      if (!isLimit) toast.error(message);
    }
  }

  const showWeeklyNote = tier === "free" || tier === "trialing";

  return (
    <div className="space-y-4">
      <DropZone
        onFile={(f) => void onFile(f)}
        accept={UPLOAD_ACCEPT}
        disabled={busy}
        icon={<Upload className="size-6" />}
        label={busy ? "Working…" : "Choose a file"}
        hint={`Image (PNG/JPG), PDF (up to ${limits.importMaxPages} pages), .txt notes, or a .zip (WhatsApp export) · PDF/image max ${Math.round(limits.importMaxBytes / (1024 * 1024))} MB`}
      />
      {showWeeklyNote && (
        <div className="space-y-1">
          <FeatureUsageNote
            used={cardsUsedToday}
            cap={limits.aiCardsPerDay}
            label="AI-generated cards"
            trialDaysLeft={trialDaysLeft}
          />
          {limits.importsPerWeek !== null && (
            <FeatureUsageNote
              used={weeklyImportsUsed}
              cap={limits.importsPerWeek}
              label="PDF/image imports"
              period="this week"
            />
          )}
        </div>
      )}

      {phase.name === "uploading" && (
        <p className="text-muted-foreground text-sm">Uploading…</p>
      )}
      {phase.name === "parsing" && (
        <p className="text-muted-foreground text-sm">Reading the file…</p>
      )}
      {phase.name === "processing" && (
        <div className="space-y-2">
          <Progress
            value={
              phase.total ? Math.round((phase.done / phase.total) * 100) : 10
            }
          />
          <p className="text-muted-foreground text-sm">
            Generating flashcards — {phase.done}/{phase.total} sections,{" "}
            {phase.cards} card{phase.cards === 1 ? "" : "s"} so far. Keep this tab
            open.
          </p>
        </div>
      )}
      {phase.name === "error" && (
        <div className="space-y-2">
          {phase.isLimit ? (
            <UpgradePrompt message={phase.message} />
          ) : (
            <p className="text-destructive text-sm">{phase.message}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPhase({ name: "idle" })}
          >
            Try another file
          </Button>
        </div>
      )}
    </div>
  );
}
