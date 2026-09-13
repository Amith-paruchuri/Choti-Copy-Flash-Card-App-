"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { commitImport, discardImport } from "@/actions/imports";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubjectIcon } from "@/components/subject-icon";
import { SUBJECT_COLORS } from "@/lib/validation";
import { guessSubjectIcon } from "@/lib/subject-icons";
import { parsePathText, pathText } from "@/lib/subjects/path";
import { cn } from "@/lib/utils";
import type { ImportCard, Subject } from "@/types/database";

interface Draft {
  id: string;
  /** Set when this row is an existing flashcard being re-filed, not a new draft. */
  flashcardId: string | null;
  title: string;
  subtitle: string;
  content: string;
  kept: boolean;
  groupId: string;
}

interface Group {
  id: string;
  /** An existing subject the user picked. Otherwise `path` is resolved. */
  existingId: string | null;
  path: string[];
  color: string;
}

const NEW_GROUP = "__new_group__";
const AS_PATH = "__path__";

function color(i: number) {
  return SUBJECT_COLORS[i % SUBJECT_COLORS.length];
}

function buildInitial(cards: ImportCard[]) {
  const groups: Group[] = [];
  const byKey = new Map<string, string>();

  const groupFor = (card: ImportCard): string => {
    const path =
      card.suggested_path?.length > 0
        ? card.suggested_path
        : [card.suggested_subject || "Imported"];
    const key = pathText(path).toLowerCase();
    const seen = byKey.get(key);
    if (seen) return seen;

    const id = `g${groups.length}`;
    groups.push({ id, existingId: null, path, color: color(groups.length) });
    byKey.set(key, id);
    return id;
  };

  const drafts: Draft[] = cards.map((c) => ({
    id: c.id,
    flashcardId: c.flashcard_id,
    title: c.title,
    subtitle: c.subtitle,
    content: c.content,
    kept: true,
    groupId: groupFor(c),
  }));

  return { groups, drafts };
}

export function ImportReview({
  importId,
  cards,
  subjects,
  notes,
  truncated,
  mode = "import",
}: {
  importId: string;
  cards: ImportCard[];
  subjects: Subject[];
  notes: string | null;
  truncated: boolean;
  /** "resort" re-files existing cards; "import" creates new ones. */
  mode?: "import" | "resort";
}) {
  const isResort = mode === "resort";
  const initial = useMemo(() => buildInitial(cards), [cards]);
  const [groups, setGroups] = useState<Group[]>(initial.groups);
  const [drafts, setDrafts] = useState<Draft[]>(initial.drafts);
  const [saving, startSave] = useTransition();
  const [discarding, startDiscard] = useTransition();

  const keptCount = drafts.filter((d) => d.kept).length;
  const usedGroups = groups.filter((g) =>
    drafts.some((d) => d.groupId === g.id),
  );

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  function patchDraft(id: string, next: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...next } : d)));
  }
  function patchGroup(id: string, next: Partial<Group>) {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...next } : g)));
  }

  function moveCard(cardId: string, target: string) {
    if (target === NEW_GROUP) {
      const id = `g${groups.length}-${Date.now() % 1000}`;
      setGroups((gs) => [
        ...gs,
        { id, existingId: null, path: ["New subject"], color: color(gs.length) },
      ]);
      patchDraft(cardId, { groupId: id });
      return;
    }
    patchDraft(cardId, { groupId: target });
  }

  function save() {
    const payload = usedGroups
      .map((g) => ({
        existingId: g.existingId,
        path: g.existingId ? [] : g.path,
        color: g.color,
        cards: drafts
          .filter((d) => d.groupId === g.id && d.kept)
          .map((d) => ({
            flashcardId: d.flashcardId,
            // On a re-sort a blank title means "keep the card's own"; a new
            // import card always needs one.
            title: isResort
              ? d.title.trim()
              : d.title.trim() || "Untitled card",
            subtitle: d.subtitle.trim(),
            content: d.content.trim(),
          })),
      }))
      .filter((g) => g.cards.length > 0);

    if (payload.length === 0) {
      toast.error("Keep at least one card, or discard the import.");
      return;
    }
    if (payload.some((g) => !g.existingId && g.path.length === 0)) {
      toast.error("Every group needs a subject or path.");
      return;
    }

    startSave(async () => {
      const res = await commitImport({ importId, groups: payload });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {(notes || truncated) && (
        <p className="border-rule bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs">
          {notes}
          {truncated && !notes
            ? isResort
              ? "Some cards were left out to stay within limits — run the re-sort again to catch the rest."
              : "This import hit its card limit before the end of the material — import the rest as a new file to keep going."
            : ""}
        </p>
      )}

      <p className="text-muted-foreground text-sm">
        {isResort
          ? "Your existing cards, grouped by where the AI thinks they belong. Edit a path (segments separated by "
          : "Grouped by the AI’s suggested subject path. Edit a path (segments separated by "}
        <span className="font-mono">›</span>
        {isResort
          ? "), pick an existing subject, or move cards between groups. Skipped cards stay where they are."
          : "), pick an existing subject, or move cards between groups."}
      </p>

      <div className="space-y-6">
        {usedGroups.map((g) => {
          const groupCards = drafts.filter((d) => d.groupId === g.id);
          const existing = g.existingId
            ? subjectById.get(g.existingId)
            : undefined;
          return (
            <section
              key={g.id}
              className="border-rule overflow-hidden rounded-xl border"
            >
              <header className="bg-secondary space-y-2 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="grid size-6 flex-none place-items-center rounded-md text-white"
                    style={{ backgroundColor: existing?.color ?? g.color }}
                  >
                    <SubjectIcon
                      icon={
                        existing?.icon ??
                        guessSubjectIcon(g.path[g.path.length - 1] ?? "")
                      }
                      className="size-3.5"
                    />
                  </span>

                  {existing ? (
                    <span className="text-sm font-medium">{existing.name}</span>
                  ) : (
                    <Input
                      value={pathText(g.path)}
                      onChange={(e) =>
                        patchGroup(g.id, {
                          path: parsePathText(e.target.value),
                          existingId: null,
                        })
                      }
                      onBlur={(e) =>
                        patchGroup(g.id, { path: parsePathText(e.target.value) })
                      }
                      placeholder="Nephrology › Renal tubulopathies"
                      className="h-8 flex-1"
                    />
                  )}

                  <span className="ml-auto flex items-center gap-2 text-xs">
                    {!existing && (
                      <span className="bg-ink-tint text-ink rounded-full px-1.5 py-0.5 font-medium">
                        {g.path.length === 1 ? "new" : `${g.path.length} levels`}
                      </span>
                    )}
                    <span className="text-muted-foreground tabular-nums">
                      {groupCards.filter((c) => c.kept).length}
                    </span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={g.existingId ?? AS_PATH}
                    onValueChange={(v) =>
                      patchGroup(g.id, {
                        existingId: v === AS_PATH ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-52 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AS_PATH}>Create from path…</SelectItem>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!existing && (
                    <div className="flex flex-wrap gap-1.5">
                      {SUBJECT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Colour ${c}`}
                          onClick={() => patchGroup(g.id, { color: c })}
                          className={cn(
                            "size-5 rounded-full transition",
                            g.color === c &&
                              "ring-foreground scale-110 ring-2 ring-offset-1",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </header>

              <div className="divide-border divide-y">
                {groupCards.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      "space-y-2 p-4",
                      !d.kept && "bg-muted/30 opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={d.title}
                        onChange={(e) =>
                          patchDraft(d.id, { title: e.target.value })
                        }
                        disabled={!d.kept}
                        placeholder="Title"
                        className="h-8 border-0 px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => patchDraft(d.id, { kept: !d.kept })}
                      >
                        {d.kept ? (isResort ? "Skip" : "Remove") : "Keep"}
                      </Button>
                    </div>
                    <Input
                      value={d.subtitle}
                      onChange={(e) =>
                        patchDraft(d.id, { subtitle: e.target.value })
                      }
                      disabled={!d.kept}
                      placeholder="One-line summary"
                      className="text-muted-foreground h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                    />
                    <Textarea
                      value={d.content}
                      onChange={(e) =>
                        patchDraft(d.id, { content: e.target.value })
                      }
                      disabled={!d.kept}
                      rows={3}
                      maxLength={4000}
                      className="text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground text-xs">
                        Move to
                      </Label>
                      <Select
                        value={d.groupId}
                        onValueChange={(v) => moveCard(d.id, v)}
                      >
                        <SelectTrigger className="h-7 w-48 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {usedGroups.map((gg) => (
                            <SelectItem key={gg.id} value={gg.id}>
                              {gg.existingId
                                ? (subjectById.get(gg.existingId)?.name ??
                                  "Subject")
                                : pathText(gg.path) || "Untitled"}
                            </SelectItem>
                          ))}
                          <SelectItem value={NEW_GROUP}>
                            ＋ New group…
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving} size="lg" className="flex-1">
          {saving
            ? "Saving…"
            : `${isResort ? "Re-file" : "Save"} ${keptCount} card${
                keptCount === 1 ? "" : "s"
              }`}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="lg" disabled={discarding}>
              {isResort ? "Cancel" : "Discard"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isResort ? "Cancel this re-sort?" : "Discard this import?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isResort
                  ? "Nothing moves — your cards stay in their current subjects. You can run the re-sort again later."
                  : "The uploaded file and all draft cards are deleted. This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  startDiscard(async () => {
                    const res = await discardImport(importId);
                    if (!res.ok) toast.error(res.error);
                  })
                }
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
