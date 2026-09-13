import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { supabasePublic } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * `cookies()` is async in Next.js 16. In a plain Server Component the cookie
 * store is read-only and the `setAll` writes throw — that's expected and
 * safe to swallow, because `proxy.ts` refreshes the session on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabasePublic.url, supabasePublic.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — ignore. Proxy handles refresh.
        }
      },
    },
  });
}
