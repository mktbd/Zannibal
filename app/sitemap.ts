import type { MetadataRoute } from "next";
import { getSitemapContent } from "@/lib/data/sitemap";
import { buildSitemap } from "@/lib/sitemap-entries";
import { SITE_ORIGIN } from "@/lib/seo-config";

// Regenerated at most every 5 minutes, and immediately when the CMS
// publishes, edits, unpublishes or deletes content (its actions revalidate
// "/sitemap.xml"). One sitemap file holds up to 50,000 URLs; split with
// generateSitemaps() long before mktbd gets near that.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(SITE_ORIGIN, await getSitemapContent());
}
