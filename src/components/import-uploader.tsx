"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { IMPORT_CAPS, UPLOAD_ACCEPT, kindForUpload } from "@/lib/import/caps";
import { uuidv4 } from "@/lib/uuid";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/drop-zone";
import { Progress } from "@/components/ui/progress";

type Phase =
  | { name: "idle" }
  | { name: "uploading" }
  | { name: "parsing" }
  | { name: "processing"; done: number; total: number; cards: number }
  | { name: "error"; message: string };

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

export function ImportUploader({ userId }: { userId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const busy = phase.name !== "idle" && phase.name !== "error";

  async function onFile(file: File) {
    const kind = kindForUpload(file.name, file.type);
    if (!kind) {
      toast.error(
        "Upload an image (PNG/JPG), a PDF, a .txt file, or a .zip (e.g. a WhatsApp export).",
      );
      return;
    }
    if (file.size > IMPORT_CAPS.maxUploadBytes) {
      toast.error("That file is over 20 MB.");
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
      if (!created.ok) throw new Error(String(created.data.error ?? "Upload failed."));
      const importId = String(created.data.importId);

      setPhase({ name: "parsing" });
      const prep = await postJson("/api/import/parse", { importId });
      if (!prep.ok) throw new Error(String(prep.data.error ?? "Could not read that file."));
      const total = Number(prep.data.totalChunks ?? 0);
      if (prep.data.notes) toast.info(String(prep.data.notes));

      setPhase({ name: "processing", done: 0, total, cards: 0 });
      let cards = 0;
      for (let guard = 0; guard < total + 2; guard++) {
        const step = await postJson("/api/import/step", { importId });
        if (!step.ok) throw new Error(String(step.data.error ?? "Processing failed."));
        cards += Number(step.data.addedCards ?? 0);
        const done = Number(step.data.doneChunks ?? 0);
        setPhase({ name: "processing", done, total, cards });
        if (step.data.status === "ready") break;
        if (step.data.status === "error") {
          throw new Error(String(step.data.error ?? "Processing failed."));
        }
      }

      router.push(`/import/${importId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import failed.";
      setPhase({ name: "error", message });
      toast.error(message);
    }
  }

  return (
    <div className="space-y-4">
      <DropZone
        onFile={(f) => void onFile(f)}
        accept={UPLOAD_ACCEPT}
        disabled={busy}
        icon={<Upload className="size-6" />}
        label={busy ? "Working…" : "Choose a file"}
        hint={`Image (PNG/JPG), PDF (up to ${IMPORT_CAPS.maxPdfPages} pages), .txt notes, or a .zip (WhatsApp export) · max 20 MB`}
      />

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
          <p className="text-destructive text-sm">{phase.message}</p>
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
