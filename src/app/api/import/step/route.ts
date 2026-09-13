import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getAIProvider, AIError } from "@/lib/ai";
import { IMPORT_CAPS } from "@/lib/import/caps";
import { isBroadSubject } from "@/lib/validation";
import { recordAiCall } from "@/lib/usage/ai";
import type { ContentPart } from "@/lib/ai/types";
import type { Database, ImportChunk, ImportKind } from "@/types/database";

type ImportUpdate = Database["public"]["Tables"]["imports"]["Update"];

export const maxDuration = 60;

const bodySchema = z.object({ importId: z.string().uuid() });

const CONTEXT: Record<ImportKind, string> = {
  image: "a photo of study notes or a textbook page",
  pdf: "a section of a PDF document",
  text: "a student's plain-text study notes",
  zip: "files from an archive (chat export or scanned notes)",
  resort: "existing flashcards being re-filed",
  anki: "an Anki deck",
};

async function toContentPart(
  chunk: ImportChunk,
  download: (path: string) => Promise<Blob | null>,
): Promise<ContentPart | null> {
  if (chunk.type === "text") return { kind: "text", text: chunk.text };

  if (chunk.type === "image_inline") {
    return {
      kind: "image",
      dataUrl: `data:${chunk.mime};base64,${chunk.data_b64}`,
    };
  }

  const blob = await download(chunk.storage_path);
  if (!blob) return null;
  const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  const mime = blob.type || "image/jpeg";
  return { kind: "image", dataUrl: `data:${mime};base64,${b64}` };
}

export async function POST(request: NextRequest) {
  let supabase;
  try {
    ({ supabase } = await requireUser());
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: imp } = await supabase
    .from("imports")
    .select("*")
    .eq("id", parsed.data.importId)
    .maybeSingle();
  if (!imp) {
    return NextResponse.json({ error: "Import not found." }, { status: 404 });
  }
  if (imp.status !== "processing") {
    return NextResponse.json({
      status: imp.status,
      doneChunks: imp.done_chunks,
      totalChunks: imp.total_chunks,
      addedCards: 0,
    });
  }

  const { count: existingCards } = await supabase
    .from("import_cards")
    .select("*", { count: "exact", head: true })
    .eq("import_id", imp.id);
  const cardsSoFar = existingCards ?? 0;
  const budget = IMPORT_CAPS.maxCardsPerImport - cardsSoFar;

  const finish = async (patch: ImportUpdate) => {
    await supabase.from("imports").update(patch).eq("id", imp.id);
  };

  if (budget <= 0) {
    await finish({ status: "ready", truncated: true });
    return NextResponse.json({
      status: "ready",
      doneChunks: imp.total_chunks,
      totalChunks: imp.total_chunks,
      addedCards: 0,
    });
  }

  const chunk = (imp.chunks as ImportChunk[])[imp.done_chunks];
  if (!chunk) {
    await finish({ status: "ready", done_chunks: imp.total_chunks });
    return NextResponse.json({
      status: "ready",
      doneChunks: imp.total_chunks,
      totalChunks: imp.total_chunks,
      addedCards: 0,
    });
  }

  try {
    const part = await toContentPart(chunk, async (path) => {
      const { data } = await supabase.storage.from("imports").download(path);
      return data ?? null;
    });
    if (!part) throw new AIError("An image in this import could not be read.");

    const { data: subjectRows } = await supabase
      .from("subjects")
      .select("name")
      .order("name", { ascending: true });
    // Don't offer whole-discipline subjects as reuse targets — they're the
    // thing we're trying to get away from.
    const existingSubjects = (subjectRows ?? [])
      .map((s) => s.name)
      .filter((n) => !isBroadSubject(n));

    const cards = await getAIProvider().generateCards({
      parts: [part],
      context: CONTEXT[imp.kind],
      maxCards: Math.min(IMPORT_CAPS.maxCardsPerChunk, budget),
      existingSubjects,
    });
    await recordAiCall(supabase);

    if (cards.length > 0) {
      await supabase.from("import_cards").insert(
        cards.map((c, i) => ({
          import_id: imp.id,
          user_id: imp.user_id,
          title: c.title,
          subtitle: c.subtitle,
          content: c.content,
          suggested_subject: c.subject,
          suggested_path: c.path.length ? c.path : [c.subject],
          position: cardsSoFar + i,
        })),
      );
    }

    const doneChunks = imp.done_chunks + 1;
    const complete = doneChunks >= imp.total_chunks;
    await finish({
      done_chunks: doneChunks,
      status: complete ? "ready" : "processing",
    });

    return NextResponse.json({
      status: complete ? "ready" : "processing",
      doneChunks,
      totalChunks: imp.total_chunks,
      addedCards: cards.length,
    });
  } catch (e) {
    const message =
      e instanceof AIError
        ? e.message
        : e instanceof Error
          ? e.message
          : "The AI step failed.";
    await finish({ status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
