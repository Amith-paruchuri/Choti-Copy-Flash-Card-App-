"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { createFlashcard } from "@/actions/flashcards";
import type { ActionResult } from "@/actions/types";
import { CardImageInput } from "@/components/card-image-input";
import { SubjectPicker } from "@/components/subject-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

const START: ActionResult<null> | null = null;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Save flashcard"}
    </Button>
  );
}

export function FlashcardForm({
  subjects,
  defaultSubjectId,
}: {
  subjects: Subject[];
  defaultSubjectId?: string;
}) {
  const [state, formAction] = useActionState(createFlashcard, START);
  const [sourceType, setSourceType] = useState<"typed" | "pasted">("typed");
  const [content, setContent] = useState("");
  const [imageAlts, setImageAlts] = useState<string[]>([]);
  const [showHeader, setShowHeader] = useState(false);
  const [condensing, setCondensing] = useState(false);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  async function condense() {
    if (content.trim().length < 20) {
      toast.error("Write a bit more first, then condense.");
      return;
    }
    setCondensing(true);
    try {
      const res = await fetch("/api/ai/condense", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const data = (await res.json()) as { draft?: string; error?: string };
      if (!res.ok || !data.draft) {
        toast.error(data.error ?? "Couldn't condense that.");
        return;
      }
      setContent(data.draft);
      setSourceType("pasted");
      toast.success("Condensed — edit as needed before saving.");
    } catch {
      toast.error("Couldn't reach the AI service.");
    } finally {
      setCondensing(false);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">Flashcard</Label>
          <button
            type="button"
            onClick={condense}
            disabled={condensing}
            className="text-ink inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium transition disabled:opacity-50"
          >
            <Sparkles className="text-highlight size-3.5" />
            {condensing ? "Condensing…" : "Condense with AI"}
          </button>
        </div>
        <Textarea
          id="content"
          name="content"
          rows={6}
          maxLength={4000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="The concept, fact, or mistake you want to remember… (or leave blank and add an image)"
          onPaste={() => setSourceType("pasted")}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Images</Label>
        <p className="text-muted-foreground text-xs">
          For diagrams and pathways where the picture is the point. We’ll add a
          short description so the card still turns up in search.
        </p>
        <CardImageInput
          cardContext={() => content}
          onImagesChange={(images) =>
            setImageAlts(images.map((i) => i.alt))
          }
        />
      </div>

      <input type="hidden" name="sourceType" value={sourceType} />
      <div className="flex items-center gap-1.5">
        <span className="border-rule bg-secondary inline-flex rounded-md border p-0.5">
          {(["typed", "pasted"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSourceType(t)}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-xs capitalize transition",
                sourceType === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => setShowHeader((v) => !v)}
          className="text-muted-foreground hover:text-foreground ml-auto text-xs underline-offset-2 transition hover:underline"
        >
          {showHeader ? "Remove header" : "Add a header"}
        </button>
      </div>

      {showHeader && (
        <div className="space-y-2">
          <Input
            name="title"
            placeholder="Short title (optional)"
            maxLength={120}
          />
          <Input
            name="subtitle"
            placeholder="One-line summary (optional)"
            maxLength={300}
          />
        </div>
      )}

      <SubjectPicker
        subjects={subjects}
        defaultSubjectId={defaultSubjectId}
        getSuggestionContext={() => ({
          content,
          imageContext: imageAlts.filter(Boolean).join("\n"),
        })}
      />

      <SaveButton />
    </form>
  );
}
