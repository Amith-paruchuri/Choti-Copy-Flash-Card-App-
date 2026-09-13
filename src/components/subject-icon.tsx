import {
  Atom,
  BookText,
  Brain,
  Code2,
  Dna,
  FlaskConical,
  Gavel,
  Globe2,
  HeartPulse,
  Landmark,
  Languages,
  Leaf,
  Music3,
  Palette,
  Scale,
  Sigma,
  type LucideIcon,
} from "lucide-react";

import type { SubjectIconKey } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";

export const ICON_MAP: Record<SubjectIconKey, LucideIcon> = {
  book: BookText,
  dna: Dna,
  flask: FlaskConical,
  atom: Atom,
  sigma: Sigma,
  brain: Brain,
  pulse: HeartPulse,
  leaf: Leaf,
  globe: Globe2,
  landmark: Landmark,
  gavel: Gavel,
  scale: Scale,
  languages: Languages,
  palette: Palette,
  code: Code2,
  music: Music3,
};

export function SubjectIcon({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  const Cmp = ICON_MAP[(icon ?? "book") as SubjectIconKey] ?? BookText;
  return <Cmp className={cn("size-4", className)} aria-hidden />;
}
