import { test } from "node:test";
import assert from "node:assert/strict";
import {
  articleBodyBytes,
  articleImagePaths,
  BODY_MAX_BYTES,
  MAX_FIGURES,
  hasArticleContent,
  normalizeLinkInput,
  parseArticleBody,
  readStoredArticleBody,
  safeLinkHref,
} from "../../lib/article-body.ts";
import { isArticleLinkVisible } from "../../lib/article-links.ts";
import {
  articleMediaPrefix,
  isArticleCoverPath,
  isArticleImagePath,
  newArticleCoverPath,
  newArticleImagePath,
} from "../../lib/media.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const IMG = `articles/${ID}/image-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`;
const doc = (...content) => JSON.stringify({ type: "doc", content });
const p = (...content) => ({ type: "paragraph", content });
const t = (text, marks) => (marks ? { type: "text", text, marks } : { type: "text", text });
const parse = (body, id = ID) => parseArticleBody(typeof body === "string" ? body : JSON.stringify(body), id);

test("a full, normal article passes and is normalised (extra attrs dropped)", () => {
  const input = doc(
    { type: "heading", attrs: { level: 2, id: "x" }, content: [t("Market context")] },
    p(t("Plain, "), t("bold", [{ type: "bold" }]), t(" and "), t("italic", [{ type: "italic" }]), { type: "hardBreak" }, t("source", [{ type: "link", attrs: { href: "https://example.com/report", target: "_blank", rel: "x", class: "evil" } }])),
    { type: "heading", attrs: { level: 3 }, content: [t("Sub")] },
    { type: "bulletList", content: [{ type: "listItem", content: [p(t("one"))] }, { type: "listItem", content: [p(t("two")), { type: "orderedList", attrs: { start: 1, type: null }, content: [{ type: "listItem", content: [p(t("nested"))] }] }] }] },
    { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(t("three"))] }] },
    { type: "blockquote", content: [p(t("A quote."))] },
    { type: "figure", attrs: { path: IMG, alt: " Chart ", caption: " Source: BBS ", src: "javascript:alert(1)" } },
    { type: "paragraph" },
  );
  const r = parse(input);
  assert.equal(r.ok, true, r.error);
  const linkMark = r.value.content[1].content[5].marks[0];
  assert.deepEqual(linkMark, { type: "link", attrs: { href: "https://example.com/report" } });
  assert.deepEqual(r.value.content[0], { type: "heading", attrs: { level: 2 }, content: [t("Market context")] });
  assert.deepEqual(r.value.content[6], { type: "figure", attrs: { path: IMG, alt: "Chart", caption: "Source: BBS" } });
  assert.deepEqual(r.value.content[3].content[1].content[1].attrs, { start: 1 });
  assert.deepEqual(articleImagePaths(r.value), [IMG]);
  assert.equal(hasArticleContent(r.value), true);
});

test("XSS: unsafe links are rejected", () => {
  for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "//evil.example", "/relative", "https://exa mple.com", 'https://x.com/"onmouseover="x', "ftp://example.com", ""]) {
    const r = parse(doc(p(t("x", [{ type: "link", attrs: { href } }]))));
    assert.equal(r.ok, false, href);
  }
  assert.equal(safeLinkHref("mailto:desk@mktbd.co"), "mailto:desk@mktbd.co");
  assert.equal(safeLinkHref("http://example.com"), "http://example.com");
});

test("XSS: unknown nodes, marks and HTML-ish payloads are rejected, never stored", () => {
  const cases = [
    doc({ type: "html", content: [t("<script>alert(1)</script>")] }),
    doc({ type: "iframe", attrs: { src: "https://evil.example" } }),
    doc({ type: "image", attrs: { src: "https://evil.example/x.png" } }),
    doc({ type: "codeBlock", content: [t("x")] }),
    doc(p(t("x", [{ type: "textStyle", attrs: { style: "background:url(javascript:alert(1))" } }]))),
    doc(p(t("x", [{ type: "bold" }, { type: "bold" }]))),
    doc(p({ type: "mention", attrs: { id: "x" } })),
    doc({ type: "heading", attrs: { level: 1 }, content: [t("H1")] }),
    doc({ type: "heading", attrs: { level: 4 }, content: [t("H4")] }),
    JSON.stringify({ type: "notdoc", content: [] }),
    "not json",
    JSON.stringify([]),
  ];
  for (const body of cases) assert.equal(parseArticleBody(body, ID).ok, false, body.slice(0, 80));
  // Text that merely looks like HTML is kept as text (rendered as text, not markup).
  const r = parse(doc(p(t("<img src=x onerror=alert(1)>"))));
  assert.equal(r.ok, true);
  assert.equal(r.value.content[0].content[0].text, "<img src=x onerror=alert(1)>");
});

test("images: only this Article's uploads; none before the first save", () => {
  const fig = (path) => doc({ type: "figure", attrs: { path, alt: "", caption: "" } });
  assert.equal(parse(fig(IMG)).ok, true);
  for (const path of [
    `articles/${OTHER}/image-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`,
    `articles/${ID}/cover-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`,
    `analysis/${ID}/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`,
    "https://evil.example/x.png",
    `articles/${ID}/image-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.svg`,
    `articles/${ID}/../x/image-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`,
  ]) assert.equal(parse(fig(path)).ok, false, path);
  assert.equal(parseArticleBody(fig(IMG), null).ok, false, "no images before the article exists");
  assert.equal(parse(doc({ type: "figure", attrs: { path: IMG, alt: "x".repeat(301), caption: "" } })).ok, false);
  assert.equal(parse(doc({ type: "figure", attrs: { path: IMG, alt: "", caption: "x".repeat(501) } })).ok, false);
});

test("limits and structure: empty lists/quotes, depth, size", () => {
  assert.equal(parse(doc({ type: "bulletList", content: [] })).ok, false);
  assert.equal(parse(doc({ type: "blockquote", content: [] })).ok, false);
  assert.equal(parse(doc({ type: "orderedList", attrs: { start: 0 }, content: [{ type: "listItem", content: [p(t("x"))] }] })).ok, false);
  let deep = p(t("x"));
  for (let i = 0; i < 20; i++) deep = { type: "blockquote", content: [deep] };
  assert.equal(parse(doc(deep)).ok, false);
  assert.equal(parseArticleBody("x".repeat(1_000_001), ID).ok, false);
  assert.equal(parse(doc(p(t("x".repeat(20_001))))).ok, false);
  assert.equal(parse(doc(p({ type: "text", text: "" }))).ok, false);
});

test("size is measured in UTF-8 bytes (Bangla text counts ~3 bytes/char); figures are capped", () => {
  const bangla = "বাংলাদেশ";
  assert.equal(articleBodyBytes(bangla), bangla.length * 3);
  const chunk = "ব".repeat(10_000);
  const big = doc(...Array.from({ length: Math.ceil(BODY_MAX_BYTES / 30_000) + 1 }, () => p(t(chunk))));
  assert.ok(big.length < BODY_MAX_BYTES, "under the limit in characters");
  assert.equal(parseArticleBody(big, ID).ok, false, "over the limit in bytes");
  const fig = { type: "figure", attrs: { path: IMG, alt: "", caption: "" } };
  assert.equal(parse(doc(...Array(MAX_FIGURES).fill(fig))).ok, true);
  assert.equal(parse(doc(...Array(MAX_FIGURES + 1).fill(fig))).ok, false);
});

test("empty body: '' and an empty doc are valid but have no content", () => {
  for (const body of ["", doc(), doc({ type: "paragraph" }), doc(p(t("   ")))]) {
    const r = parseArticleBody(body, ID);
    assert.equal(r.ok, true);
    assert.equal(hasArticleContent(r.value), false);
  }
});

test("stored bodies are re-validated before rendering; invalid ones render empty", () => {
  assert.deepEqual(readStoredArticleBody({ type: "doc", content: [{ type: "script" }] }, ID), { type: "doc", content: [] });
  assert.equal(readStoredArticleBody(JSON.parse(doc(p(t("ok")))), ID).content.length, 1);
});

test("link input normalisation", () => {
  assert.equal(normalizeLinkInput("example.com/report"), "https://example.com/report");
  assert.equal(normalizeLinkInput("  https://bb.org.bd/x "), "https://bb.org.bd/x");
  assert.equal(normalizeLinkInput("desk@mktbd.co"), "mailto:desk@mktbd.co");
  assert.equal(normalizeLinkInput("javascript:alert(1)"), null);
  assert.equal(normalizeLinkInput(""), null);
});

test("article media paths", () => {
  assert.equal(articleMediaPrefix(ID), `articles/${ID}/`);
  const cover = newArticleCoverPath(ID, "image/jpeg");
  const image = newArticleImagePath(ID, "image/webp");
  assert.equal(isArticleCoverPath(ID, cover), true);
  assert.equal(isArticleImagePath(ID, image), true);
  assert.equal(isArticleCoverPath(ID, image), false);
  assert.equal(isArticleImagePath(OTHER, image), false);
});

test("Read Article / See Visual Story visibility: toggle on + linked + both published", () => {
  const base = { readArticleEnabled: true, linkedArticleId: ID, analysisStatus: "published", articleStatus: "published" };
  assert.equal(isArticleLinkVisible(base), true);
  assert.equal(isArticleLinkVisible({ ...base, readArticleEnabled: false }), false);
  assert.equal(isArticleLinkVisible({ ...base, linkedArticleId: null }), false);
  assert.equal(isArticleLinkVisible({ ...base, analysisStatus: "draft" }), false);
  assert.equal(isArticleLinkVisible({ ...base, articleStatus: "draft" }), false);
  assert.equal(isArticleLinkVisible({ ...base, articleStatus: null }), false);
});
