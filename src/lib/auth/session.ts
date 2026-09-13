import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Returns the signed-in user and a client bound to their session.
 * Throws if there is no session — call only from guarded routes / actions.
 */
export async function requireUser(): Promise<{
  user: User;
  supabase: Client;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { user, supabase };
}
