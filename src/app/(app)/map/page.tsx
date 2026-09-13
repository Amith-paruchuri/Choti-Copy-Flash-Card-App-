import type { Metadata } from "next";
import Link from "next/link";

import { ConceptGraphView } from "@/components/concept-graph-view";
import { MapSubjectPicker } from "@/components/map-subject-picker";
import { getConceptGraph } from "@/lib/queries/graph";
import { getSubject, listSubjectsForPicker } from "@/lib/queries/subjects";

export const metadata: Metadata = { title: "Concept map" };

export default async function MapPage(props: PageProps<"/map">) {
  const sp = await props.searchParams;
  const subjectId = typeof sp.subject === "string" ? sp.subject : undefined;

  const [graph, subjects, subject] = await Promise.all([
    getConceptGraph(subjectId),
    listSubjectsForPicker(),
    subjectId ? getSubject(subjectId) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem-var(--bottom-nav-h))] w-full max-w-3xl flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/stats"
            className="text-muted-foreground hover:text-foreground text-xs transition"
          >
            &larr; Progress
          </Link>
          <h1 className="font-display text-lg font-semibold tracking-tight">
            Concept map
          </h1>
        </div>
        <MapSubjectPicker
          subjects={subjects}
          value={subject?.id ?? null}
        />
      </div>

      <div className="min-h-0 flex-1">
        <ConceptGraphView graph={graph} />
      </div>
    </main>
  );
}
