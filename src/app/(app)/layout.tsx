import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { FirstRun } from "@/components/first-run";
import { QuickAddSheet } from "@/components/quick-add-sheet";
import { canStartTrial } from "@/lib/billing/tier";
import { getBillingProfile } from "@/lib/queries/account";
import { listSubjects } from "@/lib/queries/subjects";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side guard for every authed route. The proxy also redirects, but
 * this is the authoritative check (proxy can be skipped for some requests).
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [subjects, billing] = await Promise.all([
    listSubjects(),
    getBillingProfile(),
  ]);
  // Offer the plan choice in onboarding only to accounts that can still pick.
  const plan =
    billing.tier === "free" || canStartTrial(billing)
      ? {
          tier: billing.tier,
          canTrial: canStartTrial(billing),
          email: user.email ?? undefined,
        }
      : undefined;

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader email={user.email ?? null} name={name} />
      <div
        className="flex-1"
        style={{
          paddingBottom:
            "calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
      <QuickAddSheet subjects={subjects} />
      <BottomNav />
      <FirstRun plan={plan} />
    </div>
  );
}
