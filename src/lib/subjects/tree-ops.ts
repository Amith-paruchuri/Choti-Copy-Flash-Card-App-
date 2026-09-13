/**
 * Pure helpers for reasoning about the subject forest from a flat row list.
 * Used by the manual folder actions (create / rename / move / delete) to run
 * cycle, depth and name-collision checks before touching the database.
 */

export interface FlatSubject {
  id: string;
  name: string;
  parent_id: string | null;
}

const norm = (s: string) => s.trim().toLowerCase();
const sameParent = (a: string | null, b: string | null) => (a ?? null) === (b ?? null);

/** Direct children of `parentId` (pass `null` for top-level subjects). */
export function childrenOf(
  all: FlatSubject[],
  parentId: string | null,
): FlatSubject[] {
  return all.filter((s) => sameParent(s.parent_id, parentId));
}

/** Every id below `id` in the tree (not including `id`). Cycle-safe. */
export function descendantIds(all: FlatSubject[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const child of all.filter((s) => s.parent_id === cur)) {
      if (child.id === id || out.has(child.id)) continue;
      out.add(child.id);
      stack.push(child.id);
    }
  }
  return out;
}

/** 1-based depth: a top-level subject is 1, its child 2, and so on. Cycle-safe. */
export function depthOf(all: FlatSubject[], id: string): number {
  const byId = new Map(all.map((s) => [s.id, s]));
  const seen = new Set<string>();
  let depth = 0;
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    depth += 1;
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return depth;
}

/** Number of levels in the subtree rooted at `id` (1 for a leaf). Cycle-safe. */
export function subtreeHeight(all: FlatSubject[], id: string): number {
  const walk = (node: string, seen: Set<string>): number => {
    const kids = all.filter((s) => s.parent_id === node && !seen.has(s.id));
    if (kids.length === 0) return 1;
    return (
      1 +
      Math.max(...kids.map((k) => walk(k.id, new Set(seen).add(k.id))))
    );
  };
  return walk(id, new Set([id]));
}

/** Is there already a sibling named `name` under `parentId` (excluding `exceptId`)? */
export function nameClashesIn(
  all: FlatSubject[],
  parentId: string | null,
  name: string,
  exceptId?: string,
): boolean {
  return all.some(
    (s) =>
      s.id !== exceptId &&
      sameParent(s.parent_id, parentId) &&
      norm(s.name) === norm(name),
  );
}
