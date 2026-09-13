import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConceptGraphView } from "@/components/concept-graph-view";
import { getConceptGraph } from "@/lib/queries/graph";
import { getSubject } from "@/lib/queries/subjects";

export async function generateMetadata(
  props: PageProps<"/subjects/[subjectId]/map">,
): Promise<Metadata> {
  const { subjectId } = await props.params;
  const subject = await getSubject(subjectId);
  return { title: subject ? `${subject.name} · Map` : "Map" };
}

export default async function SubjectMapPage(
  props: PageProps<"/subjects/[subjectId]/map">,
) {
  const { subjectId } = await props.params;
  const [subject, graph] = await Promise.all([
    getSubject(subjectId),
    getConceptGraph(subjectId),
  ]);
  if (!subject) notFound();

  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem-var(--bottom-nav-h))] w-full max-w-3xl flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/subjects/${subjectId}`}
            className="text-muted-foreground hover:text-foreground text-xs transition"
          >
            &larr; {subject.name}
          </Link>
          <h1 className="font-display text-lg font-semibold tracking-tight">
            Concept map
          </h1>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {graph.nodes.length} card{graph.nodes.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <ConceptGraphView graph={graph} />
      </div>
    </main>
  );
}
