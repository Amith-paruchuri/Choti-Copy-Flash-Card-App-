import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { limitsForTier, startOfUtcWeek } from "@/lib/billing/limits";
import { getBillingProfile } from "@/lib/queries/account";

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

  // Only PDF/image imports carry a weekly cap — text/zip stay ungated.
  if (parsed.data.kind === "pdf" || parsed.data.kind === "image") {
    const { tier } = await getBillingProfile();
    const weeklyCap = limitsForTier(tier).importsPerWeek;
    if (weeklyCap !== null) {
      const { count } = await supabase
        .from("imports")
        .select("*", { count: "exact", head: true })
        .in("kind", ["pdf", "image"])
        .gte("created_at", startOfUtcWeek().toISOString());
      const used = count ?? 0;
      if (used >= weeklyCap) {
        return NextResponse.json(
          {
            error: `You've used all ${weeklyCap} PDF/image imports for this week. Pro removes the weekly cap.`,
            limit: { feature: "import_weekly", used, cap: weeklyCap, tier },
          },
          { status: 429 },
        );
      }
    }
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
