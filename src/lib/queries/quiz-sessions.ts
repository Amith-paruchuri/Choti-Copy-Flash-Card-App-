import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { QuizSession } from "@/types/database";

export interface QuizSessionSummary {
  id: string;
  mode: QuizSession["mode"];
  scopeLabel: string;
  total: number;
  correct: number;
  answered: number;
  timed: boolean;
  createdAt: string;
}

/** Recent finished quiz/exam sessions, newest first — for the /quiz history list. */
export async function listQuizSessions(
  limit = 20,
): Promise<QuizSessionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, mode, scope_label, total, correct, answered, time_limit_s, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  // Table missing (migration 0015 not applied yet) → no history.
  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id,
    mode: r.mode,
    scopeLabel: r.scope_label,
    total: r.total,
    correct: r.correct,
    answered: r.answered,
    timed: r.time_limit_s != null,
    createdAt: r.created_at,
  }));
}

/** One session with its full per-question snapshot, or null. */
export async function getQuizSession(id: string): Promise<QuizSession | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}
