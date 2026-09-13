import Link from "next/link";

import { Wordmark } from "@/components/wordmark";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-rule border-b">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5">
          <Link href="/" aria-label="Choti Copy home">
            <Wordmark />
          </Link>
          <nav className="text-muted-foreground flex gap-4 text-sm">
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-5 py-10">{children}</main>
    </div>
  );
}
