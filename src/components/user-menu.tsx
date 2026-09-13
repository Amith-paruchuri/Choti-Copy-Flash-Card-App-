"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bug, CircleUser, LineChart, LogOut, User } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  email,
  name,
}: {
  email: string | null;
  name: string | null;
}) {
  const [, startSignOut] = useTransition();
  const label = name || email || "Account";
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Account menu"
          className="rounded-full"
        >
          <span className="bg-ink-tint text-ink grid size-7 place-items-center rounded-full text-xs font-semibold">
            {initial || <CircleUser className="size-4" />}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/stats">
            <LineChart className="size-4" /> Progress
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/leeches">
            <Bug className="size-4" /> Leeches
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User className="size-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => {
            e.preventDefault();
            startSignOut(() => signOut());
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
