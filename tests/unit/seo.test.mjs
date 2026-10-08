import { test } from "node:test";
import assert from "node:assert/strict";
import {
  absoluteUrl, analysisDescription, analysisGraph, articleGraph, canonicalPath, caseStudyGraph,
  homeGraph, isIndexableDeployment, joinList, parseSiteUrl, serializeJsonLd,
} from "../../lib/seo.ts";
import { buildSitemap } from "../../lib/sitemap-entries.ts";

const SITE = { origin: "https://mktbd.co", name: "mktbd", description: "Tagline.", sameAs: ["https://www.linkedin.com/company/mktbd/"] };

test("SITE_URL is validated: absolute https origin only, else the default", () => {
  const warnings = [];
  const warn = (m) => warnings.push(m);
  assert.equal(parseSiteUrl(undefined, warn), "https://mktbd.co");
  assert.equal(parseSiteUrl("https://mktbd.co/", warn), "https://mktbd.co");
  assert.equal(parseSiteUrl("https://staging.mktbd.co", warn), "https://staging.mktbd.co");
  assert.equal(parseSiteUrl("http://localhost:3301", warn), "http://localhost:3301");
  assert.equal(warnings.length, 0);
  for (const bad of ["http://mktbd.co", "mktbd.co", "https://mktbd.co/path", "https://mktbd.co/?utm=1", "javascript:alert(1)", "ftp://mktbd.co"]) {
    assert.equal(parseSiteUrl(bad, warn), "https://mktbd.co", bad);
  }
  assert.equal(warnings.length, 6);
});

test("canonical paths drop queries, fragments, duplicate and trailing slashes", () => {
  assert.equal(canonicalPath("/articles/x/?utm_source=a#top"), "/articles/x");
  assert.equal(canonicalPath("//analysis//slug/"), "/analysis/slug");
  assert.equal(canonicalPath(""), "/");
  assert.equal(absoluteUrl("https://mktbd.co", "/"), "https://mktbd.co");
  assert.equal(absoluteUrl("https://mktbd.co", "/articles/a/"), "https://mktbd.co/articles/a");
});

test("JSON-LD serialisation cannot break out of the script element", () => {
  const out = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
  assert.equal(out.includes("</script>"), false);
  assert.deepEqual(JSON.parse(out), { headline: "</script><script>alert(1)</script>" });
});

test("Analysis description is derived from stored topics only", () => {
  assert.equal(joinList(["A", "B", "C"]), "A, B and C");
  assert.equal(analysisDescription([], "Fallback."), "Fallback.");
  assert.equal(analysisDescription(["Fintech", "Mobile Money"], "Fallback."), "A visual analysis from mktbd on Fintech and Mobile Money. Fallback.");
});

const nodes = (graph, type) => graph["@graph"].filter((n) => n["@type"] === type);

test("home graph: Organization (no invented logo) + WebSite", () => {
  const g = homeGraph(SITE);
  const [org] = nodes(g, "Organization");
  assert.equal(org["@id"], "https://mktbd.co/#organization");
  assert.equal("logo" in org, false);
  assert.deepEqual(org.sameAs, SITE.sameAs);
  assert.equal(nodes(g, "WebSite")[0].publisher["@id"], org["@id"]);
});

test("Article graph: Article by the publisher (no fictional byline), canonical, breadcrumb, Visual Story link", () => {
  const g = articleGraph(SITE, { title: "T", slug: "t", description: null, coverUrl: null, publicationDate: "2026-10-06", updatedAt: "2026-10-07T10:00:00+00:00", tags: ["Fintech"], visualStorySlug: "v" });
  const [art] = nodes(g, "Article");
  assert.equal(art.author["@id"], "https://mktbd.co/#organization");
  assert.equal(art.datePublished, "2026-10-06");
  assert.equal(art.dateModified, "2026-10-07T10:00:00+00:00");
  assert.equal("description" in art, false);
  assert.equal("image" in art, false);
  assert.equal(art.isAccessibleForFree, true);
  assert.equal(nodes(g, "WebPage")[0]["@id"], "https://mktbd.co/articles/t");
  assert.deepEqual(nodes(g, "WebPage")[0].relatedLink, ["https://mktbd.co/analysis/v"]);
  assert.deepEqual(nodes(g, "BreadcrumbList")[0].itemListElement.map((i) => i.item), ["https://mktbd.co", "https://mktbd.co/articles", "https://mktbd.co/articles/t"]);
  const noLink = articleGraph(SITE, { title: "T", slug: "t", description: "D", coverUrl: "https://x/c.jpg", publicationDate: "2026-10-06", updatedAt: "x", tags: [], visualStorySlug: null });
  assert.equal("relatedLink" in nodes(noLink, "WebPage")[0], false);
  assert.equal("keywords" in nodes(noLink, "Article")[0], false);
});

test("Analysis graph: an ImageGallery, never an Article", () => {
  const g = analysisGraph(SITE, { title: "A", slug: "a", description: "D", slides: ["https://x/1.png", "https://x/2.png"], publicationDate: "2026-09-28", updatedAt: "u", tags: [], articleSlug: "w" });
  assert.equal(nodes(g, "Article").length, 0);
  const [gallery] = nodes(g, "ImageGallery");
  assert.deepEqual(gallery.image, ["https://x/1.png", "https://x/2.png"]);
  assert.deepEqual(gallery.relatedLink, ["https://mktbd.co/articles/w"]);
  assert.equal(gallery.isAccessibleForFree, true);
});

test("Case Study graph: Product with the real BDT price, nothing free, no ratings/reviews/availability", () => {
  const g = caseStudyGraph(SITE, { title: "C", slug: "c", description: "Short.", coverUrl: null, priceBdt: 1500, publicationDate: "2026-09-01", tags: ["Retail"] });
  const [p] = nodes(g, "Product");
  assert.deepEqual(p.offers.price, "1500.00");
  assert.equal(p.offers.priceCurrency, "BDT");
  assert.equal(p.offers.url, "https://mktbd.co/case-studies/c");
  for (const k of ["aggregateRating", "review", "isAccessibleForFree"]) assert.equal(k in p, false, k);
  assert.equal("availability" in p.offers, false);
  assert.equal(JSON.stringify(g).includes("isAccessibleForFree\":true"), false);
});

test("deployment detection: only Vercel production (or no Vercel at all) is indexable", () => {
  assert.equal(isIndexableDeployment("production"), true);
  assert.equal(isIndexableDeployment(undefined), true);
  assert.equal(isIndexableDeployment(""), true);
  assert.equal(isIndexableDeployment("preview"), false);
  assert.equal(isIndexableDeployment("development"), false);
});

test("the same Organization entity on the homepage and Article pages; mktbd is author and publisher", () => {
  const home = homeGraph(SITE)["@graph"].find((n) => n["@type"] === "Organization");
  const graph = articleGraph(SITE, { title: "T", slug: "t", description: null, coverUrl: null, publicationDate: "2026-10-06", updatedAt: "x", tags: [], visualStorySlug: null });
  const org = graph["@graph"].find((n) => n["@type"] === "Organization");
  const art = graph["@graph"].find((n) => n["@type"] === "Article");
  assert.deepEqual(org, home);
  assert.equal(art.author["@id"], home["@id"]);
  assert.equal(art.publisher["@id"], home["@id"]);
  assert.equal(JSON.stringify(graph).includes('"Person"'), false);
});

test("Case Study Offer price is exactly the given CMS price (no defaults, decimals kept)", () => {
  for (const price of [1500, 990.5, 12000]) {
    const g = caseStudyGraph(SITE, { title: "C", slug: "c", description: null, coverUrl: null, priceBdt: price, publicationDate: "2026-09-01", tags: [] });
    const p = g["@graph"].find((n) => n["@type"] === "Product");
    assert.equal(Number(p.offers.price), price);
    assert.deepEqual(Object.keys(p.offers).sort(), ["@type", "price", "priceCurrency", "seller", "url"]);
  }
});

test("sitemap: only given published rows, real lastmod, no lastmod invented for home", () => {
  const rows = (prefix, dates) => dates.map((d, i) => ({ slug: `${prefix}-${i}`, updatedAt: d, image: i === 0 ? `https://img/${prefix}.png` : null }));
  const entries = buildSitemap("https://mktbd.co", {
    analyses: rows("a", ["2026-10-01T00:00:00Z", "2026-10-05T00:00:00Z"]),
    articles: [],
    caseStudies: rows("c", ["2026-09-01T00:00:00Z"]),
  });
  const urls = entries.map((e) => e.url);
  assert.deepEqual(urls, ["https://mktbd.co", "https://mktbd.co/analysis", "https://mktbd.co/analysis/a-0", "https://mktbd.co/analysis/a-1", "https://mktbd.co/articles", "https://mktbd.co/case-studies", "https://mktbd.co/case-studies/c-0"]);
  assert.equal("lastModified" in entries[0], false);
  for (const i of [0, 1, 4, 5]) assert.equal("lastModified" in entries[i], false, `home/archive ${entries[i].url}: no derived date`);
  assert.equal(entries[2].lastModified, "2026-10-01T00:00:00Z");
  assert.equal(entries[3].lastModified, "2026-10-05T00:00:00Z");
  assert.deepEqual(entries[2].images, ["https://img/a.png"]);
  assert.equal(urls.some((u) => /admin|api|buy|preview/.test(u)), false);
});
