/**
 * Technical SEO building blocks (Stage 5C): the canonical origin, canonical
 * paths, and schema.org JSON-LD builders. Pure and framework-free, so the
 * same code runs in pages, sitemap.ts and node:test.
 *
 * Rules (docs/MKTBD_SPEC.md section 9, "SEO"):
 * - Every URL is built from one canonical origin (SITE_URL, default
 *   https://mktbd.co) and a clean path: no query string, no trailing slash.
 * - Structured data only states what the CMS or site config holds. No
 *   authors, reviewers, ratings, reviews or logos are invented; mktbd (the
 *   Organization) is the publisher and, where an author is expected, the
 *   author.
 * - Analysis is a visual gallery (ImageGallery), never an Article; Articles
 *   are Article; a Case Study page sells a downloadable report, so it is a
 *   Product with an Offer at the real CMS price (never presented as free
 *   content, and no availability, rating or review is claimed).
 */

export const DEFAULT_SITE_URL = "https://mktbd.co";

/**
 * The canonical origin from a raw SITE_URL value: an absolute https URL
 * with no path, query or hash (http is accepted for localhost only, for
 * local testing). Anything else falls back to the default, with `warn`
 * called, so a typo can never put a broken origin into canonical tags.
 */
export function parseSiteUrl(raw: string | undefined, warn: (message: string) => void = () => {}): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_SITE_URL;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    const okProtocol = url.protocol === "https:" || (url.protocol === "http:" && local);
    if (okProtocol && (url.pathname === "/" || url.pathname === "") && !url.search && !url.hash && !url.username) {
      return url.origin;
    }
  } catch {}
  warn(`SITE_URL "${value}" is not an absolute https origin; using ${DEFAULT_SITE_URL}.`);
  return DEFAULT_SITE_URL;
}

/**
 * May this deployment be indexed? On Vercel, VERCEL_ENV is set for every
 * build and request: only "production" is indexable; "preview" and
 * "development" are not. Off Vercel (no VERCEL_ENV: local builds, other
 * hosts) indexing is allowed -- set up the host's own preview protection
 * there. Canonical URLs always point at the production origin either way.
 */
export function isIndexableDeployment(vercelEnv: string | undefined): boolean {
  return vercelEnv === undefined || vercelEnv === "" || vercelEnv === "production";
}

/** Canonical path: leading slash, no query/hash, no trailing slash (except "/"). */
export function canonicalPath(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return clean === "" ? "/" : clean.startsWith("/") ? clean : `/${clean}`;
}

export function absoluteUrl(origin: string, path: string): string {
  const p = canonicalPath(path);
  return p === "/" ? origin : `${origin}${p}`;
}

/**
 * JSON-LD serialised for an inline <script>. "<" is escaped so no string
 * value (titles come from the CMS) can close the script element.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** "A", "A and B", "A, B and C". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Meta description for an Analysis, which has no description field: the
 * approved archive description, prefixed with its topics when it has any
 * ("A visual analysis from mktbd on Fintech and Mobile Money. ...").
 * Derived only from stored metadata -- no invented summary.
 */
export function analysisDescription(tags: readonly string[], fallback: string): string {
  return tags.length ? `A visual analysis from mktbd on ${joinList(tags.slice(0, 3))}. ${fallback}` : fallback;
}

// ---------------------------------------------------------------- builders

export interface SiteInfo {
  origin: string;
  name: string;
  description: string;
  /** Official profiles only (lib/site.ts SOCIAL_LINKS). */
  sameAs: readonly string[];
}

const orgId = (origin: string) => `${origin}/#organization`;
const siteId = (origin: string) => `${origin}/#website`;

export function organizationNode(site: SiteInfo) {
  return {
    "@type": "Organization",
    "@id": orgId(site.origin),
    name: site.name,
    url: site.origin,
    ...(site.sameAs.length ? { sameAs: [...site.sameAs] } : {}),
  };
}

export function websiteNode(site: SiteInfo) {
  return {
    "@type": "WebSite",
    "@id": siteId(site.origin),
    name: site.name,
    url: site.origin,
    description: site.description,
    inLanguage: "en",
    publisher: { "@id": orgId(site.origin) },
  };
}

/** Homepage graph: who publishes, and the site itself. */
export function homeGraph(site: SiteInfo) {
  return { "@context": "https://schema.org", "@graph": [organizationNode(site), websiteNode(site)] };
}

export function breadcrumbNode(origin: string, pageUrl: string, trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(origin, item.path),
    })),
  };
}

/** A date-only CMS value as an ISO date (kept date-only: no invented time). */
const isoDate = (date: string) => date.slice(0, 10);

export interface ArticleLd {
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  publicationDate: string;
  updatedAt: string;
  tags: string[];
  /** Published Analysis this Article links to ("See Visual Story"), if shown. */
  visualStorySlug: string | null;
}

/**
 * Article page: WebPage (with breadcrumb and, when shown, a related link to
 * the visual Analysis) whose main entity is an Article published -- and,
 * with no author stored in the CMS, authored -- by mktbd.
 */
export function articleGraph(site: SiteInfo, a: ArticleLd) {
  const url = absoluteUrl(site.origin, `/articles/${a.slug}`);
  const org = { "@id": orgId(site.origin) };
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(site),
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: a.title,
        isPartOf: { "@id": siteId(site.origin) },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        ...(a.visualStorySlug ? { relatedLink: [absoluteUrl(site.origin, `/analysis/${a.visualStorySlug}`)] } : {}),
      },
      {
        "@type": "Article",
        "@id": `${url}#article`,
        mainEntityOfPage: { "@id": url },
        headline: a.title,
        ...(a.description ? { description: a.description } : {}),
        ...(a.coverUrl ? { image: [a.coverUrl] } : {}),
        datePublished: isoDate(a.publicationDate),
        dateModified: a.updatedAt,
        author: org,
        publisher: org,
        isAccessibleForFree: true,
        inLanguage: "en",
        ...(a.tags.length ? { keywords: a.tags } : {}),
      },
      breadcrumbNode(site.origin, url, [
        { name: "Home", path: "/" },
        { name: "Articles", path: "/articles" },
        { name: a.title, path: `/articles/${a.slug}` },
      ]),
    ],
  };
}

export interface AnalysisLd {
  title: string;
  slug: string;
  description: string;
  slides: string[];
  publicationDate: string;
  updatedAt: string;
  tags: string[];
  /** Published Article this Analysis links to ("Read Article"), if shown. */
  articleSlug: string | null;
}

/**
 * Analysis page: an ImageGallery (a visual carousel of slides) published by
 * mktbd -- deliberately not an Article, since it has no written body.
 */
export function analysisGraph(site: SiteInfo, a: AnalysisLd) {
  const url = absoluteUrl(site.origin, `/analysis/${a.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(site),
      {
        "@type": "ImageGallery",
        "@id": url,
        url,
        name: a.title,
        description: a.description,
        ...(a.slides.length ? { image: a.slides, primaryImageOfPage: { "@type": "ImageObject", url: a.slides[0] } } : {}),
        datePublished: isoDate(a.publicationDate),
        dateModified: a.updatedAt,
        publisher: { "@id": orgId(site.origin) },
        isAccessibleForFree: true,
        isPartOf: { "@id": siteId(site.origin) },
        inLanguage: "en",
        ...(a.tags.length ? { keywords: a.tags } : {}),
        breadcrumb: { "@id": `${url}#breadcrumb` },
        ...(a.articleSlug ? { relatedLink: [absoluteUrl(site.origin, `/articles/${a.articleSlug}`)] } : {}),
      },
      breadcrumbNode(site.origin, url, [
        { name: "Home", path: "/" },
        { name: "Analysis", path: "/analysis" },
        { name: a.title, path: `/analysis/${a.slug}` },
      ]),
    ],
  };
}

export interface CaseStudyLd {
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  priceBdt: number;
  publicationDate: string;
  tags: string[];
}

/**
 * Case Study page: the purchasable Case Study as a Product, sold by mktbd at
 * its real CMS price in BDT. Only the public product information is used
 * (title, short description, cover); nothing from the paid PDF.
 */
export function caseStudyGraph(site: SiteInfo, c: CaseStudyLd) {
  const url = absoluteUrl(site.origin, `/case-studies/${c.slug}`);
  const org = { "@id": orgId(site.origin) };
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(site),
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: c.title,
        isPartOf: { "@id": siteId(site.origin) },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "Product",
        "@id": `${url}#product`,
        mainEntityOfPage: { "@id": url },
        name: c.title,
        ...(c.description ? { description: c.description } : {}),
        ...(c.coverUrl ? { image: [c.coverUrl] } : {}),
        category: "Case Study (PDF)",
        brand: org,
        releaseDate: isoDate(c.publicationDate),
        ...(c.tags.length ? { keywords: c.tags.join(", ") } : {}),
        offers: {
          "@type": "Offer",
          price: c.priceBdt.toFixed(2),
          priceCurrency: "BDT",
          url,
          seller: org,
        },
      },
      breadcrumbNode(site.origin, url, [
        { name: "Home", path: "/" },
        { name: "Case Studies", path: "/case-studies" },
        { name: c.title, path: `/case-studies/${c.slug}` },
      ]),
    ],
  };
}
