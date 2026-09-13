import Link from "next/link";

import { GlobalSearch } from "@/components/global-search";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";

export function AppHeader({
  email,
  name,
}: {
  email: string | null;
  name: string | null;
}) {
  return (
    <header className="border-rule bg-background/80 sticky top-0 z-20 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
        <Link
          href="/dashboard"
          aria-label="Choti Copy — dashboard"
          className="flex-none"
        >
          <Logo className="h-7 w-8" />
        </Link>

        <GlobalSearch />

        <div className="flex flex-none items-center">
          <UserMenu email={email} name={name} />
        </div>
      </div>
    </header>
  );
}
