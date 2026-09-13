import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";

export const maxDuration = 60;

const bodySchema = z.object({
  storagePath: z.string().min(3).max(500),
  kind: z.enum(["image", "pdf", "text", "zip"]),
  originalName: z.string().min(1).max(255),
});

export async function POST(request: NextRequest) {
  let user, supabase;
  try {
    ({ user, supabase } = await requireUser());
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // The upload already happened client-side; make sure it landed in the
  // caller's own folder before we trust the path.
  if (!parsed.data.storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Bad upload path." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("imports")
    .insert({
      user_id: user.id,
      kind: parsed.data.kind,
      original_name: parsed.data.originalName,
      storage_path: parsed.data.storagePath,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not start the import." },
      { status: 500 },
    );
  }

  return NextResponse.json({ importId: data.id });
}
