import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImportReview } from "@/components/import-review";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { listSubjects } from "@/lib/queries/subjects";

export const metadata: Metadata = { title: "Review import" };

export default async function ImportReviewPage(
  props: PageProps<"/import/[importId]">,
) {
  const { importId } = await props.params;
  const { supabase } = await requireUser();

  const { data: imp } = await supabase
    .from("imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();
  if (!imp) notFound();

  if (imp.status === "saved") {
    return (
      <Shell title="Import saved">
        <p className="text-muted-foreground text-sm">
          These cards are already in your deck.
        </p>
        <Button asChild size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </Shell>
    );
  }

  if (imp.status === "error") {
    return (
      <Shell title="Import failed">
        <p className="text-destructive text-sm">
          {imp.error ?? "Something went wrong."}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/import">Try another file</Link>
        </Button>
      </Shell>
    );
  }

  if (imp.status !== "ready") {
    return (
      <Shell title="Still processing">
        <p className="text-muted-foreground text-sm">
          This import is still being read. Go back to the tab that started it, or
          try again.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </Shell>
    );
  }

  const [{ data: cards }, subjects] = await Promise.all([
    supabase
      .from("import_cards")
      .select("*")
      .eq("import_id", importId)
      .order("position", { ascending: true }),
    listSubjects(),
  ]);

  const isResort = imp.kind === "resort";

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">
        {isResort ? "Re-sort your subjects" : "Review draft cards"}
      </h1>
      <ImportReview
        importId={importId}
        cards={cards ?? []}
        subjects={subjects}
        notes={imp.notes}
        truncated={imp.truncated}
        mode={isResort ? "resort" : "import"}
      />
    </main>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}
