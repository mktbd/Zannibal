import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/types/content";

/**
 * The authoritative Admin authorization check. This is what actually
 * enforces "authorization must be checked server-side" (MKTBD_SPEC.md
 * section 12) — proxy.ts only redirects outright-unauthenticated visitors
 * as a cheap first pass; this function also rejects an authenticated
 * non-admin user, which proxy.ts has no way to know about without a DB
 * round trip on every request.
 *
 * Even if this check were ever bypassed by a future code change, the same
 * profiles.role lookup is mirrored in Postgres RLS (public.is_admin()), so
 * no admin-only mutation could actually succeed anyway.
 */
export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: ProfileRole }>();

  if (error || profile?.role !== "admin") {
    redirect("/admin/login?error=unauthorized");
  }

  return { user };
}
