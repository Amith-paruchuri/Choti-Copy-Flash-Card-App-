"use client";

import { ICON_MAP } from "@/components/subject-icon";
import { SUBJECT_COLORS } from "@/lib/validation";
import { SUBJECT_ICON_KEYS, type SubjectIconKey } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";

/** Colour swatches + icon grid, shared by the folder create / edit dialogs. */
export function SubjectAppearanceFields({
  color,
  icon,
  onColor,
  onIcon,
}: {
  color: string;
  icon: string;
  onColor: (c: string) => void;
  onIcon: (k: SubjectIconKey) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SUBJECT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            aria-pressed={color === c}
            onClick={() => onColor(c)}
            className={cn(
              "size-6 rounded-full transition",
              color === c && "ring-foreground scale-110 ring-2 ring-offset-1",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUBJECT_ICON_KEYS.map((k) => {
          const Cmp = ICON_MAP[k];
          const active = icon === k;
          return (
            <button
              key={k}
              type="button"
              aria-label={`Icon ${k}`}
              aria-pressed={active}
              onClick={() => onIcon(k)}
              className={cn(
                "grid size-8 place-items-center rounded-md border transition",
                active
                  ? "border-transparent text-white"
                  : "border-rule text-muted-foreground hover:text-foreground",
              )}
              style={active ? { backgroundColor: color } : undefined}
            >
              <Cmp className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
