/**
 * HTTP security headers (Stage 5D), built here and applied to every route
 * by next.config.ts. Pure, so the policy is unit-tested.
 *
 * Content-Security-Policy trade-off: the App Router streams its payload in
 * inline <script> tags, so script-src needs 'unsafe-inline' unless every
 * page gets a per-request nonce -- which would force all pages to render
 * dynamically and give up static/ISR caching. Without nonces the CSP still
 * blocks scripts from any other origin, eval (outside development),
 * plugins/objects, <base> hijacking, foreign form targets, framing by other
 * sites, and loading images or connecting anywhere but this site and the
 * configured Supabase project. JSON-LD (<script type="application/ld+json">)
 * is a data block, not an executed script, so the CSP does not affect it.
 */
export interface SecurityHeaderOptions {
  /** NEXT_PUBLIC_SUPABASE_URL (images, Storage uploads, auth). */
  supabaseUrl: string | undefined;
  /** next dev: React needs eval and the dev server uses websockets. */
  development: boolean;
  /** Vercel production (VERCEL_ENV=production): add HSTS. */
  productionHttps: boolean;
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ supabaseUrl, development }: SecurityHeaderOptions): string {
  const supabase = originOf(supabaseUrl);
  const httpsSupabase = supabase?.startsWith("https://") ?? false;
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // data: for tiny inline images; blob: for upload previews in the CMS.
    ["img-src", ["'self'", "data:", "blob:", ...(supabase ? [supabase] : [])]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...(supabase ? [supabase] : []), ...(development ? ["ws:"] : [])]],
    ["media-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  const policy = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  // Only when every origin we load from is https (never for a local http Supabase).
  if (!development && httpsSupabase) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Two years, this host only: no includeSubDomains/preload, which would
    // commit every mktbd.co subdomain to HTTPS permanently.
    ...(options.productionHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }] : []),
  ];
}
