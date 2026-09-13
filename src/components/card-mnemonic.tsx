"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Lightbulb, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  generateCardMnemonic,
  updateCardMnemonic,
} from "@/actions/mnemonic";
import { cn } from "@/lib/utils";

/**
 * The AI-generated memory device for a card — generate on demand, then it's
 * stored on the card (editable, regeneratable). Shows as a highlighter-marked
 * block once set.
 */
export function CardMnemonic({
  flashcardId,
  mnemonic: initial,
}: {
  flashcardId: string;
  mnemonic: string | null;
}) {
  const [mnemonic, setMnemonic] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  function generate() {
    start(async () => {
      const res = await generateCardMnemonic({ flashcardId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMnemonic(res.data.mnemonic);
      setDraft(res.data.mnemonic);
    });
  }

  function save() {
    start(async () => {
      const res = await updateCardMnemonic({ flashcardId, mnemonic: draft });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMnemonic(res.data.mnemonic);
      setEditing(false);
    });
  }

  if (!mnemonic && !editing) {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="text-highlight hover:text-highlight/80 mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition disabled:opacity-60"
      >
        <Sparkles className={cn("size-3.5", pending && "animate-pulse")} />
        {pending ? "Thinking of one…" : "Generate a mnemonic"}
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
        <Lightbulb className="size-3" /> Mnemonic
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={600}
            className="border-rule bg-card w-full resize-none rounded-md border p-2 text-sm"
          />
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="text-sage inline-flex items-center gap-1 font-medium disabled:opacity-60"
            >
              <Check className="size-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(mnemonic ?? "");
                setEditing(false);
              }}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="size-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed">
            <span className="mark-term">{mnemonic}</span>
          </p>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={generate}
              disabled={pending}
              className="hover:text-foreground inline-flex items-center gap-1 transition disabled:opacity-60"
            >
              <RefreshCw
                className={cn("size-3", pending && "animate-spin")}
              />
              {pending ? "Rewriting…" : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(mnemonic ?? "");
                setEditing(true);
              }}
              className="hover:text-foreground inline-flex items-center gap-1 transition"
            >
              <Pencil className="size-3" /> Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}
