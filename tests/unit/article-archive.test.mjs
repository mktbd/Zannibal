import { test } from "node:test";
import assert from "node:assert/strict";
import { splitFeatured, toArticleCard, visibleLinkTarget } from "../../lib/article-archive.ts";

const url = (path) => `https://cdn.example/${path}`;
const row = (n, extra = {}) => ({
  id: `id-${n}`,
  title: `Title ${n}`,
  slug: `slug-${n}`,
  short_description: null,
  cover_image_path: null,
  publication_date: "2026-10-01",
  ...extra,
});

test("cards carry only card fields; blank cover/description become null", () => {
  const card = toArticleCard({ ...row(1), cover_image_path: "articles/x/cover-a.jpg", short_description: "  Standfirst  ", body: { secret: 1 } }, url);
  assert.deepEqual(card, {
    id: "id-1",
    title: "Title 1",
    slug: "slug-1",
    shortDescription: "Standfirst",
    coverUrl: "https://cdn.example/articles/x/cover-a.jpg",
    publicationDate: "2026-10-01",
  });
  assert.equal("body" in card, false);
  const blank = toArticleCard({ ...row(2), cover_image_path: "  ", short_description: "   " }, url);
  assert.equal(blank.coverUrl, null);
  assert.equal(blank.shortDescription, null);
});

test("featured is the first (newest) card and never repeats in the library", () => {
  const cards = [1, 2, 3, 4, 5].map((n) => toArticleCard(row(n), url));
  const { featured, library } = splitFeatured(cards);
  assert.equal(featured.id, "id-1");
  assert.deepEqual(library.map((c) => c.id), ["id-2", "id-3", "id-4", "id-5"]);
  assert.equal(library.some((c) => c.id === featured.id), false);
  assert.deepEqual(splitFeatured([]), { featured: null, library: [] });
  assert.deepEqual(splitFeatured(cards.slice(0, 1)).library, []);
});

test("link target shown only when the toggle is on and both sides are published", () => {
  const analysis = (status) => ({ slug: "visual", title: "Visual", status });
  const article = (status) => ({ slug: "written", title: "Written", status });
  // Article page -> See Visual Story
  assert.deepEqual(visibleLinkTarget({ read_article_enabled: true, other: analysis("published") }, { kind: "article", status: "published" }), { slug: "visual", title: "Visual" });
  assert.equal(visibleLinkTarget({ read_article_enabled: false, other: analysis("published") }, { kind: "article", status: "published" }), null);
  assert.equal(visibleLinkTarget({ read_article_enabled: true, other: analysis("draft") }, { kind: "article", status: "published" }), null);
  assert.equal(visibleLinkTarget({ read_article_enabled: true, other: analysis("published") }, { kind: "article", status: "draft" }), null);
  assert.equal(visibleLinkTarget({ read_article_enabled: true, other: null }, { kind: "article", status: "published" }), null);
  assert.equal(visibleLinkTarget(null, { kind: "article", status: "published" }), null);
  // Analysis viewer -> Read Article (array embed form tolerated)
  assert.deepEqual(visibleLinkTarget({ read_article_enabled: true, other: [article("published")] }, { kind: "analysis", status: "published" }), { slug: "written", title: "Written" });
  assert.equal(visibleLinkTarget({ read_article_enabled: true, other: article("draft") }, { kind: "analysis", status: "published" }), null);
  assert.equal(visibleLinkTarget({ read_article_enabled: true, other: article("published") }, { kind: "analysis", status: "draft" }), null);
});
