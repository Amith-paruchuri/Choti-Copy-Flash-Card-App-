"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createFolder, editSubject } from "@/actions/subjects";
import { SubjectAppearanceFields } from "@/components/subject-appearance-fields";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUBJECT_COLORS } from "@/lib/validation";
import { guessSubjectIcon, type SubjectIconKey } from "@/lib/subject-icons";
import type { Subject } from "@/types/database";

type Props = {
  /** Trigger element. Omit when driving `open` / `onOpenChange` yourself. */
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} & (
  | { mode: "create"; parentId?: string | null; subject?: never }
  | { mode: "edit"; subject: Pick<Subject, "id" | "name" | "color" | "icon">;
      parentId?: never }
);

export function FolderDialog({ children, open: openProp, onOpenChange, ...props }: Props) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => {
    setOpenState(o);
    onOpenChange?.(o);
  };
  const [pending, start] = useTransition();

  const editing = props.mode === "edit" ? props.subject : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? SUBJECT_COLORS[0]);
  const [iconChoice, setIconChoice] = useState<SubjectIconKey | null>(
    (editing?.icon as SubjectIconKey | null) ?? null,
  );
  const icon: SubjectIconKey = iconChoice ?? guessSubjectIcon(name);

  function reset() {
    setName(editing?.name ?? "");
    setColor(editing?.color ?? SUBJECT_COLORS[0]);
    setIconChoice((editing?.icon as SubjectIconKey | null) ?? null);
  }

  function submit() {
    if (name.trim().length === 0) {
      toast.error("Give the folder a name.");
      return;
    }
    start(async () => {
      const res =
        props.mode === "create"
          ? await createFolder({
              name: name.trim(),
              color,
              icon,
              parentId: props.parentId ?? null,
            })
          : await editSubject({
              id: props.subject.id,
              name: name.trim(),
              color,
              icon,
            });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(props.mode === "create" ? "Folder created." : "Folder updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create"
              ? props.parentId
                ? "New subfolder"
                : "New folder"
              : "Rename folder"}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nephrology"
              maxLength={80}
              autoFocus
            />
          </div>

          <SubjectAppearanceFields
            color={color}
            icon={icon}
            onColor={setColor}
            onIcon={setIconChoice}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : props.mode === "create"
                  ? "Create folder"
                  : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
