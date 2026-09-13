import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { parseImport } from "@/lib/import/parse";

export const maxDuration = 60;

const bodySchema = z.object({ importId: z.string().uuid() });

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
  if (!imp.storage_path) {
    return NextResponse.json(
      { error: "This import has no file to parse." },
      { status: 400 },
    );
  }
  if (imp.status !== "pending") {
    return NextResponse.json({
      status: imp.status,
      totalChunks: imp.total_chunks,
      truncated: imp.truncated,
      notes: imp.notes,
    });
  }

  const { data: blob, error: dlError } = await supabase.storage
    .from("imports")
    .download(imp.storage_path);
  if (dlError || !blob) {
    await supabase
      .from("imports")
      .update({ status: "error", error: "Uploaded file could not be read." })
      .eq("id", imp.id);
    return NextResponse.json(
      { error: "Uploaded file could not be read." },
      { status: 500 },
    );
  }

  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { chunks, notes, truncated } = await parseImport(
      imp.kind,
      bytes,
      imp.storage_path,
    );

    if (chunks.length === 0) {
      await supabase
        .from("imports")
        .update({ status: "error", error: notes ?? "Nothing to import." })
        .eq("id", imp.id);
      return NextResponse.json(
        { error: notes ?? "Nothing to import." },
        { status: 422 },
      );
    }

    await supabase
      .from("imports")
      .update({
        status: "processing",
        chunks,
        total_chunks: chunks.length,
        done_chunks: 0,
        notes,
        truncated,
      })
      .eq("id", imp.id);

    return NextResponse.json({
      status: "processing",
      totalChunks: chunks.length,
      truncated,
      notes,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not read that file.";
    await supabase
      .from("imports")
      .update({ status: "error", error: message })
      .eq("id", imp.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
