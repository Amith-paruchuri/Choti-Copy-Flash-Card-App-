import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/app/login/auth-card";
import { ForgettingHero } from "@/components/forgetting-hero";
import { Wordmark } from "@/components/wordmark";
import { supportMailto } from "@/lib/contact";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
      <section
        className="rise flex flex-col gap-6"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <Wordmark className="text-lg" />
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Beat the forgetting curve.
        </h1>
        <p className="text-muted-foreground max-w-md text-base text-pretty">
          Every concept you miss comes back right before it slips away. Study it
          less, and still know it on exam day.
        </p>
        <ForgettingHero />
      </section>

      <section className="flex flex-col gap-8">
        <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <AuthCard next={next} initialError={error} />
        </div>
        <footer
          className="rise text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs"
          style={{ "--i": 2 } as React.CSSProperties}
        >
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
      </section>
    </main>
  );
}
