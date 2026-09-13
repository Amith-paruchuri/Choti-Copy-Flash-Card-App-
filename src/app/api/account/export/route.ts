import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Download everything this account holds as one JSON file. RLS scopes every
 * query to the caller, so no user id is needed in the request.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [subjects, flashcards, quizQuestions, cardMemory, reviewEvents] =
    await Promise.all([
      supabase.from("subjects").select("*").order("created_at"),
      supabase.from("flashcards").select("*").order("created_at"),
      supabase.from("quiz_questions").select("*").order("created_at"),
      supabase.from("card_memory").select("*"),
      supabase.from("review_events").select("*").order("reviewed_at"),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    subjects: subjects.data ?? [],
    flashcards: flashcards.data ?? [],
    quiz_questions: quizQuestions.data ?? [],
    card_memory: cardMemory.data ?? [],
    review_events: reviewEvents.data ?? [],
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="choti-copy-export-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
