"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { moveFlashcards } from "@/actions/flashcards";
import {
  SubjectSelect,
  subjectOptionsFromFlat,
} from "@/components/subject-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Subject } from "@/types/database";

export function MoveCardsDialog({
  open,
  onOpenChange,
  cardIds,
  subjects,
  currentSubjectId,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardIds: string[];
  subjects: Subject[];
  currentSubjectId?: string;
  onMoved?: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const options = useMemo(() => {
    const all = subjectOptionsFromFlat(subjects);
    return currentSubjectId
      ? all.map((o) =>
          o.id === currentSubjectId ? { ...o, disabled: true } : o,
        )
      : all;
  }, [subjects, currentSubjectId]);

  const n = cardIds.length;

  function submit() {
    if (!target) {
      toast.error("Pick a folder.");
      return;
    }
    start(async () => {
      const res = await moveFlashcards({ ids: cardIds, subjectId: target });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Moved ${res.data.moved} card${res.data.moved === 1 ? "" : "s"}.`,
      );
      onOpenChange(false);
      setTarget(null);
      onMoved?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Move {n} card{n === 1 ? "" : "s"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Destination folder</Label>
          <SubjectSelect
            options={options}
            value={target}
            onChange={setTarget}
            placeholder="Choose a folder…"
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
