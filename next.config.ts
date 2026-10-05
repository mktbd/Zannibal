import type { NextConfig } from "next";

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
};

export default nextConfig;
