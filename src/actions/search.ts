"use server";

import { requireUser } from "@/lib/auth/session";
import { PATH_SEP } from "@/lib/subjects/path";

export interface SearchHit {
  id: string;
  title: string | null;
  subtitle: string | null;
  /** A short excerpt of the card body around the match. */
  snippet: string;
  subjectId: string;
  /** Broad → specific, e.g. "Nephrology › Renal tubulopathies". */
  subjectPath: string;
}

const MAX_HITS = 20;
const SNIPPET_LEN = 140;

function makeSnippet(content: string, term: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return flat.slice(0, SNIPPET_LEN) + (flat.length > SNIPPET_LEN ? "…" : "");
  const start = Math.max(0, at - 40);
  const end = Math.min(flat.length, at + term.length + 100);
  return (
    (start > 0 ? "…" : "") +
    flat.slice(start, end) +
    (end < flat.length ? "…" : "")
  );
}

/**
 * Account-wide flashcard search. Matches the term against title, subtitle and
 * body of every active card, regardless of subject. Read-only — no AI.
 */
export async function searchFlashcards(rawQuery: string): Promise<SearchHit[]> {
  const term = rawQuery.trim();
  if (term.length < 2) return [];

  const { supabase } = await requireUser();

  // Quote the pattern so commas / parens in the term can't break PostgREST's
  // `or` grammar; strip quotes and backslashes that would break the quoting.
  const escaped = term.replace(/["\\]/g, " ").replace(/[%_]/g, "\\$&");
  const pattern = `"%${escaped}%"`;

  interface SearchRow {
    id: string;
    title: string | null;
    subtitle: string | null;
    content: string;
    subject_id: string;
    image_alt?: string | null;
  }

  const run = async (withAlt: boolean) => {
    const select = withAlt
      ? "id, title, subtitle, content, image_alt, subject_id, updated_at"
      : "id, title, subtitle, content, subject_id, updated_at";
    const or = [
      `title.ilike.${pattern}`,
      `subtitle.ilike.${pattern}`,
      `content.ilike.${pattern}`,
      ...(withAlt ? [`image_alt.ilike.${pattern}`] : []),
    ].join(",");
    const res = await supabase
      .from("flashcards")
      .select(select)
      .eq("is_active", true)
      .or(or)
      .order("updated_at", { ascending: false })
      .limit(MAX_HITS);
    return {
      data: (res.data as unknown as SearchRow[] | null) ?? null,
      error: res.error,
    };
  };

  // `image_alt` needs migration 0019 — fall back to a text-only search without
  // it so search keeps working until that's applied.
  let { data: cards, error } = await run(true);
  if (error && /image_alt/i.test(error.message)) {
    ({ data: cards, error } = await run(false));
  }

  if (error || !cards?.length) return [];

  const { data: allSubjects } = await supabase
    .from("subjects")
    .select("id, name, parent_id");
  const byId = new Map((allSubjects ?? []).map((s) => [s.id, s]));

  const pathFor = (id: string): string => {
    const parts: string[] = [];
    let cur = byId.get(id);
    let guard = 0;
    while (cur && guard < 8) {
      parts.unshift(cur.name);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      guard += 1;
    }
    return parts.join(PATH_SEP);
  };

  const lower = term.toLowerCase();
  return cards.map((c) => {
    const imageAlt = typeof c.image_alt === "string" ? c.image_alt : "";
    // Prefer a snippet from wherever the term actually appears — for an
    // image-primary card the match is often only in the AI description.
    const body =
      c.content.toLowerCase().includes(lower) || !imageAlt
        ? c.content
        : imageAlt;
    return {
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      snippet: makeSnippet(body, term),
      subjectId: c.subject_id,
      subjectPath: pathFor(c.subject_id),
    };
  });
}
