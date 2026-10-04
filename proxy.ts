import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase auth session on every /admin request and bounces
 * outright-unauthenticated visitors to /admin/login (MKTBD_SPEC.md section
 * 12). This is a cheap first pass only — it confirms a session exists, not
 * that the session belongs to an admin. The authoritative admin-role check
 * is lib/auth/admin.ts's requireAdmin(), run server-side in the protected
 * admin layout.
 *
 * Named `proxy`, not `middleware` — see docs/MKTBD_SPEC.md's Next.js 16
 * notes. The proxy runtime is always nodejs, which is what makes session
 * refresh (a network call to Supabase) possible here at all.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/admin/login";

  // A Server Action call (POST + Next-Action header, as Next.js itself
  // detects it) must not get a redirect from here: the action client can't
  // follow one and the page falls into the error boundary (e.g. a session
  // that expired while an admin page was open). Let it through instead --
  // every admin Server Action calls requireAdmin(), whose redirect() the
  // client turns into a navigation to /admin/login. Page requests are
  // still redirected here, and the (dashboard) layout re-checks anyway.
  const isServerAction =
    request.method === "POST" && request.headers.has("next-action");

  if (!user && !isLoginRoute && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
