"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FolderInput, X } from "lucide-react";
import { toast } from "sonner";

import { moveSubjects } from "@/actions/subjects";
import { SubjectIcon } from "@/components/subject-icon";
import { SubjectSelect, type SubjectOption } from "@/components/subject-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PickerSubject, SubjectWithCount } from "@/lib/queries/subjects";
import { cn } from "@/lib/utils";

function DividerTab({ color, icon }: { color: string; icon: string | null }) {
  return (
    <span
      aria-hidden
      className="absolute -top-2.5 left-3.5 grid h-6 w-11 place-items-center rounded-[8px_8px_3px_3px] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
      style={{ backgroundColor: color }}
    >
      <SubjectIcon icon={icon} className="size-3.5" />
    </span>
  );
}

export function SubjectGridManager({
  subjects,
  allSubjects,
}: {
  subjects: SubjectWithCount[];
  /** Every folder, DFS order with 1-based depth — for the destination picker. */
  allSubjects: PickerSubject[];
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelecting(false);
    setSelected(new Set());
  }

  // Destination options: can't move a folder into itself or its own subtree.
  const childrenByParent = useMemo(() => {
    const m = new Map<string | null, PickerSubject[]>();
    for (const s of allSubjects) {
      m.set(s.parentId, [...(m.get(s.parentId) ?? []), s]);
    }
    return m;
  }, [allSubjects]);

  const blocked = useMemo(() => {
    const set = new Set<string>();
    const mark = (id: string) => {
      set.add(id);
      for (const c of childrenByParent.get(id) ?? []) mark(c.id);
    };
    for (const id of selected) mark(id);
    return set;
  }, [selected, childrenByParent]);

  const options: SubjectOption[] = allSubjects.map((s) => ({
    id: s.id,
    name: s.name,
    depth: s.depth,
    disabled: blocked.has(s.id),
  }));

  function submitMove() {
    const ids = [...selected];
    start(async () => {
      const res = await moveSubjects({ ids, parentId: target });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { moved, skipped } = res.data;
      if (moved > 0) {
        toast.success(
          `Moved ${moved} folder${moved === 1 ? "" : "s"}${
            skipped.length ? `, skipped ${skipped.length}` : ""
          }.`,
        );
      }
      if (skipped.length) {
        toast.message(`Skipped: ${skipped.join("; ")}`);
      }
      setMoveOpen(false);
      exitSelect();
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {selecting ? (
          <button
            type="button"
            onClick={exitSelect}
            className="text-muted-foreground hover:text-foreground text-xs font-medium transition"
          >
            Cancel
          </button>
        ) : (
          subjects.length > 1 && (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className="text-ink hover:text-ink/80 text-xs font-medium transition"
            >
              Select
            </button>
          )
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {subjects.map((s) => {
          const empty = s.cardCount === 0;
          const isSelected = selected.has(s.id);
          const inner = (
            <>
              <DividerTab color={s.color} icon={s.icon} />
              <span
                className={cn(
                  "font-display leading-tight font-semibold",
                  empty && !selecting && "text-muted-foreground",
                )}
              >
                {s.name}
              </span>
              {empty ? (
                <span
                  className={cn(
                    "text-xs font-medium",
                    selecting ? "text-muted-foreground" : "text-ink",
                  )}
                >
                  {selecting ? "empty folder" : "Add your first card →"}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {s.cardCount} {s.cardCount === 1 ? "card" : "cards"}
                </span>
              )}
              {selecting && (
                <span
                  className={cn(
                    "absolute top-2 right-2 grid size-5 place-items-center rounded-full border transition",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-rule bg-card",
                  )}
                >
                  {isSelected && <Check className="size-3" />}
                </span>
              )}
            </>
          );

          const boxClass = cn(
            "border-rule bg-card relative flex h-full flex-col justify-end gap-0.5 rounded-xl border px-3.5 pt-7 pb-3.5 text-left transition",
            empty && "border-dashed",
            selecting && isSelected && "border-primary ring-2 ring-[var(--color-ring)]",
            selecting && !isSelected && "hover:border-foreground/30",
            !selecting && "hover:-translate-y-0.5 hover:border-[var(--tab)] hover:shadow-sm",
          );

          return (
            <li key={s.id}>
              {selecting ? (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(s.id)}
                  style={{ "--tab": s.color } as React.CSSProperties}
                  className={cn(boxClass, "w-full")}
                >
                  {inner}
                </button>
              ) : (
                <Link
                  href={`/subjects/${s.id}`}
                  style={{ "--tab": s.color } as React.CSSProperties}
                  className={boxClass}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {/* sticky action bar — sits just above the bottom tab bar */}
      {selecting && selected.size > 0 && (
        <div
          className="border-rule bg-background/95 fixed inset-x-0 z-20 border-t backdrop-blur-md"
          style={{
            bottom:
              "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium tabular-nums">
              {selected.size} folder{selected.size === 1 ? "" : "s"} selected
            </span>
            <Button size="sm" onClick={() => setMoveOpen(true)}>
              <FolderInput className="size-4" /> Move to…
            </Button>
          </div>
        </div>
      )}

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move {selected.size} folder{selected.size === 1 ? "" : "s"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <SubjectSelect
              options={options}
              value={target}
              onChange={setTarget}
              allowTopLevel
              placeholder="Choose a destination…"
            />
            <p className="text-muted-foreground text-xs">
              Everything nested inside each folder moves with it.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setMoveOpen(false)}>
              <X className="size-4" /> Cancel
            </Button>
            <Button size="sm" onClick={submitMove} disabled={pending}>
              {pending ? "Moving…" : "Move here"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
