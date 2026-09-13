import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Download,
  Flame,
  Gauge,
  LibraryBig,
  LifeBuoy,
  LogOut,
  Palette,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { ProfilePanel } from "@/components/profile-panel";
import { StudyPacingForm } from "@/components/study-pacing-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { UsageMeter, fmtBytes } from "@/components/usage-meter";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";
import { createClient } from "@/lib/supabase/server";
import { getAccountSummary, getBillingProfile } from "@/lib/queries/account";
import { getStudyPacing } from "@/lib/queries/settings";
import { getUsageSummary } from "@/lib/queries/usage";

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  trialing: "Pro trial",
  pro: "Pro",
  past_due: "Past due",
  canceled: "Canceled",
};

export const metadata: Metadata = { title: "Profile" };

function memberSince(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function nfmt(n: number): string {
  return n.toLocaleString();
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-rule bg-card space-y-4 rounded-xl border p-5 shadow-[0_1px_2px_rgba(42,38,34,0.04)]">
      <h2 className="font-display flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span className="bg-ink-tint text-ink grid size-6 place-items-center rounded-md">
          <Icon className="size-3.5" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [summary, billing, pacing, usage] = await Promise.all([
    getAccountSummary(),
    getBillingProfile(),
    getStudyPacing(),
    getUsageSummary(),
  ]);
  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";
  const email = user.email ?? "";
  const displayName = name || email.split("@")[0] || "there";
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  const since = memberSince(user.created_at);
  const tier = billing.tier;
  const proish = tier === "pro" || tier === "trialing";

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      {/* ── header ──────────────────────────────────────────────── */}
      <header className="flex items-center gap-4">
        <span className="bg-ink-tint text-ink grid size-16 flex-none place-items-center rounded-full ring-2 ring-[color-mix(in_srgb,var(--highlight)_35%,transparent)]">
          <span className="font-display text-2xl font-semibold">{initial}</span>
        </span>
        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl font-semibold tracking-tight">
            {displayName}
          </h1>
          {since && (
            <p className="text-muted-foreground text-sm">
              Studying since {since}
            </p>
          )}
        </div>
      </header>

      {/* ── your library — the celebration ──────────────────────── */}
      <section
        className="dogear border-rule bg-card relative space-y-4 rounded-xl border p-5 shadow-[0_1px_2px_rgba(42,38,34,0.04)]"
        style={{ "--dogear-color": "var(--highlight)" } as React.CSSProperties}
      >
        <h2 className="font-display flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="bg-highlight-tint text-ink grid size-6 place-items-center rounded-md">
            <LibraryBig className="size-3.5" />
          </span>
          Your library
        </h2>

        <div>
          <p className="font-display text-5xl leading-none font-semibold tabular-nums">
            {nfmt(summary.activeCards)}
          </p>
          <p className="text-muted-foreground mt-1.5 text-sm">
            <span className="mark-term">
              flashcard{summary.activeCards === 1 ? "" : "s"}
            </span>{" "}
            captured
          </p>
        </div>

        <div className="border-rule divide-border grid grid-cols-2 divide-x overflow-hidden rounded-lg border">
          <div className="px-4 py-3">
            <p className="font-display text-lg font-semibold tabular-nums">
              {nfmt(summary.reviewsAllTime)}
            </p>
            <p className="text-muted-foreground text-xs">reviews logged</p>
          </div>
          <div className="px-4 py-3">
            <p className="font-display flex items-center gap-1 text-lg font-semibold tabular-nums">
              {summary.streakDays}
              {summary.streakDays > 0 && (
                <Flame className="text-clay size-4" />
              )}
            </p>
            <p className="text-muted-foreground text-xs">day streak</p>
          </div>
        </div>
      </section>

      {/* ── study pacing ────────────────────────────────────────── */}
      <SectionCard icon={Gauge} title="Study pacing">
        <StudyPacingForm pacing={pacing} />
      </SectionCard>

      {/* ── account ─────────────────────────────────────────────── */}
      <SectionCard icon={UserRound} title="Account">
        <ProfilePanel initialName={name} email={email} />
      </SectionCard>

      {/* ── plan ────────────────────────────────────────────────── */}
      <SectionCard icon={Sparkles} title="Plan">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cnPill(proish)}
            >
              {TIER_LABEL[tier] ?? "Free"}
            </span>
            <span className="text-muted-foreground text-sm">
              {tier === "free"
                ? "Everything in Choti Copy, no limits yet."
                : billing.currentPeriodEnd
                  ? `Renews ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`
                  : "Active"}
            </span>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/billing">
              {tier === "free" ? "See plans" : "Manage plan"}
            </Link>
          </Button>
        </div>
      </SectionCard>

      {/* ── usage ───────────────────────────────────────────────── */}
      <SectionCard icon={Activity} title="Usage">
        <UsageMeter
          label="AI calls today"
          used={usage.aiCallsToday}
          cap={usage.aiCallsCap}
          note="Resets daily at midnight UTC."
        />
        <UsageMeter
          label="Storage"
          used={usage.storageBytes}
          cap={usage.storageCap}
          format={fmtBytes}
          note="Card images, compressed on upload."
        />
      </SectionCard>

      {/* ── appearance ──────────────────────────────────────────── */}
      <SectionCard icon={Palette} title="Appearance">
        <ThemeToggle fullWidth />
      </SectionCard>

      {/* ── feedback & support ──────────────────────────────────── */}
      <SectionCard icon={LifeBuoy} title="Feedback & support">
        <p className="text-muted-foreground text-sm">
          Have feedback or found a bug? We read every message.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={supportMailto("Choti Copy feedback")}>
            <LifeBuoy className="size-4" /> Email us
          </a>
        </Button>
        <p className="text-muted-foreground text-xs">
          {SUPPORT_EMAIL}
        </p>
      </SectionCard>

      {/* ── your data ───────────────────────────────────────────── */}
      <SectionCard icon={ShieldCheck} title="Your data">
        <p className="text-muted-foreground text-sm">
          Everything you&rsquo;ve stored is private to your account and strictly
          access-controlled.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/api/account/export">
            <Download className="size-4" /> Download my data (JSON)
          </a>
        </Button>
        <p className="text-muted-foreground text-xs">
          Account deletion is coming alongside the privacy policy. Until then,{" "}
          <a
            href={supportMailto("Delete my Choti Copy account")}
            className="text-ink underline underline-offset-2"
          >
            email us
          </a>{" "}
          to have your account and its data removed.
        </p>
      </SectionCard>

      <form action={signOut} className="pt-1 text-center">
        <button
          type="submit"
          className="text-muted-foreground hover:text-clay inline-flex items-center gap-1.5 text-sm font-medium transition"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </main>
  );
}

function cnPill(pro: boolean): string {
  return [
    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
    pro ? "bg-highlight-tint text-ink" : "bg-ink-tint text-ink",
  ].join(" ");
}
