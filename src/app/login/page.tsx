import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/app/login/auth-card";
import { Wordmark } from "@/components/wordmark";
import { supportMailto } from "@/lib/contact";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <Wordmark className="text-lg" />
        <p className="text-muted-foreground max-w-xs text-sm">
          Your error notebook. Keep the concepts and questions you get wrong,
          and review them until they stick.
        </p>
      </div>
      <AuthCard next={next} initialError={error} />

      <footer className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs">
        <Link href="/about" className="hover:text-foreground transition">
          About
        </Link>
        <span aria-hidden>·</span>
        <Link href="/legal/terms" className="hover:text-foreground transition">
          Terms
        </Link>
        <span aria-hidden>·</span>
        <Link href="/legal/privacy" className="hover:text-foreground transition">
          Privacy
        </Link>
        <span aria-hidden>·</span>
        <a
          href={supportMailto("Choti Copy support")}
          className="hover:text-foreground transition"
        >
          Contact us
        </a>
      </footer>
    </main>
  );
}
