import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant paint while the dashboard's server queries resolve — without this,
 * a tab tap shows nothing until every Promise.all query on the page lands.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-9 px-4 py-8">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="flex gap-3 overflow-hidden">
        <Skeleton className="h-24 w-40 flex-none rounded-xl" />
        <Skeleton className="h-24 w-40 flex-none rounded-xl" />
        <Skeleton className="h-24 w-40 flex-none rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
