"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, FolderInput, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSubject, moveSubject } from "@/actions/subjects";
import { FolderDialog } from "@/components/folder-dialog";
import { SubjectSelect, type SubjectOption } from "@/components/subject-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { descendantIds } from "@/lib/subjects/tree-ops";
import type { PickerSubject } from "@/lib/queries/subjects";
import type { Subject } from "@/types/database";

export function SubjectManageMenu({
  subject,
  pickerSubjects,
  cardCount,
  childCount,
}: {
  subject: Subject;
  pickerSubjects: PickerSubject[];
  /** Cards directly in this folder (active). */
  cardCount: number;
  childCount: number;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openDialog = (set: (v: boolean) => void) => (e: Event) => {
    e.preventDefault();
    setMenuOpen(false);
    set(true);
  };

  // Valid destinations exclude this folder and everything under it.
  const flat = pickerSubjects.map((s) => ({
    id: s.id,
    name: s.name,
    parent_id: s.parentId,
  }));
  const blocked = useMemo(() => {
    const set = descendantIds(flat, subject.id);
    set.add(subject.id);
    return set;
  }, [flat, subject.id]);

  const destinations: SubjectOption[] = pickerSubjects
    .filter((s) => !blocked.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, depth: s.depth }));

  const isEmpty = cardCount === 0 && childCount === 0;

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Folder options">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={openDialog(setRenameOpen)}>
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openDialog(setMoveOpen)}>
            <FolderInput className="size-4" /> Move
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={openDialog(setDeleteOpen)}
          >
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FolderDialog
        mode="edit"
        subject={subject}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        subject={subject}
        destinations={destinations}
        onDone={() => router.refresh()}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        subject={subject}
        isEmpty={isEmpty}
        cardCount={cardCount}
        childCount={childCount}
        destinations={destinations}
        onDone={() => {
          router.refresh();
          router.push(
            subject.parent_id ? `/subjects/${subject.parent_id}` : "/dashboard",
          );
        }}
      />
    </>
  );
}

function MoveDialog({
  open,
  onOpenChange,
  subject,
  destinations,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subject: Subject;
  destinations: SubjectOption[];
  onDone: () => void;
}) {
  const [target, setTarget] = useState<string | null>(subject.parent_id);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await moveSubject({ id: subject.id, parentId: target });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Folder moved.");
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-6">Move “{subject.name}”</DialogTitle>
          <DialogDescription>
            Everything nested inside moves with it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Destination</Label>
          <SubjectSelect
            options={destinations}
            value={target}
            onChange={setTarget}
            allowTopLevel
            placeholder="Choose a destination…"
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Moving…" : "Move here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  subject,
  isEmpty,
  cardCount,
  childCount,
  destinations,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subject: Subject;
  isEmpty: boolean;
  cardCount: number;
  childCount: number;
  destinations: SubjectOption[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"cascade" | "reparent">("reparent");
  const [target, setTarget] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const contents = [
    cardCount > 0 && `${cardCount} card${cardCount === 1 ? "" : "s"}`,
    childCount > 0 && `${childCount} subfolder${childCount === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" and ");

  function submit() {
    if (!isEmpty && mode === "reparent" && !target) {
      toast.error("Choose where to move the contents.");
      return;
    }
    start(async () => {
      const res = await deleteSubject({
        id: subject.id,
        mode: isEmpty ? "cascade" : mode,
        targetId: target,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Folder deleted.");
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-6">Delete “{subject.name}”</DialogTitle>
          {isEmpty ? (
            <DialogDescription>
              This folder is empty. This can’t be undone.
            </DialogDescription>
          ) : (
            <DialogDescription>
              This folder holds {contents}. Choose what happens to it.
            </DialogDescription>
          )}
        </DialogHeader>

        {!isEmpty && (
          <div className="space-y-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="delete-mode"
                className="mt-0.5"
                checked={mode === "reparent"}
                onChange={() => setMode("reparent")}
              />
              <span>
                <span className="font-medium">Move the contents elsewhere</span>
                <span className="text-muted-foreground block text-xs">
                  Cards and subfolders move into another folder, then this one is
                  deleted.
                </span>
              </span>
            </label>

            {mode === "reparent" && (
              <div className="pl-6">
                <SubjectSelect
                  options={destinations}
                  value={target}
                  onChange={setTarget}
                  placeholder="Move contents into…"
                />
              </div>
            )}

            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="radio"
                name="delete-mode"
                className="mt-0.5"
                checked={mode === "cascade"}
                onChange={() => setMode("cascade")}
              />
              <span>
                <span className="text-destructive font-medium">
                  Delete everything inside
                </span>
                <span className="text-muted-foreground block text-xs">
                  {contents} will be permanently removed.
                </span>
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button
            variant={isEmpty || mode === "cascade" ? "destructive" : "default"}
            onClick={submit}
            disabled={pending}
          >
            {pending
              ? "Deleting…"
              : isEmpty || mode === "cascade"
                ? "Delete"
                : "Move contents & delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
