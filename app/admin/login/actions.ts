"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/admin/login?error=missing_fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Deliberately generic: Supabase's own error text (e.g. distinguishing
    // "no such user" from "wrong password") is not shown to the caller, so
    // a failed login attempt can't be used to enumerate admin accounts.
    // See MKTBD_SPEC.md section 22.
    console.error("[admin/login] sign-in failed:", error.message);
    redirect("/admin/login?error=invalid_credentials");
  }

  redirect("/admin");
}
