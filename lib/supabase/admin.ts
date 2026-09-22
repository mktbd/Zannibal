import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the service-role key. This bypasses Row
 * Level Security, so it must only ever be imported from trusted server-side
 * code (Route Handlers, Server Actions) that performs its own authorization
 * checks first — never from Client Components, and never for public reads.
 *
 * The `server-only` import guarantees a build-time error if this module is
 * ever pulled into client-side code.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
