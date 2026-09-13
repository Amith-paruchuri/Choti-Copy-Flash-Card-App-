import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * A small "what does this mean?" affordance — tap the icon for a plain-
 * language explanation. Popover (not a hover-only tooltip) so it works the
 * same on touch and desktop.
 */
export function InfoTip({
  label = "What does this mean?",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={label}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-4 flex-none items-center justify-center rounded-full align-middle transition outline-none focus-visible:ring-2"
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="space-y-1.5 text-left leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
