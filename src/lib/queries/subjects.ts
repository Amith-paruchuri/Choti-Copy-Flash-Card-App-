import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MAX_SUBJECT_DEPTH, PATH_SEP } from "@/lib/subjects/path";
import { remapSubjectColor } from "@/lib/subject-color";
import type { Subject } from "@/types/database";

/** Map any legacy earthy subject colour to the new palette (display only). */
const freshen = <T extends { color: string }>(s: T): T => ({
  ...s,
  color: remapSubjectColor(s.color),
});

export type SubjectWithCount = Subject & { cardCount: number };

export interface SubjectNode extends Subject {
  depth: number;
  /** Names from root to this node. */
  path: string[];
  /** Cards directly in this subject. */
  directCount: number;
  /** Cards in this subject plus every descendant. */
  subtreeCount: number;
  children: SubjectNode[];
}

async function loadSubjectsAndCounts() {
  const supabase = await createClient();
  const [subjectsRes, cardsRes] = await Promise.all([
    supabase.from("subjects").select("*").order("name", { ascending: true }),
    supabase.from("flashcards").select("subject_id").eq("is_active", true),
  ]);
  const direct = new Map<string, number>();
  for (const row of cardsRes.data ?? []) {
    direct.set(row.subject_id, (direct.get(row.subject_id) ?? 0) + 1);
  }
  return { subjects: (subjectsRes.data ?? []).map(freshen), direct };
}

/** The user's subject forest with depth, path, and rolled-up card counts. */
export async function getSubjectTree(): Promise<SubjectNode[]> {
  const { subjects, direct } = await loadSubjectsAndCounts();

  const nodes = new Map<string, SubjectNode>();
  for (const s of subjects) {
    nodes.set(s.id, {
      ...s,
      depth: 0,
      path: [],
      directCount: direct.get(s.id) ?? 0,
      subtreeCount: 0,
      children: [],
    });
  }

  const roots: SubjectNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parent_id ? nodes.get(n.parent_id) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }

  const walk = (n: SubjectNode, depth: number, parentPath: string[]) => {
    n.depth = depth;
    n.path = [...parentPath, n.name];
    n.children.sort((a, b) => a.name.localeCompare(b.name));
    let total = n.directCount;
    for (const child of n.children) {
      walk(child, depth + 1, n.path);
      total += child.subtreeCount;
    }
    n.subtreeCount = total;
  };
  roots.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of roots) walk(r, 0, []);
  return roots;
}

/** Depth-first flatten of a subject forest. */
export function flattenTree(roots: SubjectNode[]): SubjectNode[] {
  const out: SubjectNode[] = [];
  const rec = (n: SubjectNode) => {
    out.push(n);
    n.children.forEach(rec);
  };
  roots.forEach(rec);
  return out;
}

/**
 * Existing paths worth offering the AI as reuse targets — joined
 * broad→specific strings, e.g. "Nephrology › Renal tubulopathies". Excludes
 * bare top-level names (too broad to be a specific placement on their own)
 * and, optionally, subjects the caller is already re-filing. Shared by the
 * re-sort flow and the manual "Suggest subject" action so both offer the
 * AI the same reuse hints.
 */
export function reusablePathsFor(
  nodes: SubjectNode[],
  excludeIds: Set<string> = new Set(),
): string[] {
  return nodes
    .filter((n) => !excludeIds.has(n.id) && n.path.length >= 2)
    .map((n) => n.path.join(PATH_SEP));
}

/** Root → node chain for breadcrumbs. */
export async function getSubjectAncestors(id: string): Promise<Subject[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("subjects").select("*");
  const byId = new Map((data ?? []).map((s) => [s.id, s]));

  const chain: Subject[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard < MAX_SUBJECT_DEPTH + 1) {
    chain.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    guard += 1;
  }
  return chain;
}

export async function listChildSubjects(
  parentId: string,
): Promise<SubjectWithCount[]> {
  const { subjects, direct } = await loadSubjectsAndCounts();
  // subtree count per subject, computed once
  const byParent = new Map<string | null, Subject[]>();
  for (const s of subjects) {
    const key = s.parent_id;
    byParent.set(key, [...(byParent.get(key) ?? []), s]);
  }
  const subtree = (id: string): number =>
    (direct.get(id) ?? 0) +
    (byParent.get(id) ?? []).reduce((sum, c) => sum + subtree(c.id), 0);

  return (byParent.get(parentId) ?? [])
    .map((s) => ({ ...s, cardCount: subtree(s.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Top-level subjects only, with rolled-up counts (dashboard grid). */
export async function listSubjectsWithCounts(): Promise<SubjectWithCount[]> {
  const roots = await getSubjectTree();
  return roots.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    parent_id: r.parent_id,
    created_at: r.created_at,
    cardCount: r.subtreeCount,
  }));
}

export interface ResortCandidate {
  id: string;
  name: string;
  color: string;
  cardCount: number;
}

/**
 * Top-level subjects that look like they were dropped in flat: no children and
 * only a handful of cards. These are what "Re-sort with AI" offers to re-file.
 */
export async function getResortCandidates(): Promise<ResortCandidate[]> {
  const { subjects, direct } = await loadSubjectsAndCounts();
  const hasChildren = new Set(
    subjects.filter((s) => s.parent_id).map((s) => s.parent_id as string),
  );
  return subjects
    .filter((s) => s.parent_id === null && !hasChildren.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      cardCount: direct.get(s.id) ?? 0,
    }))
    .filter((c) => c.cardCount >= 1 && c.cardCount <= 8)
    .sort(
      (a, b) => a.cardCount - b.cardCount || a.name.localeCompare(b.name),
    );
}

export interface PickerSubject {
  id: string;
  name: string;
  parentId: string | null;
  /** 1-based: a top-level subject is 1. */
  depth: number;
}

export interface DrilldownSubject {
  id: string;
  name: string;
  parentId: string | null;
  /** Cards in this subject plus every descendant. */
  cardCount: number;
}

/** Flat subject list with parent links + rolled-up counts — for `<SubjectDrilldown>`. */
export async function listSubjectsForDrilldown(): Promise<DrilldownSubject[]> {
  const roots = await getSubjectTree();
  const out: DrilldownSubject[] = [];
  const rec = (n: SubjectNode) => {
    out.push({
      id: n.id,
      name: n.name,
      parentId: n.parent_id,
      cardCount: n.subtreeCount,
    });
    n.children.forEach(rec);
  };
  roots.forEach(rec);
  return out;
}

/** DFS-ordered flat list with depth — for indented folder pickers. */
export async function listSubjectsForPicker(): Promise<PickerSubject[]> {
  const roots = await getSubjectTree();
  const out: PickerSubject[] = [];
  const rec = (n: SubjectNode) => {
    out.push({
      id: n.id,
      name: n.name,
      parentId: n.parent_id,
      depth: n.depth + 1,
    });
    n.children.forEach(rec);
  };
  roots.forEach(rec);
  return out;
}

/** Every subject, flat, for pickers. */
export async function listSubjects(): Promise<Subject[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []).map(freshen);
}

export async function getSubject(id: string): Promise<Subject | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? freshen(data) : null;
}
