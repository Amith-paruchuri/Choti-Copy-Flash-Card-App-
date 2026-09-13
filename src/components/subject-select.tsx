"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Subject } from "@/types/database";

export interface SubjectOption {
  id: string;
  name: string;
  /** 1-based depth, for indentation. */
  depth: number;
  disabled?: boolean;
}

/** DFS-ordered, depth-tagged options from a flat subject list. */
export function subjectOptionsFromFlat(subjects: Subject[]): SubjectOption[] {
  const byParent = new Map<string | null, Subject[]>();
  for (const s of subjects) {
    const key = s.parent_id;
    byParent.set(key, [...(byParent.get(key) ?? []), s]);
  }
  const out: SubjectOption[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const s of (byParent.get(parent) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      out.push({ id: s.id, name: s.name, depth });
      walk(s.id, depth + 1);
    }
  };
  walk(null, 1);
  return out;
}

const TOP = "__top__";

/** Indented folder picker. `value === null` means top level. */
export function SubjectSelect({
  options,
  value,
  onChange,
  allowTopLevel = false,
  placeholder = "Choose a folder…",
}: {
  options: SubjectOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowTopLevel?: boolean;
  placeholder?: string;
}) {
  return (
    <Select
      value={value ?? (allowTopLevel ? TOP : "")}
      onValueChange={(v) => onChange(v === TOP ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowTopLevel && <SelectItem value={TOP}>Top level</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id} disabled={o.disabled}>
            <span style={{ paddingLeft: `${(o.depth - 1) * 14}px` }}>
              {o.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
