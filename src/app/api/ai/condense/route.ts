import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getAIProvider, AIError } from "@/lib/ai";
import { recordAiCall } from "@/lib/usage/ai";

export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(8000),
  subjectName: z.string().trim().max(80).optional(),
});

export async function POST(request: NextRequest) {
  let supabase;
  try {
    ({ supabase } = await requireUser());
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paste something between 1 and 8000 characters." },
      { status: 400 },
    );
  }

  try {
    const { draft } = await getAIProvider().condense(parsed.data);
    await recordAiCall(supabase);
    return NextResponse.json({ draft });
  } catch (e) {
    const message =
      e instanceof AIError ? e.message : "Couldn't condense that. Try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
