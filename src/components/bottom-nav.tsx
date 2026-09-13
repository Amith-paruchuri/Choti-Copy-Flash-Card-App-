"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Layers, LineChart, ListChecks, CircleUser } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** match only this exact path (used for Home so it isn't "always on") */
  exact?: boolean;
};

const TABS: Tab[] = [
  { href: "/dashboard", label: "Home", icon: House, exact: true },
  { href: "/review", label: "Cards", icon: Layers },
  { href: "/quiz", label: "Test", icon: ListChecks },
  { href: "/stats", label: "Progress", icon: LineChart },
  { href: "/account", label: "Profile", icon: CircleUser },
];

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

/**
 * Persistent bottom tab bar for every authed screen (rendered from the
 * `(app)` layout, so it never shows on /login or the legal pages).
 * Fixed to the viewport bottom at every width; the `(app)` layout reserves
 * `--bottom-nav-h` of padding underneath page content so nothing hides.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="border-rule bg-background/85 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[11px] font-medium tracking-tight transition-colors",
                  active
                    ? "text-ink"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* turmeric highlighter tab on the active item */}
                <span
                  className={cn(
                    "bg-highlight absolute top-0 h-0.5 w-8 rounded-full transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "grid place-items-center rounded-lg px-3 py-0.5 transition-colors",
                    active && "bg-ink-tint",
                  )}
                >
                  <Icon
                    className="size-5"
                    strokeWidth={active ? 2.4 : 2}
                    aria-hidden
                  />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
