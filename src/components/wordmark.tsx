import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * The Choti Copy mark plus the name in the display face. `textClassName`
 * styles just the text (e.g. hide it on small screens); omit the text
 * entirely with `markOnly`.
 */
export function Wordmark({
  className,
  textClassName,
  markOnly = false,
}: {
  className?: string;
  textClassName?: string;
  markOnly?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-2 text-[1.05rem] font-bold tracking-tight",
        className,
      )}
    >
      <Logo className="h-6 w-7 flex-none" />
      {!markOnly && <span className={textClassName}>Choti&nbsp;Copy</span>}
    </span>
  );
}
