"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { softDeleteFlashcard, updateFlashcard } from "@/actions/flashcards";
import { CardImageInput } from "@/components/card-image-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoveCardsDialog } from "@/components/move-cards-dialog";
import { cn } from "@/lib/utils";
import type { FlashcardWithSubject } from "@/lib/queries/flashcards";
import type { Subject } from "@/types/database";

/** Shared Edit + Delete controls for a flashcard (used by list and deck views). */
export function FlashcardActions({
  card,
  subjects,
  className,
}: {
  card: FlashcardWithSubject;
  subjects: Subject[];
  className?: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const initialImages = card.images.map((img, i) => ({
    path: img.path,
    hash: img.hash,
    mime: img.mime,
    alt: img.alt ?? "",
    previewUrl: card.imageUrls[i] ?? "",
  }));

  function onSave(formData: FormData) {
    startSave(async () => {
      const res = await updateFlashcard(null, formData);
      if (res.ok) {
        toast.success("Flashcard updated.");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete() {
    const fd = new FormData();
    fd.set("id", card.id);
    startDelete(async () => {
      const res = await softDeleteFlashcard(fd);
      if (res.ok) {
        toast.success("Flashcard removed.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <span className={cn("flex items-center gap-1", className)}>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="xs">
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit flashcard</DialogTitle>
          </DialogHeader>
          <form action={onSave} className="space-y-4">
            <input type="hidden" name="id" value={card.id} />
            <div className="space-y-1.5">
              <Label htmlFor={`title-${card.id}`}>Header (optional)</Label>
              <Input
                id={`title-${card.id}`}
                name="title"
                defaultValue={card.title ?? ""}
                placeholder="Short title"
                maxLength={120}
              />
              <Input
                name="subtitle"
                defaultValue={card.subtitle ?? ""}
                placeholder="One-line summary"
                maxLength={300}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`content-${card.id}`}>Flashcard</Label>
              <Textarea
                ref={contentRef}
                id={`content-${card.id}`}
                name="content"
                defaultValue={card.content}
                rows={6}
                maxLength={4000}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Images</Label>
              <CardImageInput
                initial={initialImages}
                cardContext={() =>
                  contentRef.current?.value ?? card.content
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`subject-${card.id}`}>Subject</Label>
              <select
                id={`subject-${card.id}`}
                name="subjectId"
                defaultValue={card.subject_id}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Button
        variant="ghost"
        size="xs"
        onClick={() => setMoveOpen(true)}
      >
        Move
      </Button>
      <MoveCardsDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        cardIds={[card.id]}
        subjects={subjects}
        currentSubjectId={card.subject_id}
      />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="text-destructive"
            disabled={deleting}
          >
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this flashcard?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops showing up in reviews and quizzes. The row is kept in the
              database (soft delete).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}
