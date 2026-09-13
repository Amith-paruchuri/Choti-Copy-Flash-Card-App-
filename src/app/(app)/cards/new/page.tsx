import type { Metadata } from "next";
import Link from "next/link";

import { FlashcardForm } from "@/components/flashcard-form";
import { listSubjects } from "@/lib/queries/subjects";

export const metadata: Metadata = { title: "Add flashcard" };

export default async function NewFlashcardPage(props: PageProps<"/cards/new">) {
  const sp = await props.searchParams;
  const defaultSubjectId =
    typeof sp.subject === "string" ? sp.subject : undefined;
  const subjects = await listSubjects();

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Add flashcard</h1>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm transition"
        >
          Cancel
        </Link>
      </div>
      <FlashcardForm subjects={subjects} defaultSubjectId={defaultSubjectId} />
    </main>
  );
}
