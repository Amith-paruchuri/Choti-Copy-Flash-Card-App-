"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DrillNode {
  id: string;
  name: string;
  parentId: string | null;
}

interface TreeNode<T> {
  item: T;
  children: TreeNode<T>[];
}

function buildForest<T extends DrillNode>(items: T[]) {
  const byId = new Map<string, TreeNode<T>>();
  for (const item of items) byId.set(item.id, { item, children: [] });

  const roots: TreeNode<T>[] = [];
  const parentOf = new Map<string, string | null>();
  for (const item of items) {
    parentOf.set(item.id, item.parentId);
    const node = byId.get(item.id)!;
    const parent = item.parentId ? byId.get(item.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (n: TreeNode<T>) => {
    n.children.sort((a, b) => a.item.name.localeCompare(b.item.name));
    n.children.forEach(sortRec);
  };
  roots.sort((a, b) => a.item.name.localeCompare(b.item.name));
  roots.forEach(sortRec);

  return { roots, byId, parentOf };
}

/**
 * Progressive folder-style drill-down over a subject forest: a breadcrumb plus
 * exactly one level of children at a time — never the whole flattened tree.
 * Shared by the quiz picker ("Draw from") and the Progress "Every subject"
 * explorer so the two behave identically. Clicking a row focuses that subject
 * (`onChange`); the focused subject *is* the current scope — you don't have to
 * drill to a leaf. Breadcrumb crumbs jump back up.
 */
export function SubjectDrilldown<T extends DrillNode>({
  items,
  value,
  onChange,
  allLabel = "All subjects",
  renderTrailing,
  renderHeader,
  leafHint = "Deepest level — no sub-topics to narrow into.",
  className,
}: {
  items: T[];
  /** currently focused subject id, or null for "everything". */
  value: string | null;
  onChange: (id: string | null) => void;
  allLabel?: string;
  /** right-aligned per-row content (a count, a mini bar, a checkmark…). */
  renderTrailing?: (item: T) => React.ReactNode;
  /** block shown for the CURRENTLY focused level (`null` = All) — its own rolled-up stats. */
  renderHeader?: (item: T | null) => React.ReactNode;
  leafHint?: string;
  className?: string;
}) {
  const { roots, byId, parentOf } = useMemo(() => buildForest(items), [items]);

  const chain = useMemo<(T | null)[]>(() => {
    if (!value) return [null];
    const acc: T[] = [];
    let cur: string | null = value;
    let guard = 0;
    while (cur && guard < 12) {
      const n = byId.get(cur);
      if (!n) break;
      acc.unshift(n.item);
      cur = parentOf.get(cur) ?? null;
      guard += 1;
    }
    return [null, ...acc];
  }, [value, byId, parentOf]);

  const focused = value ? byId.get(value) : undefined;
  const level = value ? (focused?.children ?? []) : roots;

  return (
    <div className={cn("space-y-2.5", className)}>
      <nav
        aria-label="Subject path"
        className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs"
      >
        {chain.flatMap((item, i) => {
          const id = item?.id ?? "__all";
          const last = i === chain.length - 1;
          const crumb = (
            <button
              key={id}
              type="button"
              onClick={() => onChange(item?.id ?? null)}
              disabled={last}
              className={cn(
                "rounded px-1 py-0.5 transition",
                last
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:underline",
              )}
            >
              {item ? item.name : allLabel}
            </button>
          );
          return i === 0
            ? [crumb]
            : [
                <ChevronRight
                  key={`sep-${id}`}
                  className="text-muted-foreground/60 size-3 flex-none"
                />,
                crumb,
              ];
        })}
      </nav>

      {renderHeader && <div>{renderHeader(focused?.item ?? null)}</div>}

      {level.length > 0 ? (
        <ul className="border-rule divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {level.map((n) => (
            <li key={n.item.id}>
              <button
                type="button"
                onClick={() => onChange(n.item.id)}
                className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-2.5 text-left transition"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {n.item.name}
                </span>
                {renderTrailing?.(n.item)}
                {n.children.length > 0 && (
                  <ChevronRight className="text-muted-foreground size-4 flex-none" />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground px-1 text-xs">{leafHint}</p>
      )}
    </div>
  );
}
