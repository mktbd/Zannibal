import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_ORIGIN } from "@/lib/seo-config";

/**
 * Crawler policy (docs/MKTBD_SPEC.md section 9, "SEO"):
 * - All crawlers, AI crawlers included, may read the public editorial site
 *   -- pages, images (served from Supabase Storage) and /_next assets.
 * - /admin and /api are excluded from crawling. They are also noindex
 *   (meta + X-Robots-Tag) and protected server-side; robots.txt is a
 *   crawling hint, not access control.
 * - Purchase pages are not disallowed here, so crawlers can see their
 *   noindex, nofollow directives.
 * - Preview deployments (VERCEL_ENV=preview) disallow everything.
 */
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
