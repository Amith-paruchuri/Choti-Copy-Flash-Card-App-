import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Renders a parsed causal chain as connected boxes. Responds to its CONTAINER
 * width (not the viewport): vertical with ↓ arrows when the space is narrow —
 * e.g. inside the deck card — so you follow the chain without side-scrolling;
 * horizontal with → arrows, wrapping, when there's room (list view on desktop).
 * Wrap the caller in a `@container` element.
 */
export function MechanismFlow({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-col items-center gap-1 @md:flex-row @md:flex-wrap @md:items-stretch @md:gap-0">
      {steps.map((step, i) => {
        const first = i === 0;
        const last = i === steps.length - 1;
        return (
          <Fragment key={i}>
            <div
              className={cn(
                "max-w-full rounded-md border px-2.5 py-1.5 text-center text-xs leading-snug",
                first && "border-ink/30 bg-ink-tint",
                last && "border-highlight/50 bg-highlight-tint",
                !first && !last && "border-rule bg-secondary",
              )}
            >
              {step}
            </div>
            {!last && (
              <span
                aria-hidden
                className="text-muted-foreground flex items-center justify-center py-0.5 @md:px-1 @md:py-0"
              >
                <ChevronDown className="size-4 @md:hidden" />
                <ChevronRight className="hidden size-4 @md:block" />
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
