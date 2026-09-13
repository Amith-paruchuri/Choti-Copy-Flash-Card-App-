"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { suggestFlashcardSubject } from "@/actions/subjects";
import { ICON_MAP } from "@/components/subject-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBJECT_COLORS } from "@/lib/validation";
import { SUBJECT_ICON_KEYS, guessSubjectIcon } from "@/lib/subject-icons";
import { parsePathText, pathText } from "@/lib/subjects/path";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

const NEW = "__new__";
const AS_PATH = "__path__";

/**
 * Lets the user pick an existing subject, define a new one inline (name +
 * colour + icon), or accept an AI-suggested broad→specific path — same
 * `suggestPaths` AI method and reuse rules as the import/re-sort flows, just
 * aimed at one not-yet-saved card. Renders hidden inputs so the surrounding
 * <form> submits whichever mode is active.
 */
export function SubjectPicker({
  subjects,
  defaultSubjectId,
  getSuggestionContext,
}: {
  subjects: Subject[];
  defaultSubjectId?: string;
  /** Read at click-time (not reactive) — the card's current content plus any
   * image descriptions, for the "Suggest subject" action. */
  getSuggestionContext?: () => { content: string; imageContext: string };
}) {
  const fallbackValue = defaultSubjectId ?? (subjects.length ? subjects[0].id : NEW);
  const [value, setValue] = useState<string>(fallbackValue);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(SUBJECT_COLORS[0]);
  const [iconChoice, setIconChoice] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const isNew = value === NEW;
  const isPath = value === AS_PATH;

  // Follow the name with a guessed icon until the user picks one explicitly.
  const icon = iconChoice ?? guessSubjectIcon(name);

  async function suggest() {
    const ctx = getSuggestionContext?.();
    const hasContent = (ctx?.content.trim().length ?? 0) >= 10;
    const hasImage = Boolean(ctx?.imageContext.trim());
    if (!ctx || (!hasContent && !hasImage)) {
      toast.error("Write a bit more, or add an image, first.");
      return;
    }
    setSuggesting(true);
    try {
      const res = await suggestFlashcardSubject(ctx);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPath(res.data.path);
      setValue(AS_PATH);
      toast.success(
        `Suggested: ${pathText(res.data.path)} — edit or save as-is.`,
      );
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Subject</Label>
          <button
            type="button"
            onClick={suggest}
            disabled={suggesting}
            className="text-ink inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium transition disabled:opacity-50"
          >
            <Sparkles
              className={cn(
                "text-highlight size-3.5",
                suggesting && "animate-pulse",
              )}
            />
            {suggesting ? "Thinking…" : "Suggest subject"}
          </button>
        </div>

        {isPath ? (
          <div className="space-y-1.5">
            <Input
              value={pathText(path)}
              onChange={(e) => setPath(parsePathText(e.target.value))}
              placeholder="Nephrology › Renal tubulopathies"
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              Edit the path (segments separated by{" "}
              <span className="font-mono">›</span>) — each level is reused if
              it already exists, or created if not.{" "}
              <button
                type="button"
                onClick={() => setValue(fallbackValue)}
                className="text-ink underline underline-offset-2"
              >
                Back to subject list
              </button>
            </p>
            <input
              type="hidden"
              name="path"
              value={JSON.stringify(path)}
              readOnly
            />
          </div>
        ) : (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span
                    className="mr-2 inline-block size-2.5 rounded-full align-middle"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW}>＋ New subject…</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {isNew && (
        <div className="space-y-3">
          <Input
            name="newSubjectName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New subject name"
            maxLength={80}
            autoFocus
            required
          />
          <input type="hidden" name="newSubjectColor" value={color} />
          <input type="hidden" name="newSubjectIcon" value={icon} />

          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  "size-6 rounded-full transition",
                  color === c
                    ? "ring-foreground scale-110 ring-2 ring-offset-1"
                    : "",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SUBJECT_ICON_KEYS.map((k) => {
              const Cmp = ICON_MAP[k];
              const active = icon === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-label={`Icon ${k}`}
                  aria-pressed={active}
                  onClick={() => setIconChoice(k)}
                  className={cn(
                    "grid size-8 place-items-center rounded-md border transition",
                    active
                      ? "border-transparent text-white"
                      : "border-rule text-muted-foreground hover:text-foreground",
                  )}
                  style={active ? { backgroundColor: color } : undefined}
                >
                  <Cmp className="size-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isNew && !isPath && (
        <input type="hidden" name="subjectId" value={value} />
      )}
    </div>
  );
}
