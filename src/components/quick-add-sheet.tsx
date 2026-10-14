"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";

import { FlashcardForm } from "@/components/flashcard-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { SPRING_SNAPPY } from "@/lib/motion";
import type { Subject } from "@/types/database";

/** Screens where a floating add button would get in the way. */
const HIDE_ON = ["/review/session", "/cards/new", "/quiz", "/import", "/billing", "/stats", "/account", "/map"];

/**
 * Floating "+" that opens the card form as a bottom sheet, so a missed
 * question can be saved without leaving the page you're on.
 */
export function QuickAddSheet({ subjects }: { subjects: Subject[] }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);

  // Saving redirects to the subject page: close the sheet when the route changes.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));
  const defaultSubjectId = pathname.startsWith("/subjects/")
    ? pathname.split("/")[2]
    : undefined;

  return (
    <>
      <AnimatePresence>
        {!hidden && (
          <motion.button
            type="button"
            aria-label="Add flashcard"
            onClick={() => setOpen(true)}
            initial={reduce ? false : { scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={reduce ? undefined : { scale: 0 }}
            transition={SPRING_SNAPPY}
            whileTap={reduce ? undefined : { scale: 0.9 }}
            className="bg-primary text-primary-foreground fixed right-4 z-30 grid size-14 touch-manipulation place-items-center rounded-full shadow-[0_10px_30px_-8px_var(--color-primary)] [-webkit-tap-highlight-color:transparent]"
            style={{
              bottom:
                "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 1rem)",
            }}
          >
            <Plus className="size-6" strokeWidth={2.6} aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-auto bottom-0 left-0 max-h-[90dvh] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-3xl rounded-b-none p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] data-open:slide-in-from-bottom-16 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        >
          <span
            aria-hidden
            className="bg-rule mx-auto -mt-1 mb-1 block h-1 w-10 rounded-full sm:hidden"
          />
          <DialogTitle className="font-display text-lg font-semibold">
            Add a flashcard
          </DialogTitle>
          <DialogDescription className="sr-only">
            Save a concept or question you got wrong.
          </DialogDescription>
          <FlashcardForm
            subjects={subjects}
            defaultSubjectId={defaultSubjectId}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
