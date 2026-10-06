import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CASE_STUDY_PAGE_SIZE,
  caseStudyPage,
  caseStudyTopics,
  descriptionParagraphs,
  filterCaseStudies,
  toCaseStudyEntry,
  toListItem,
} from "../../lib/case-study-archive.ts";
import { formatMonthYear } from "../../lib/format.ts";

const url = (path) => `https://cdn.test/${path}`;
const row = (over = {}) => ({
  id: "c1",
  title: "Inside Pathao's Super-App Bet",
  slug: "pathao-super-app",
  cover_image_path: "case-studies/c1/cover.png",
  short_description: "How ride-hailing became a platform for payments and food.",
  price_bdt: "999.00",
  publication_date: "2026-09-12",
  case_study_tags: [{ tags: { id: "t2", name: "Mobility" } }, { tags: { id: "t1", name: "Fintech" } }, { tags: null }],
  ...over,
});

test("toCaseStudyEntry: public cover URL, numeric price, tags A-Z, topics from tags", () => {
  const entry = toCaseStudyEntry(row(), url);
  assert.equal(entry.coverUrl, url("case-studies/c1/cover.png"));
  assert.equal(entry.priceBdt, 999);
  assert.deepEqual(entry.tags, [{ id: "t1", name: "Fintech" }, { id: "t2", name: "Mobility" }]);
  assert.deepEqual(entry.topics, ["Fintech", "Mobility"]);
});

test("toCaseStudyEntry: blank cover / description become null; no tags is fine", () => {
  const entry = toCaseStudyEntry(row({ cover_image_path: "  ", short_description: "", case_study_tags: null }), url);
  assert.equal(entry.coverUrl, null);
  assert.equal(entry.shortDescription, null);
  assert.deepEqual(entry.tags, []);
  assert.equal(toCaseStudyEntry(row({ cover_image_path: null }), url).coverUrl, null);
});

test("toListItem: list rows never carry tag ids", () => {
  const item = toListItem(toCaseStudyEntry(row(), url));
  assert.equal("tags" in item, false);
  assert.deepEqual(Object.keys(item).sort(), [
    "coverUrl",
    "id",
    "priceBdt",
    "publicationDate",
    "shortDescription",
    "slug",
    "title",
    "topics",
  ]);
});

const entries = Array.from({ length: 31 }, (_, i) =>
  toCaseStudyEntry(
    row({
      id: `c${i}`,
      slug: `case-${i}`,
      title: i === 20 ? "Growth at 50% Margin" : i === 25 ? "snake_case Pricing Lessons" : `Case ${i}`,
      short_description: i === 17 ? "A study of the Garments export cluster" : `Description ${i}`,
      case_study_tags: i === 28 ? [{ tags: { id: "tz", name: "Zebra Topic" } }] : [{ tags: { id: "t1", name: "Fintech" } }],
    }),
    url,
  ),
);

test("filterCaseStudies: title, short description and tag names; case-insensitive and partial", () => {
  assert.deepEqual(filterCaseStudies(entries, "GROWTH at", null).map((e) => e.id), ["c20"]);
  assert.deepEqual(filterCaseStudies(entries, "garments  EXPORT", null).map((e) => e.id), ["c17"]);
  assert.deepEqual(filterCaseStudies(entries, "zebra", null).map((e) => e.id), ["c28"]);
  assert.equal(filterCaseStudies(entries, "", null).length, 31);
  assert.equal(filterCaseStudies(entries, "   ", null).length, 31);
});

test("filterCaseStudies: % and _ are literal characters", () => {
  assert.deepEqual(filterCaseStudies(entries, "50%", null).map((e) => e.id), ["c20"]);
  assert.deepEqual(filterCaseStudies(entries, "%", null).map((e) => e.id), ["c20"]);
  assert.deepEqual(filterCaseStudies(entries, "_", null).map((e) => e.id), ["c25"]);
  assert.deepEqual(filterCaseStudies(entries, "snake_c", null).map((e) => e.id), ["c25"]);
});

test("filterCaseStudies: topic alone and combined with search", () => {
  assert.equal(filterCaseStudies(entries, "", "t1").length, 30);
  assert.deepEqual(filterCaseStudies(entries, "", "tz").map((e) => e.id), ["c28"]);
  assert.deepEqual(filterCaseStudies(entries, "case 2", "tz").map((e) => e.id), ["c28"]);
  assert.deepEqual(filterCaseStudies(entries, "growth", "tz"), []);
});

test("caseStudyPage: batches of 12 in order, final partial batch, totals", () => {
  assert.equal(CASE_STUDY_PAGE_SIZE, 12);
  const first = caseStudyPage(entries, { query: "", tagId: null, offset: 0 });
  const second = caseStudyPage(entries, { query: "", tagId: null, offset: 12 });
  const third = caseStudyPage(entries, { query: "", tagId: null, offset: 24 });
  assert.deepEqual([first.items.length, second.items.length, third.items.length], [12, 12, 7]);
  assert.equal(first.total, 31);
  assert.deepEqual(
    [...first.items, ...second.items, ...third.items].map((e) => e.id),
    entries.map((e) => e.id),
  );
  assert.equal("tags" in first.items[0], false);
  assert.deepEqual(caseStudyPage(entries, { query: "", tagId: null, offset: 40 }).items, []);
});

test("caseStudyTopics: each tag once, A-Z", () => {
  assert.deepEqual(caseStudyTopics(entries), [{ id: "t1", name: "Fintech" }, { id: "tz", name: "Zebra Topic" }]);
});

test("descriptionParagraphs: blank lines split paragraphs; CRLF; trims; empty -> []", () => {
  assert.deepEqual(descriptionParagraphs("One\nline two\r\n\r\n  Two  \n\n\n\nThree"), ["One\nline two", "Two", "Three"]);
  assert.deepEqual(descriptionParagraphs("<b>not html</b>"), ["<b>not html</b>"]);
  assert.deepEqual(descriptionParagraphs(null), []);
  assert.deepEqual(descriptionParagraphs(" \n \n "), []);
});

test("formatMonthYear: month and year, no timezone shift", () => {
  assert.equal(formatMonthYear("2026-09-12"), "September 2026");
  assert.equal(formatMonthYear("2026-01-01"), "January 2026");
  assert.equal(formatMonthYear("bad"), "bad");
});
