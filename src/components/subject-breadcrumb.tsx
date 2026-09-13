import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { Subject } from "@/types/database";

/** Root → current subject trail. The last crumb is the current page (not a link). */
export function SubjectBreadcrumb({ trail }: { trail: Subject[] }) {
  if (trail.length <= 1) return null;
  return (
    <nav
      aria-label="Subject path"
      className="text-muted-foreground flex flex-wrap items-center gap-0.5 text-xs"
    >
      <Link href="/dashboard" className="hover:text-foreground transition">
        All
      </Link>
      {trail.map((s, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={s.id} className="flex items-center gap-0.5">
            <ChevronRight className="size-3 opacity-60" />
            {last ? (
              <span className="text-foreground font-medium">{s.name}</span>
            ) : (
              <Link
                href={`/subjects/${s.id}`}
                className="hover:text-foreground transition"
              >
                {s.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
