/**
 * Pure sitemap builder (app/sitemap.ts supplies the published rows).
 * Framework-free so the inclusion and lastmod rules are unit-tested.
 *
 * - Only the public, indexable routes: home, the three archives and
 *   published detail pages. Never admin, previews, purchase pages, APIs or
 *   drafts (the rows come from published-only queries).
 * - lastmod is only ever a real, stored timestamp: a detail page's own
 *   updated_at. The homepage and the archives get none: no stored value
 *   records when an archive page changed (an edit to an older item, an
 *   unpublish or a delete would not show in its newest item's updated_at),
 *   so a derived date could mislead crawlers.
 */
import { absoluteUrl } from "./seo.ts";

export interface SitemapRow {
  slug: string;
  updatedAt: string;
  /** Public image URL (cover or first slide), when there is one. */
  image: string | null;
}

export interface SitemapEntry {
  url: string;
  lastModified?: string;
  images?: string[];
}

export function buildSitemap(
  origin: string,
  content: { analyses: readonly SitemapRow[]; articles: readonly SitemapRow[]; caseStudies: readonly SitemapRow[] },
): SitemapEntry[] {
  const section = (base: string, rows: readonly SitemapRow[]): SitemapEntry[] => {
    return [
      { url: absoluteUrl(origin, base) },
      ...rows.map((row) => ({
        url: absoluteUrl(origin, `${base}/${row.slug}`),
        lastModified: row.updatedAt,
        ...(row.image ? { images: [row.image] } : {}),
      })),
    ];
  };
  return [
    { url: absoluteUrl(origin, "/") },
    ...section("/analysis", content.analyses),
    ...section("/articles", content.articles),
    ...section("/case-studies", content.caseStudies),
  ];
}
