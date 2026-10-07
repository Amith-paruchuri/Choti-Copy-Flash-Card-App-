import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { serverEnv, supabasePublic } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client — bypasses RLS entirely. Use ONLY for billing writes
 * that have no user session to scope to (the webhook) or that write a
 * column end users have no policy for (`profiles`, from a server action
 * that already called `requireUser()` itself). Never expose this client or
 * its key to the browser.
 */
export function createAdminClient() {
  const key = serverEnv.supabaseServiceRoleKey;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — required for billing writes.",
    );
  }
  return createSupabaseClient<Database>(supabasePublic.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
