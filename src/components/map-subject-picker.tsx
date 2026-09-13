"use client";

import { useRouter } from "next/navigation";

import type { PickerSubject } from "@/lib/queries/subjects";

/** Narrow the account-wide concept map to one subject subtree. */
export function MapSubjectPicker({
  subjects,
  value,
}: {
  subjects: PickerSubject[];
  value: string | null;
}) {
  const router = useRouter();
  return (
    <select
      value={value ?? ""}
      onChange={(e) =>
        router.push(e.target.value ? `/map?subject=${e.target.value}` : "/map")
      }
      className="border-rule bg-card rounded-md border px-2 py-1 text-xs"
    >
      <option value="">All subjects</option>
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {" ".repeat((s.depth - 1) * 2)}
          {s.name}
        </option>
      ))}
    </select>
  );
}
