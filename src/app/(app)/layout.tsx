import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { FirstRun } from "@/components/first-run";
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
      <BottomNav />
      <FirstRun />
    </div>
  );
}
