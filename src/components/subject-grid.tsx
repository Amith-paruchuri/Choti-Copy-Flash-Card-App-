import Link from "next/link";

import { SubjectIcon } from "@/components/subject-icon";
import type { SubjectWithCount } from "@/lib/queries/subjects";
import { cn } from "@/lib/utils";

function DividerTab({ color, icon }: { color: string; icon: string | null }) {
  return (
    <span
      aria-hidden
      className="absolute -top-2.5 left-3.5 grid h-6 w-11 place-items-center rounded-[8px_8px_3px_3px] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
      style={{ backgroundColor: color }}
    >
      <SubjectIcon icon={icon} className="size-3.5" />
    </span>
  );
}

export function SubjectGrid({ subjects }: { subjects: SubjectWithCount[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {subjects.map((s) => {
        const empty = s.cardCount === 0;
        return (
          <li key={s.id}>
            <Link
              href={`/subjects/${s.id}`}
              style={{ "--tab": s.color } as React.CSSProperties}
              className={cn(
                "border-rule bg-card relative flex h-full flex-col justify-end gap-0.5 rounded-xl border px-3.5 pt-7 pb-3.5 transition",
                "hover:-translate-y-0.5 hover:border-[var(--tab)] hover:shadow-sm",
                empty && "border-dashed",
              )}
            >
              <DividerTab color={s.color} icon={s.icon} />
              <span
                className={cn(
                  "font-display leading-tight font-semibold",
                  empty && "text-muted-foreground",
                )}
              >
                {s.name}
              </span>
              {empty ? (
                <span className="text-ink text-xs font-medium">
                  Add your first card &rarr;
                </span>
              ) : (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {s.cardCount} {s.cardCount === 1 ? "card" : "cards"}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
