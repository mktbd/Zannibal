import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-less, anonymous Supabase client for public pages. Uses the anon
 * key, so Postgres RLS decides what it sees exactly as for any visitor --
 * never a signed-in admin's session and never the service-role key. Being
 * cookie-free lets public pages be statically rendered and revalidated.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
