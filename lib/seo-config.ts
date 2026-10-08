import "server-only";
import { isIndexableDeployment, parseSiteUrl, type SiteInfo } from "@/lib/seo";
import { SITE, SOCIAL_LINKS } from "@/lib/site";

/**
 * The canonical origin for every canonical tag, Open Graph URL, JSON-LD id
 * and sitemap entry. Set SITE_URL (server-only) to override the production
 * default https://mktbd.co -- e.g. a staging domain; an invalid value falls
 * back to the default with a warning (lib/seo.ts parseSiteUrl).
 */
export const SITE_ORIGIN = parseSiteUrl(process.env.SITE_URL, (message) => console.warn(`[seo] ${message}`));

/**
 * Whether this deployment may be indexed (lib/seo.ts isIndexableDeployment):
 * Vercel production yes; Vercel preview/development no -- enforced three
 * ways: robots.txt disallows everything, every page inherits
 * <meta name="robots" content="noindex, nofollow"> from the root layout,
 * and next.config.ts adds X-Robots-Tag to every response.
 */
export const INDEXABLE = isIndexableDeployment(process.env.VERCEL_ENV);

export const SITE_INFO: SiteInfo = {
  origin: SITE_ORIGIN,
  name: SITE.name,
  description: SITE.tagline,
  sameAs: SOCIAL_LINKS.map((link) => link.href),
};

/**
 * Open Graph fields every page shares. Next.js replaces (not merges) a
 * parent's openGraph object, so pages spread this into their own.
 */
export const OG_BASE = { siteName: SITE.name, locale: "en_BD" } as const;
