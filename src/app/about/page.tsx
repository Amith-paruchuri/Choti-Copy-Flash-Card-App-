import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";

import { Wordmark } from "@/components/wordmark";
import { supportMailto, SUPPORT_EMAIL } from "@/lib/contact";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "About",
  description:
    "Choti Copy is a student's own error notebook, paired with AI-assisted spaced repetition. Built by Amith, a final-year medical student at AIIMS Delhi.",
};

const LINKEDIN_URL = "https://www.linkedin.com/in/amith-paruchuri-a2b7522ba/";

export default function AboutPage() {
  return (
    <div className="bg-background min-h-dvh">
      <header className="border-rule border-b">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between px-5">
          <Link href="/" aria-label="Choti Copy home">
            <Wordmark />
          </Link>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition"
          >
            Sign in <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-8 px-5 py-12">
        <div className="space-y-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            About Choti Copy
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Choti Copy is <span className="mark-term">your error notebook</span>{" "}
            — the place for the concepts and questions you keep getting wrong.
            You add what tripped you up; it brings each one back on a spaced
            schedule (real FSRS, the same algorithm behind Anki), quizzes you on
            your own cards, and weights your reviews toward the things you
            actually struggle with.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            It exists because the notes you make when you get something wrong are
            the notes most worth revisiting — and they&rsquo;re usually the ones
            that get lost in a folder somewhere. This keeps them, and makes sure
            you see them again before you&rsquo;ve forgotten.
          </p>
        </div>

        <section
          className="dogear border-rule bg-card relative space-y-3 rounded-xl border p-5 shadow-[0_1px_2px_rgba(42,38,34,0.04)]"
          style={
            { "--dogear-color": "var(--sage)" } as React.CSSProperties
          }
        >
          <h2 className="font-display text-sm font-semibold tracking-tight">
            A note from the maker
          </h2>
          <p className="text-sm leading-relaxed">
            I&rsquo;m Amith, a final-year medical student at AIIMS Delhi. I
            started building this during my own Step 1 prep — I had a growing pile
            of &ldquo;why did I get this wrong&rdquo; notes and no good way to
            actually study them. Choti Copy is the tool I wanted for myself.
            It&rsquo;s still early, and I&rsquo;m building it in the open, so if
            something feels off or you have an idea, I genuinely want to hear it.
          </p>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink hover:text-ink/80 inline-flex items-center gap-1.5 text-sm font-medium transition"
          >
            <LinkedInIcon className="size-4" /> Amith on LinkedIn
          </a>
        </section>

        <section className="space-y-2.5 text-sm">
          <h2 className="font-display font-semibold tracking-tight">
            Get in touch
          </h2>
          <a
            href={supportMailto("Choti Copy feedback")}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition"
          >
            <Mail className="size-4 flex-none" />
            {SUPPORT_EMAIL}
          </a>
          <p className="text-muted-foreground">
            Feedback, bugs, ideas — every message gets read.
          </p>
        </section>

        <footer className="border-rule text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 border-t pt-4 text-xs">
          <Link href="/legal/terms" className="hover:text-foreground transition">
            Terms
          </Link>
          <span aria-hidden>·</span>
          <Link
            href="/legal/privacy"
            className="hover:text-foreground transition"
          >
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/login" className="hover:text-foreground transition">
            Sign in
          </Link>
        </footer>
      </main>
    </div>
  );
}
