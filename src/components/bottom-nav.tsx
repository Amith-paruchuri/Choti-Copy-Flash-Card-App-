"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { House, Layers, LineChart, ListChecks, CircleUser } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SPRING_SNAPPY } from "@/lib/motion";
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
  const reduce = useReducedMotion();

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
                  "relative flex touch-manipulation flex-col items-center gap-1 px-1 pt-2 pb-1.5 text-[11px] font-medium tracking-tight transition-colors active:scale-95 active:opacity-70 [-webkit-tap-highlight-color:transparent]",
                  active
                    ? "text-ink"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative grid place-items-center rounded-full px-4 py-1">
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      aria-hidden
                      className="bg-ink-tint absolute inset-0 rounded-full"
                      transition={reduce ? { duration: 0 } : SPRING_SNAPPY}
                    />
                  )}
                  <motion.span
                    className="relative grid place-items-center"
                    animate={
                      active && !reduce ? { y: [0, -3, 0] } : { y: 0 }
                    }
                    transition={{ duration: 0.32, ease: "easeOut" }}
                    key={active ? "on" : "off"}
                  >
                    <Icon
                      className="size-[22px]"
                      strokeWidth={active ? 2.4 : 2}
                      aria-hidden
                    />
                  </motion.span>
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
