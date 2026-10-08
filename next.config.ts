import type { NextConfig } from "next";
import { isIndexableDeployment } from "./lib/seo";

/**
 * Public Storage images (Analysis covers) are served through Next's image
 * optimizer for responsive sizes. Allowed sources: any hosted Supabase
 * project, plus the configured project URL itself (covers a local Supabase
 * stack such as http://127.0.0.1:54321 during development and testing).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const isLocalSupabase = supabaseUrl !== null && ["localhost", "127.0.0.1", "::1"].includes(supabaseUrl.hostname);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      ...(supabaseUrl
        ? [
            {
              protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
              hostname: supabaseUrl.hostname,
              port: supabaseUrl.port,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
    // Next 16 refuses to optimize images from private IPs by default (SSRF
    // protection). Allow it only when the configured Supabase is local.
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  /**
   * Keep private workflows out of search indexes at the HTTP level too (in
   * addition to robots meta tags), so it also covers non-HTML responses and
   * redirects. Never a substitute for authorization -- /admin is protected
   * by requireAdmin() and RLS, the purchase page by its own server logic.
   */
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    // Vercel preview/development deployments: every response is noindex.
    if (!isIndexableDeployment(process.env.VERCEL_ENV)) return [{ source: "/:path*", headers: noindex }];
    return [
      { source: "/admin", headers: noindex },
      { source: "/admin/:path*", headers: noindex },
      { source: "/api/:path*", headers: noindex },
      { source: "/case-studies/:slug/buy", headers: noindex },
    ];
  },
};

export default nextConfig;
