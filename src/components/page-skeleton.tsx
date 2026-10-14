import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-matched loading placeholder used by route `loading.tsx` files, so a
 * slow navigation shows the page's layout instead of a blank screen.
 */
export function PageSkeleton({
  variant = "list",
}: {
  variant?: "list" | "form" | "grid";
}) {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {variant === "grid" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      {variant === "form" && (
        <div className="space-y-5">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      )}
      {variant === "list" && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}
    </main>
  );
}
