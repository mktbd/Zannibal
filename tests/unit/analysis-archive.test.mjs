import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVE_PAGE_SIZE,
  appendUnique,
  archivePage,
  archiveTags,
  filterAnalyses,
  isValidSlug,
  normalizeSearchText,
  orderedSlideUrls,
  parseFeedParams,
  toArchiveEntry,
  viewerSlugFromPath,
} from "../../lib/analysis-archive.ts";

const url = (path) => `https://cdn.test/${path}`;
const row = (over = {}) => ({
  id: "a1",
  title: "How bKash Turned Agents Into a Distribution Moat",
  slug: "bkash-agents",
  analysis_slides: [
    { position: 2, storage_path: "a1/c.png" },
    { position: 0, storage_path: "a1/a.png" },
    { position: 1, storage_path: "a1/b.png" },
  ],
  analysis_tags: [{ tags: { id: "t2", name: "Mobile Money" } }, { tags: { id: "t1", name: "Fintech" } }, { tags: null }],
  ...over,
});

test("toArchiveEntry: lowest-position slide is the cover; tags A-Z; no slide list kept", () => {
  const entry = toArchiveEntry(row(), url);
  assert.equal(entry.coverUrl, url("a1/a.png"));
  assert.deepEqual(entry.tags, [{ id: "t1", name: "Fintech" }, { id: "t2", name: "Mobile Money" }]);
  assert.equal("slides" in entry, false);
});

test("toArchiveEntry: no slides (or only blank paths) -> null cover", () => {
  assert.equal(toArchiveEntry(row({ analysis_slides: [] }), url).coverUrl, null);
  assert.equal(toArchiveEntry(row({ analysis_slides: null, analysis_tags: null }), url).coverUrl, null);
  assert.equal(toArchiveEntry(row({ analysis_slides: [{ position: 0, storage_path: "  " }, { position: 1, storage_path: "a1/x.png" }] }), url).coverUrl, url("a1/x.png"));
});

test("orderedSlideUrls orders by position and skips blank paths", () => {
  assert.deepEqual(orderedSlideUrls(row().analysis_slides, url), [url("a1/a.png"), url("a1/b.png"), url("a1/c.png")]);
  assert.deepEqual(orderedSlideUrls([{ position: 1, storage_path: "" }, { position: 0, storage_path: "z.png" }], url), [url("z.png")]);
  assert.deepEqual(orderedSlideUrls(null, url), []);
});

const entries = [
  toArchiveEntry(row(), url),
  toArchiveEntry(row({ id: "a2", slug: "shwapno", title: "Why Shwapno Bets on Neighbourhood Supermarkets", analysis_tags: [{ tags: { id: "t3", name: "Retail" } }] }), url),
  toArchiveEntry(row({ id: "a3", slug: "pathao", title: "Pathao’s Long Road from Rides to Everything", analysis_tags: [{ tags: { id: "t1", name: "Fintech" } }, { tags: { id: "t4", name: "Mobility" } }] }), url),
];

test("archiveTags: each tag once, A-Z", () => {
  assert.deepEqual(archiveTags(entries).map((t) => t.name), ["Fintech", "Mobile Money", "Mobility", "Retail"]);
});

test("filterAnalyses: title and tag search, case/accents, every word, topic, combined", () => {
  const ids = (q, tag = null) => filterAnalyses(entries, q, tag).map((i) => i.id);
  assert.deepEqual(ids(""), ["a1", "a2", "a3"]);
  assert.deepEqual(ids("SHWAP"), ["a2"]);
  assert.deepEqual(ids("fintech"), ["a1", "a3"]);
  assert.deepEqual(ids("bkash mobile"), ["a1"]);
  assert.deepEqual(ids("bkash retail"), []);
  assert.deepEqual(ids("", "t1"), ["a1", "a3"]);
  assert.deepEqual(ids("pathao", "t1"), ["a3"]);
  assert.deepEqual(ids("pathao’s"), ["a3"]);
  assert.equal(normalizeSearchText("  Café   Déjà  "), "cafe deja");
});

const many = Array.from({ length: 45 }, (_, i) =>
  toArchiveEntry(row({ id: `id${i}`, slug: `s${i}`, title: `Analysis ${i}${i === 40 ? " Zebra" : ""}`, analysis_tags: i % 5 === 0 ? [{ tags: { id: "t9", name: "Rare" } }] : [] }), url),
);

test("archivePage: batches of 18 in order, total counts all matches, cards carry no tags", () => {
  const first = archivePage(many, { query: "", tagId: null, offset: 0 });
  assert.equal(ARCHIVE_PAGE_SIZE, 18);
  assert.equal(first.items.length, 18);
  assert.equal(first.total, 45);
  assert.deepEqual(first.items.map((i) => i.id).slice(0, 3), ["id0", "id1", "id2"]);
  assert.deepEqual(Object.keys(first.items[0]).sort(), ["coverUrl", "id", "slug", "title"]);
  const last = archivePage(many, { query: "", tagId: null, offset: 36 });
  assert.deepEqual([last.items.length, last.items[0].id, last.items.at(-1).id], [9, "id36", "id44"]);
  assert.equal(archivePage(many, { query: "", tagId: null, offset: 90 }).items.length, 0);
});

test("archivePage: search and topics cover the whole archive, not just the first batch", () => {
  assert.deepEqual(archivePage(many, { query: "zebra", tagId: null, offset: 0 }).items.map((i) => i.id), ["id40"]);
  const rare = archivePage(many, { query: "", tagId: "t9", offset: 0 });
  assert.equal(rare.total, 9);
  assert.deepEqual(rare.items.map((i) => i.id), ["id0", "id5", "id10", "id15", "id20", "id25", "id30", "id35", "id40"]);
});

test("appendUnique keeps order and drops duplicates", () => {
  const a = [{ id: "1" }, { id: "2" }];
  assert.deepEqual(appendUnique(a, [{ id: "2" }, { id: "3" }, { id: "3" }]).map((i) => i.id), ["1", "2", "3"]);
});

test("parseFeedParams validates and bounds its input", () => {
  const p = (s) => parseFeedParams(new URLSearchParams(s));
  assert.deepEqual(p(""), { query: "", tagId: null, offset: 0 });
  assert.deepEqual(p("q=bkash&topic=b0000000-0000-4000-8000-000000000001&offset=18"), { query: "bkash", tagId: "b0000000-0000-4000-8000-000000000001", offset: 18 });
  assert.equal(p("topic=not-a-uuid").tagId, null);
  assert.equal(p("offset=-5").offset, 0);
  assert.equal(p("offset=abc").offset, 0);
  assert.equal(p("offset=99999999").offset, 100000);
  assert.equal(p(`q=${"x".repeat(500)}`).query.length, 100);
});

test("isValidSlug mirrors the slug format constraint", () => {
  assert.equal(isValidSlug("bkash-agents-distribution-moat"), true);
  for (const bad of ["", "Bkash", "a--b", "-a", "a-", "a/b", "a b", "../x"]) assert.equal(isValidSlug(bad), false, bad);
});

test("viewerSlugFromPath", () => {
  assert.equal(viewerSlugFromPath("/analysis/bkash-agents"), "bkash-agents");
  assert.equal(viewerSlugFromPath("/analysis/bkash-agents/"), "bkash-agents");
  assert.equal(viewerSlugFromPath("/analysis"), null);
  assert.equal(viewerSlugFromPath("/analysis/a/b"), null);
  assert.equal(viewerSlugFromPath(null), null);
});
