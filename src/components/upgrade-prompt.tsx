import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Shown when a free/trial user hits a daily or weekly cap — says exactly
 * what Pro unlocks right then, links to /billing, and never blocks the rest
 * of the app (the caller decides what still renders alongside this).
 */
export function UpgradePrompt({ message }: { message: string }) {
  return (
    <div className="border-rule bg-highlight-tint/50 flex items-start gap-2.5 rounded-lg border p-3 text-sm">
      <Sparkles className="text-highlight mt-0.5 size-4 flex-none" />
      <div className="min-w-0 space-y-1">
        <p className="text-foreground">{message}</p>
        <Link
          href="/billing"
          className="text-ink inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2"
        >
          See Pro plans →
        </Link>
      </div>
    </div>
  );
}
