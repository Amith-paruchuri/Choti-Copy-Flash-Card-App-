import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-[19rem] w-full rounded-xl sm:h-[22rem]" />
      </div>
    </main>
  );
}
