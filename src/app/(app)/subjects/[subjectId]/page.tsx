import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FolderDialog } from "@/components/folder-dialog";
import { SubjectBreadcrumb } from "@/components/subject-breadcrumb";
import { SubjectDeck } from "@/components/subject-deck";
import { SubjectGrid } from "@/components/subject-grid";
import { SubjectIcon } from "@/components/subject-icon";
import { SubjectManageMenu } from "@/components/subject-manage-menu";
import { Button } from "@/components/ui/button";
import { listFlashcards } from "@/lib/queries/flashcards";
import { getRelatedForCards } from "@/lib/queries/flashcard-links";
import { loadMemoryMap } from "@/lib/queries/review";
import type { CardMemory } from "@/lib/srs/fsrs";
import {
  getSubject,
  getSubjectAncestors,
  listChildSubjects,
  listSubjects,
  listSubjectsForPicker,
} from "@/lib/queries/subjects";

export async function generateMetadata(
  props: PageProps<"/subjects/[subjectId]">,
): Promise<Metadata> {
  const { subjectId } = await props.params;
  const subject = await getSubject(subjectId);
  return { title: subject?.name ?? "Subject" };
}

export default async function SubjectPage(
  props: PageProps<"/subjects/[subjectId]">,
) {
  const { subjectId } = await props.params;
  const sp = await props.searchParams;
  const initialCardId = typeof sp.card === "string" ? sp.card : undefined;

  const [subject, cards, subjects, trail, children, pickerSubjects, memoryMap] =
    await Promise.all([
      getSubject(subjectId),
      listFlashcards({ subjectId }),
      listSubjects(),
      getSubjectAncestors(subjectId),
      listChildSubjects(subjectId),
      listSubjectsForPicker(),
      loadMemoryMap(),
    ]);

  if (!subject) notFound();

  const relatedByCard = await getRelatedForCards(cards.map((c) => c.id));

  const memoryByCard: Record<string, CardMemory> = {};
  for (const c of cards) {
    const m = memoryMap.get(c.id);
    if (m) memoryByCard[c.id] = m;
  }

  const subtreeCount =
    cards.length + children.reduce((sum, c) => sum + c.cardCount, 0);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <div
        className="border-rule -mx-4 space-y-3 border-b px-4 pb-4"
        style={{
          background: `linear-gradient(to bottom, color-mix(in srgb, ${subject.color} 8%, transparent), transparent)`,
        }}
      >
        <SubjectBreadcrumb trail={trail} />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="grid size-9 flex-none place-items-center rounded-lg text-white"
              style={{ backgroundColor: subject.color }}
            >
              <SubjectIcon icon={subject.icon} className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{subject.name}</h1>
              <p className="text-muted-foreground text-xs tabular-nums">
                {cards.length} {cards.length === 1 ? "card" : "cards"}
                {children.length > 0 &&
                  ` · ${children.length} subtopic${children.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <div className="flex flex-none items-center gap-1.5">
            <FolderDialog mode="create" parentId={subject.id}>
              <Button size="sm" variant="outline">
                New subtopic
              </Button>
            </FolderDialog>
            <Button asChild size="sm">
              <Link href={`/cards/new?subject=${subject.id}`}>Add flashcard</Link>
            </Button>
            <SubjectManageMenu
              subject={subject}
              pickerSubjects={pickerSubjects}
              cardCount={cards.length}
              childCount={children.length}
            />
          </div>
        </div>
      </div>

      {subtreeCount > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/quiz?subjects=${subject.id}`}>
              Quiz{children.length > 0 ? " this branch" : ""}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/subjects/${subject.id}/map`}>Map</Link>
          </Button>
        </div>
      )}

      {children.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium">Subtopics</h2>
          <SubjectGrid subjects={children} />
        </section>
      )}

      {cards.length === 0 ? (
        <div className="border-rule text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          {children.length > 0
            ? "No cards directly here — open a subtopic above."
            : "No cards in this subject yet."}
        </div>
      ) : (
        <SubjectDeck
          cards={cards}
          subjects={subjects}
          initialCardId={initialCardId}
          memoryByCard={memoryByCard}
          relatedByCard={relatedByCard}
        />
      )}

      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground inline-block text-sm transition"
      >
        &larr; All subjects
      </Link>
    </main>
  );
}
