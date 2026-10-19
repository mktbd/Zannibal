// Level 2 QA (Stage 3B): the CMS publishing lifecycle in a real browser against the local Worker and the
// DISPOSABLE local QA Supabase.
//
// Usage: node scripts/qa/cms-probe.mjs <base> --out result.json [--throttle]   (run by scripts/qa/local.sh)
// Env (local QA values only): QA_API_URL, QA_SERVICE_ROLE_KEY, QA_DB_URL, QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD.
//
// For an Analysis, an Article and a Case Study, driven through the admin UI as the seeded admin:
// create a draft (not publicly discoverable), refused publishing attempts (record unchanged), media
// (slides, covers, inline images: upload, reorder, replace, remove, Storage cleanup), publish (detail page,
// archive, feeds, sitemap), edit while published (public freshness), unpublish (gone from public views)
// and delete (record, slides, tag links, article link and Storage folder removed; orders kept). Tags:
// create, duplicate refusal, inline create, assignment, archive filtering, rename, delete refused while in
// use, delete once unused. Every state claim is read back from the database (psql as the table owner),
// Storage (storage.objects) or the public site; nothing trusts the UI's own message alone.
// Synthetic records only (slugs qa-cms-*, tags "QA CMS *", order email qa-cms-buyer@example.test),
// removed at the start and the end, and the removal is verified. Refuses to run unless the target is the
// local QA stack and the local Worker.
import { createClient } from "@supabase/supabase-js";
import { spawnSync, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import zlib from "node:zlib";
import { LOCAL_API, LOCAL_DB } from "./rls-probe.mjs";

const args = process.argv.slice(2);
const BASE = (args[0] || "").replace(/\/$/, "");
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
const THROTTLE = args.includes("--throttle");
const env = process.env;
const refuse = (why) => { console.error(`REFUSED: ${why}`); process.exit(97); };
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)) refuse("the target is not a local Worker (http://127.0.0.1:<port>).");
if (!LOCAL_API.test(env.QA_API_URL || "")) refuse("QA_API_URL is not the local QA API.");
if (!LOCAL_DB.test(env.QA_DB_URL || "")) refuse("QA_DB_URL is not the local QA database.");
for (const k of ["QA_SERVICE_ROLE_KEY", "QA_ADMIN_EMAIL", "QA_ADMIN_PASSWORD"]) if (!env[k]) refuse(`${k} is not set.`);

const sql = (q) => {
  const r = spawnSync("psql", [env.QA_DB_URL, "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`SQL failed: ${(r.stderr || "").split("\n")[0].slice(0, 120)}`);
  return r.stdout.trim();
};
if (sql("select count(*) from pg_namespace where nspname = 'qa_disposable'") !== "1") refuse("the database has no qa_disposable marker.");

const loadPlaywright = async () => { try { return await import("playwright"); } catch { return createRequire(execSync("npm root -g").toString().trim() + "/")("playwright"); } };
const BUCKET = "editorial-media";
const RUN = randomUUID().slice(0, 6);
const BUYER = "qa-cms-buyer@example.test";
const quote = (v) => `'${String(v).replace(/'/g, "''")}'`;
const service = createClient(env.QA_API_URL, env.QA_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = [];
const check = (lifecycle, operation, expected, actual, ok, detail = "") => {
  rows.push({ lifecycle, operation, expected, actual, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${lifecycle}] ${operation} — expected ${expected}, got ${actual}${detail ? `; ${detail}` : ""}`);
};

/** A small solid-colour PNG; distinct colours give distinct objects. */
function png(r, g, b, w = 4, h = 3) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const image = (name, rgb) => ({ name, mimeType: "image/png", buffer: png(...rgb) });

// ---- database / Storage read-back
const SNAP = {
  analyses: `md5(a::text || coalesce((select string_agg(storage_path || ':' || position, ',' order by position) from public.analysis_slides where analysis_id = a.id), '') || coalesce((select string_agg(tag_id::text, ',' order by tag_id) from public.analysis_tags where analysis_id = a.id), '') || coalesce((select l::text from public.analysis_article_links l where l.analysis_id = a.id), ''))`,
  articles: `md5(a::text || coalesce((select string_agg(tag_id::text, ',' order by tag_id) from public.article_tags where article_id = a.id), ''))`,
  case_studies: `md5(a::text || coalesce((select string_agg(tag_id::text, ',' order by tag_id) from public.case_study_tags where case_study_id = a.id), ''))`,
};
const snap = (table, id) => sql(`select coalesce((select ${SNAP[table]} from public.${table} a where id = '${id}'), 'absent')`);
const field = (table, id, col) => sql(`select coalesce((select ${col}::text from public.${table} where id = '${id}'), '<absent>')`);
const count = (q) => Number(sql(`select count(*) from ${q}`));
const objects = (prefix) => sql(`select coalesce(string_agg(name, ',' order by name), '') from storage.objects where bucket_id = '${BUCKET}' and name like ${quote(prefix + "%")}`).split(",").filter(Boolean);
const stored = (name) => count(`storage.objects where bucket_id = '${BUCKET}' and name = ${quote(name)}`) === 1;
const slidePaths = (id) => sql(`select coalesce(string_agg(storage_path, ',' order by position), '') from public.analysis_slides where analysis_id = '${id}'`).split(",").filter(Boolean);
const tagId = (name) => sql(`select coalesce((select id::text from public.tags where name = ${quote(name)}), '')`);

// ---- public site
const get = async (p) => {
  try { const r = await fetch(BASE + p, { redirect: "manual" }); return { status: r.status, text: await r.text() }; }
  catch { return { status: "network error", text: "" }; }
};
/** Polls `test` (1 s apart) for up to `secs`; returns the seconds it took, or -1. */
async function eventually(test, secs = 60) {
  const start = Date.now();
  for (;;) {
    if (await test()) return Math.round((Date.now() - start) / 1000);
    if (Date.now() - start > secs * 1000) return -1;
    await sleep(1000);
  }
}
const seen = (s) => (s < 0 ? "not within 60 s" : `within ~${s} s`);

// ---- browser
let browser, page, context;
const interactive = (selector, timeout = 15000) =>
  page.waitForFunction((sel) => { const el = document.querySelector(sel); return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$")); }, selector, { timeout, polling: "raf" }).then(() => true, () => false);
const isUpload = (r) => r.request().method() === "POST" && /\/storage\/v1\/object\/editorial-media\//.test(r.url());
const uploadedPath = (r) => decodeURIComponent(new URL(r.url()).pathname.split(`/storage/v1/object/${BUCKET}/`)[1]);

async function openEditor(url) {
  await page.goto(BASE + url);
  if (!(await interactive("#title"))) throw new Error(`the editor at ${url.replace(/[0-9a-f-]{36}/g, "<id>")} never became interactive`);
}
/**
 * Clicks a submit button and waits for the Server Action's outcome: a redirect with ?notice= (saved),
 * or the form-level error summary (refused). Returns { saved, notice, text } with the page's text.
 */
async function submit(label) {
  const before = page.url();
  const summary = page.locator('div[role="alert"][tabindex="-1"]');
  const hadSummary = await summary.isVisible().catch(() => false);
  const action = page.waitForResponse((r) => r.request().method() === "POST" && r.url().startsWith(BASE), { timeout: 45000 }).catch(() => null);
  await page.getByRole("button", { name: label, exact: true }).first().click({ timeout: 15000 });
  const response = await action;
  // A summary already on screen (an earlier refusal) can't signal a new one, so then a refusal is
  // "no redirect within 5 s of the action's response".
  const redirected = page.waitForURL((u) => u.href !== before && u.searchParams.has("notice"), { timeout: 30000 }).then(() => "saved", () => "timeout");
  const refused = hadSummary ? sleep(5000).then(() => "refused") : summary.waitFor({ state: "visible", timeout: 30000 }).then(() => "refused", () => "timeout");
  const saved = (await Promise.race([redirected, refused])) === "saved";
  await page.waitForLoadState("load").catch(() => {});
  const u = new URL(page.url());
  return { saved, notice: u.searchParams.get("notice"), problem: u.searchParams.get("problem"), text: await page.locator("main").innerText().catch(() => ""), response: response ? response.status() : "no request" };
}
const describe = (r) => (r.saved ? `saved (notice=${r.notice}${r.problem ? `, problem=${r.problem}` : ""})` : `refused (HTTP ${r.response})`);
const idFrom = () => (/\/([0-9a-f-]{36})\/edit/.exec(new URL(page.url()).pathname) || [])[1] || null;

async function addTag(name, create = false) {
  const input = page.getByPlaceholder("Search or create a tag");
  await input.fill(name);
  const options = page.getByRole("option").filter({ hasText: name });
  const option = create ? options.filter({ hasText: "Create tag" }) : options.filter({ hasNotText: "Create tag" });
  await option.first().click({ timeout: 15000 });
  await page.getByRole("button", { name: `Remove tag ${name}` }).waitFor({ timeout: 15000 });
}
async function uploadCover(file) {
  if (!(await interactive("#cover-file"))) return null;
  const response = page.waitForResponse(isUpload, { timeout: 30000 }).catch(() => null);
  await page.setInputFiles("#cover-file", file);
  const r = await response;
  if (!r?.ok()) return null;
  await page.getByText("Cover uploaded. Save to keep it.").waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
  return uploadedPath(r);
}
async function uploadSlides(files) {
  if (!(await interactive("#slide-files"))) return [];
  const paths = [];
  const onResponse = (r) => { if (isUpload(r) && r.ok()) paths.push(uploadedPath(r)); };
  page.on("response", onResponse);
  await page.setInputFiles("#slide-files", files);
  await page.getByText(/uploaded\. Save to keep/).waitFor({ state: "attached", timeout: 30000 }).catch(() => {});
  for (let i = 0; i < 20 && paths.length < files.length; i++) await sleep(250);
  page.off("response", onResponse);
  return paths;
}
/** Overwrites a hidden form field just before submitting (a stale or forged editor state). */
const forge = (name, value) => page.evaluate(([n, v]) => { document.querySelector(`input[type="hidden"][name="${n}"]`).value = v; }, [name, value]);

// ---- synthetic records
const created = new Set();
const T = {
  analysis: { table: "analyses", admin: "/admin/analysis", pub: "/analysis", feed: "/api/analysis", label: "Analysis", title: `QA CMS Analysis ${RUN}`, slug: `qa-cms-analysis-${RUN}` },
  article: { table: "articles", admin: "/admin/articles", pub: "/articles", feed: null, label: "Article", title: `QA CMS Article ${RUN}`, slug: `qa-cms-article-${RUN}` },
  caseStudy: { table: "case_studies", admin: "/admin/case-studies", pub: "/case-studies", feed: "/api/case-studies", label: "Case Study", title: `QA CMS Case Study ${RUN}`, slug: `qa-cms-case-study-${RUN}` },
};
const TAG_A = `QA CMS Tag A ${RUN}`, TAG_A2 = `QA CMS Tag A renamed ${RUN}`, TAG_B = `QA CMS Tag B ${RUN}`;

async function cleanup() {
  const ids = sql("select coalesce(string_agg(id::text, ' '), '') from (select id from public.analyses where slug like 'qa-cms-%' union all select id from public.articles where slug like 'qa-cms-%' union all select id from public.case_studies where slug like 'qa-cms-%') x").split(" ").filter(Boolean);
  for (const id of ids) created.add(id);
  if (created.size) {
    const names = sql(`select coalesce(string_agg(name, ' '), '') from storage.objects where bucket_id = '${BUCKET}' and (${[...created].map((id) => `name like '%/${id}/%'`).join(" or ")})`).split(" ").filter(Boolean);
    if (names.length) await service.storage.from(BUCKET).remove(names).catch(() => {});
  }
  sql(`delete from public.orders where customer_email = '${BUYER}';
    delete from public.analyses where slug like 'qa-cms-%'; delete from public.articles where slug like 'qa-cms-%'; delete from public.case_studies where slug like 'qa-cms-%';
    delete from public.tags where name like 'QA CMS %';`);
}
const leftovers = () => count("public.analyses where slug like 'qa-cms-%'") + count("public.articles where slug like 'qa-cms-%'") + count("public.case_studies where slug like 'qa-cms-%'") +
  count("public.tags where name like 'QA CMS %'") + count(`public.orders where customer_email = '${BUYER}'`) +
  (created.size ? count(`storage.objects where bucket_id = '${BUCKET}' and (${[...created].map((id) => `name like '%/${id}/%'`).join(" or ")})`) : 0);

let setupFailed = null, step = "setup";
try {
  await cleanup(); // a crashed earlier run must not leave fixtures behind
  if (sql(`select p.role from public.profiles p join auth.users u on u.id = p.id where u.email = ${quote(env.QA_ADMIN_EMAIL)}`) !== "admin") throw new Error("the seeded admin account is not an admin");
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));
  if (THROTTLE) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 100, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  }
  await page.goto(BASE + "/admin/login");
  await page.fill('input[name="email"]', env.QA_ADMIN_EMAIL);
  await page.fill('input[name="password"]', env.QA_ADMIN_PASSWORD);
  await Promise.all([page.waitForURL((u) => u.pathname !== "/admin/login" || u.searchParams.has("error"), { timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);
  if (new URL(page.url()).pathname !== "/admin") throw new Error("admin sign-in failed");
} catch (e) { setupFailed = e.message; }

if (!setupFailed) {
  try {
    const a = T.analysis, r = T.article, c = T.caseStudy;

    // ================= Tags (1/3): create and duplicate refusal
    step = "tags: create";
    await page.goto(BASE + "/admin/tags");
    await interactive("#new-tag-name");
    const createTag = async (name) => {
      await page.fill("#new-tag-name", name);
      await page.getByRole("button", { name: "Create tag", exact: true }).click();
      await page.locator("#new-tag-feedback").filter({ hasText: /\S/ }).waitFor({ timeout: 20000 }).catch(() => {});
      return (await page.locator("#new-tag-feedback").innerText().catch(() => "")).trim();
    };
    let msg = await createTag(TAG_A);
    check("tags", "create a tag on the Tags screen", "created, one row", `"${msg.slice(0, 60)}", rows ${count(`public.tags where name = ${quote(TAG_A)}`)}`, count(`public.tags where name = ${quote(TAG_A)}`) === 1);
    const tagsBefore = count("public.tags");
    await page.reload(); await interactive("#new-tag-name");
    msg = await createTag(`  ${TAG_A.toUpperCase()}  `);
    check("tags", "create a duplicate (other case, extra spaces)", "refused, no row added", `"${msg.slice(0, 60)}", rows ${count("public.tags") - tagsBefore} added`, /already exists/.test(msg) && count("public.tags") === tagsBefore);
    const idA = tagId(TAG_A);
    // A second tab keeps the Tags screen open from before the tag is used (its Delete button still shown).
    const tagsTab = await context.newPage();
    await tagsTab.goto(BASE + "/admin/tags");

    // ================= Create drafts
    step = "create drafts";
    // Article: tag A, and tag B created inline from the editor.
    await openEditor(`${r.admin}/new`);
    await page.fill("#title", r.title); await page.fill("#slug", r.slug); await page.fill("#shortDescription", "QA CMS synthetic article.");
    await addTag(TAG_A); await addTag(TAG_B, true);
    let res = await submit("Save draft");
    r.id = idFrom(); if (r.id) created.add(r.id);
    check("article", "create a draft (with an existing and an inline-created tag)", "created as draft, 2 tag links", `${describe(res)}, status ${r.id ? field("articles", r.id, "status") : "-"}, links ${r.id ? count(`public.article_tags where article_id = '${r.id}'`) : 0}`,
      res.notice === "created" && r.id && field("articles", r.id, "status") === "draft" && count(`public.article_tags where article_id = '${r.id}'`) === 2);
    check("tags", "inline create from an editor", "tag row exists", `${count(`public.tags where name = ${quote(TAG_B)}`)} row(s)`, count(`public.tags where name = ${quote(TAG_B)}`) === 1);
    const idB = tagId(TAG_B);

    await openEditor(`${a.admin}/new`);
    await page.fill("#title", a.title); await page.fill("#slug", a.slug);
    await addTag(TAG_A);
    res = await submit("Save draft");
    a.id = idFrom(); if (a.id) created.add(a.id);
    check("analysis", "create a draft", "created as draft, 1 tag link", `${describe(res)}, status ${a.id ? field("analyses", a.id, "status") : "-"}`,
      res.notice === "created" && a.id && field("analyses", a.id, "status") === "draft" && count(`public.analysis_tags where analysis_id = '${a.id}'`) === 1);

    // Case Study: an invalid price is refused at creation (no row), then accepted once corrected.
    await openEditor(`${c.admin}/new`);
    await page.fill("#title", c.title); await page.fill("#slug", c.slug); await page.fill("#priceBdt", "12.345");
    await addTag(TAG_A);
    res = await submit("Save draft");
    check("rules", "Case Study: create with an invalid price (12.345)", "refused, no record", `${describe(res)}, ${count(`public.case_studies where slug = '${c.slug}'`)} record(s)`,
      !res.saved && /Enter an amount in BDT/.test(res.text) && count(`public.case_studies where slug = '${c.slug}'`) === 0);
    await page.fill("#priceBdt", "1500");
    res = await submit("Save draft");
    c.id = idFrom(); if (c.id) created.add(c.id);
    check("case study", "create a draft (price corrected)", "created as draft, price 1500", `${describe(res)}, price ${c.id ? field("case_studies", c.id, "price_bdt") : "-"}`,
      res.notice === "created" && c.id && field("case_studies", c.id, "status") === "draft" && Number(field("case_studies", c.id, "price_bdt")) === 1500);
    if (!a.id || !r.id || !c.id) throw new Error("a draft could not be created");

    // ================= Drafts are not publicly discoverable
    step = "draft confidentiality";
    const publicViews = async (t) => {
      const [detail, archive, sitemap, home, feed] = await Promise.all([get(`${t.pub}/${t.slug}`), get(t.pub), get("/sitemap.xml"), get("/"), t.feed ? get(`${t.feed}?q=${encodeURIComponent(t.title)}`) : null]);
      return { detail: detail.status, archive: archive.text.includes(t.title), sitemap: sitemap.text.includes(`${t.pub}/${t.slug}`), home: home.text.includes(t.title), feed: feed ? feed.text.includes(t.slug) : false, network: [detail, archive, sitemap, home].some((x) => x.status === "network error") };
    };
    for (const [name, t] of [["analysis", a], ["article", r], ["case study", c]]) {
      const v = await publicViews(t);
      check(name, "draft: detail page, archive, feed, sitemap, homepage", "404 and absent everywhere", v.network ? "network error" : `detail ${v.detail}; listed in ${["archive", "feed", "sitemap", "home"].filter((k) => v[k]).join(", ") || "none"}`,
        v.detail === 404 && !v.archive && !v.feed && !v.sitemap && !v.home);
    }
    { const v = await get(`/api/analysis/${a.slug}`); check("analysis", "draft: slide API", "404", v.status, v.status === 404); }

    // ================= Publishing rules (each refused save leaves the record unchanged)
    step = "publishing rules";
    const refusedCase = async (name, operation, t, expectText, act, button = "Publish") => {
      await openEditor(`${t.admin}/${t.id}/edit`);
      const before = snap(t.table, t.id);
      await act();
      const res = await submit(button);
      const same = snap(t.table, t.id) === before;
      check(name, operation, "refused with a field message, record unchanged", `${describe(res)}, message ${expectText.test(res.text) ? "shown" : "MISSING"}, record ${same ? "unchanged" : "CHANGED"}`, !res.saved && expectText.test(res.text) && same);
    };
    await refusedCase("rules", "Analysis: publish with no slides", a, /Add at least one slide before publishing/, async () => {});
    await refusedCase("rules", "Article: publish with an empty body", r, /Write the article body before publishing/, async () => {});
    { // all four messages, checked individually on one refused publish
      await openEditor(`${c.admin}/${c.id}/edit`);
      const before = snap("case_studies", c.id);
      await page.fill("#priceBdt", "0");
      const res = await submit("Publish");
      const msgs = { cover: /Add a cover image before publishing/, price: /Set a price above 0 before publishing/, required: /Required to publish\./ };
      const missing = Object.keys(msgs).filter((k) => !msgs[k].test(res.text));
      check("rules", "Case Study: publish with price 0, no cover, empty descriptions/industry/page count", "refused: cover, price and required-field messages; record unchanged", `${describe(res)}, missing messages: ${missing.join(", ") || "none"}, record ${snap("case_studies", c.id) === before ? "unchanged" : "CHANGED"}`,
        !res.saved && missing.length === 0 && snap("case_studies", c.id) === before);
    }
    await refusedCase("rules", "Case Study: save with a malformed price (1.2.3)", c, /Enter an amount in BDT/, async () => { await page.fill("#priceBdt", "1.2.3"); }, "Save draft");
    await refusedCase("rules", "Case Study: save with a negative page count", c, /Page count must be a whole number of at least 1/, async () => { await page.fill("#pageCount", "-3"); }, "Save draft");
    await refusedCase("rules", "Analysis: save with an empty title", a, /Enter a title\./, async () => { await page.fill("#title", "   "); }, "Save draft");
    await refusedCase("rules", "Analysis: save with an invalid LinkedIn URL", a, /Enter a full URL starting with https/, async () => { await page.fill("#linkedinUrl", "javascript:alert(1)"); }, "Save draft");
    const takenSlug = sql("select coalesce((select slug from public.articles where slug not like 'qa-%' order by created_at limit 1), '')");
    if (takenSlug) await refusedCase("rules", "Article: save with another Article's slug", r, /is already used by the Article/, async () => { await page.fill("#slug", takenSlug); }, "Save draft");
    else check("rules", "Article: save with another Article's slug", "refused", "not run: no seeded Article", false);

    // Failed saves with media that does not exist (an upload that never finished, or another record's file).
    step = "media consistency";
    const coverPrefix = `case-studies/${c.id}/`, slidePrefix = `analysis/${a.id}/`, articlePrefix = `articles/${r.id}/`;
    await refusedCase("media", "Case Study: save pointing at a cover that was never uploaded", c, /The cover upload didn.t finish/, async () => { await forge("coverPath", `${coverPrefix}cover-${randomUUID()}.png`); }, "Save draft");
    await refusedCase("media", "Case Study: save pointing at another record's file", c, /The cover image is invalid/, async () => { await forge("coverPath", `case-studies/${randomUUID()}/cover-${randomUUID()}.png`); }, "Save draft");
    await refusedCase("media", "Analysis: save a slide that was never uploaded", a, /A slide upload didn.t finish/, async () => { await forge("slides", JSON.stringify([{ id: null, path: `${slidePrefix}${randomUUID()}.png` }])); }, "Save draft");
    await refusedCase("media", "Article: save an inline image from another Article's folder", r, /isn.t one of this Article.s uploads/, async () => {
      await forge("body", JSON.stringify({ type: "doc", content: [{ type: "figure", attrs: { path: `articles/${randomUUID()}/image-${randomUUID()}.png`, alt: "", caption: "" } }] }));
    }, "Save draft");

    // ================= Analysis: slides, link, publish
    step = "analysis media";
    await openEditor(`${a.admin}/${a.id}/edit`);
    let alertText = "";
    await page.setInputFiles("#slide-files", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
    alertText = await page.getByRole("alert").filter({ hasText: "Not uploaded" }).first().innerText({ timeout: 10000 }).catch(() => "");
    check("media", "Analysis: choose a text file as a slide", "rejected before upload, nothing stored", `${alertText ? "rejected" : "no message"}, ${objects(slidePrefix).length} object(s)`, /not a JPEG, PNG or WebP/.test(alertText) && objects(slidePrefix).length === 0);
    await page.setInputFiles("#slide-files", { name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    alertText = await page.getByRole("alert").filter({ hasText: "5 MB" }).first().innerText({ timeout: 10000 }).catch(() => "");
    check("media", "Analysis: choose a slide over 5 MB", "rejected before upload, nothing stored", `${alertText ? "rejected" : "no message"}, ${objects(slidePrefix).length} object(s)`, /at most 5 MB/.test(alertText) && objects(slidePrefix).length === 0);
    const slides = await uploadSlides([image("s1.png", [200, 0, 0]), image("s2.png", [0, 200, 0]), image("s3.png", [0, 0, 200])]);
    check("media", "Analysis: upload three slides", "3 objects in Storage", `${slides.length} uploaded, ${objects(slidePrefix).length} stored`, slides.length === 3 && slides.every(stored));
    const extra = await uploadSlides([image("s4.png", [90, 90, 90])]);
    await page.getByRole("button", { name: "Remove slide 4" }).click({ timeout: 10000 });
    const discarded = extra.length === 1 && (await eventually(async () => !stored(extra[0]), 10)) >= 0;
    check("media", "Analysis: remove an uploaded slide before saving", "object discarded from Storage", discarded ? "discarded" : extra.length ? "STILL STORED" : "upload failed", discarded);
    await page.getByLabel("Read Article").check();
    await page.locator("#linkedArticle").selectOption({ label: `${r.title} (draft)` });
    res = await submit("Publish");
    const order1 = slidePaths(a.id);
    check("analysis", "publish with 3 slides and a linked Article", "published; slides in upload order; link row", `${describe(res)}, status ${field("analyses", a.id, "status")}, ${order1.length} slides${order1.join() === slides.join() ? " in order" : " OUT OF ORDER"}, link ${count(`public.analysis_article_links where analysis_id = '${a.id}' and article_id = '${r.id}' and read_article_enabled`)}`,
      res.notice === "published" && field("analyses", a.id, "status") === "published" && order1.join() === slides.join() && count(`public.analysis_article_links where analysis_id = '${a.id}' and article_id = '${r.id}' and read_article_enabled`) === 1);

    // ================= Article: cover, body, publish; inline image
    step = "article media";
    await openEditor(`${r.admin}/${r.id}/edit`);
    const cover1 = await uploadCover(image("cover1.png", [10, 120, 10]));
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(`QA CMS body text ${RUN}.`);
    res = await submit("Publish");
    check("article", "publish with a cover and body text", "published; cover saved and stored", `${describe(res)}, status ${field("articles", r.id, "status")}, cover ${field("articles", r.id, "cover_image_path") === cover1 ? "saved" : "NOT SAVED"}${cover1 && stored(cover1) ? ", stored" : ", NOT STORED"}`,
      res.notice === "published" && field("articles", r.id, "status") === "published" && cover1 && field("articles", r.id, "cover_image_path") === cover1 && stored(cover1));

    // ================= Case Study: cover, required fields, publish
    step = "case study media";
    await openEditor(`${c.admin}/${c.id}/edit`);
    const cs1 = await uploadCover(image("cs1.png", [120, 0, 120]));
    await page.fill("#shortDescription", "QA CMS synthetic case study.");
    await page.fill("#productDescription", "QA CMS product description.");
    await page.fill("#priceBdt", "1500"); await page.fill("#industry", "QA"); await page.fill("#pageCount", "12");
    res = await submit("Publish");
    check("case study", "publish with cover and every required field", "published; cover saved", `${describe(res)}, status ${field("case_studies", c.id, "status")}, cover ${field("case_studies", c.id, "cover_image_path") === cs1 ? "saved" : "NOT SAVED"}`,
      res.notice === "published" && field("case_studies", c.id, "status") === "published" && cs1 && field("case_studies", c.id, "cover_image_path") === cs1);

    // ================= Published: visible everywhere
    step = "published visibility";
    for (const [name, t] of [["analysis", a], ["article", r], ["case study", c]]) {
      const v = await publicViews(t);
      const detail = await get(`${t.pub}/${t.slug}`);
      const ok = v.detail === 200 && detail.text.includes(t.title) && v.archive && v.sitemap && (!t.feed || v.feed);
      check(name, "published: detail page, archive, feed, sitemap", "200 with the title; listed", v.network ? "network error" : `detail ${v.detail}; listed in ${["archive", "feed", "sitemap"].filter((k) => v[k]).join(", ") || "none"}`, ok);
    }
    {
      const api = await get(`/api/analysis/${a.slug}`);
      const idx = order1.map((p) => api.text.indexOf(p));
      check("analysis", "published: slide API lists the slides in order", "200, saved order", `${api.status}, ${idx.every((x, i) => x >= 0 && (i === 0 || x > idx[i - 1])) ? "in order" : "NOT IN ORDER"}`, api.status === 200 && idx.every((x, i) => x >= 0 && (i === 0 || x > idx[i - 1])));
      const art = await get(`${r.pub}/${r.slug}`), an = await get(`${a.pub}/${a.slug}`);
      check("analysis", "published pair: Article shows See Visual Story, Analysis links the Article", "both links shown", `${/See Visual Story/.test(art.text) ? "story link" : "NO story link"}, ${an.text.includes(`/articles/${r.slug}`) ? "article link" : "NO article link"}`, /See Visual Story/.test(art.text) && an.text.includes(`/articles/${r.slug}`));
      check("article", "published: cover on the public page", "referenced", art.text.includes(cover1) ? "referenced" : "NOT referenced", art.text.includes(cover1));
    }

    // ================= Article: inline image (after the checks above, so a failure here stays isolated)
    step = "article inline image";
    await openEditor(`${r.admin}/${r.id}/edit`);
    const toolbarFile = page.locator('[role="toolbar"][aria-label="Formatting"] input[type="file"]');
    const inlineUpload = page.waitForResponse(isUpload, { timeout: 30000 }).catch(() => null);
    await page.locator(".ProseMirror").click(); await page.keyboard.press("End");
    await toolbarFile.setInputFiles(image("inline.png", [250, 160, 0]));
    const inlineResponse = await inlineUpload;
    const inline = inlineResponse?.ok() ? uploadedPath(inlineResponse) : null;
    await page.getByPlaceholder("What the image shows, for screen readers").fill("QA CMS inline image", { timeout: 15000 }).catch(() => {});
    res = await submit("Update");
    const bodyHas = (p) => p && sql(`select (body::text like ${quote(`%${p}%`)})::text from public.articles where id = '${r.id}'`) === "true";
    check("media", "Article: insert an inline image and update", "figure saved in the body, object stored", `${describe(res)}, body ${bodyHas(inline) ? "references it" : "DOES NOT reference it"}, ${inline && stored(inline) ? "stored" : "NOT STORED"}`,
      res.notice === "updated" && bodyHas(inline) && stored(inline));

    {
      const art = await get(`${r.pub}/${r.slug}`);
      const broken = /This page couldn.t be loaded/.test(art.text);
      check("article", "published with an inline image: the public page renders it", "200 with the title and the image", `${art.status}, ${broken ? "ERROR PAGE (This page couldn’t be loaded.)" : `title ${art.text.includes(r.title) ? "shown" : "MISSING"}, image ${inline && art.text.includes(inline) ? "shown" : "MISSING"}`}`,
        art.status === 200 && !broken && art.text.includes(r.title) && inline && art.text.includes(inline),
        broken ? "DEFECT: components/articles/article-body.tsx (a Server Component) calls getImageProps(), which vinext's next/image shim exports from a \"use client\" module" : "");
    }
    {
      await page.goto(`${BASE}${r.admin}/${r.id}/preview`);
      // The error boundary is a Client Component: it can appear after hydration, so wait for either heading.
      await page.getByRole("heading", { name: new RegExp(`couldn.t be loaded|${r.title}`) }).first().waitFor({ timeout: 20000 }).catch(() => {});
      const text = await page.locator("body").innerText().catch(() => "");
      const broken = /couldn.t be loaded|Something went wrong/i.test(text);
      check("article", "admin preview with an inline image", "renders the Article", broken ? "ERROR PAGE" : text.includes(r.title) ? "renders" : "title MISSING", !broken && text.includes(r.title), broken ? "same renderer as the public page" : "");
    }

    // ================= Media edits on published records
    step = "slide reorder/remove";
    await openEditor(`${a.admin}/${a.id}/edit`);
    await page.getByRole("button", { name: "Move slide 3 up" }).click();
    res = await submit("Update");
    const order2 = slidePaths(a.id);
    const api2 = await get(`/api/analysis/${a.slug}`);
    const expected2 = [order1[0], order1[2], order1[1]];
    const pubOrder = expected2.map((p) => api2.text.indexOf(p));
    check("media", "Analysis: move slide 3 up and update", "order 1,3,2 saved and served", `${describe(res)}, saved ${order2.join() === expected2.join() ? "1,3,2" : "WRONG ORDER"}, API ${pubOrder.every((x, i) => x >= 0 && (i === 0 || x > pubOrder[i - 1])) ? "1,3,2" : "WRONG ORDER"}`,
      res.notice === "updated" && order2.join() === expected2.join() && pubOrder.every((x, i) => x >= 0 && (i === 0 || x > pubOrder[i - 1])));
    await openEditor(`${a.admin}/${a.id}/edit`);
    await page.getByRole("button", { name: "Remove slide 1" }).click();
    res = await submit("Update");
    const order3 = slidePaths(a.id);
    const gone = !stored(order1[0]);
    const publicGone = (await fetch(`${env.QA_API_URL}/storage/v1/object/public/${BUCKET}/${order1[0]}`).then((x) => x.status, () => "network error"));
    check("media", "Analysis: remove slide 1 and update", "2 slides; removed object deleted from Storage; others kept", `${describe(res)}, ${order3.length} slides, removed object ${gone ? `deleted (public URL ${publicGone})` : "STILL STORED"}, others ${order3.every(stored) ? "kept" : "MISSING"}`,
      res.notice === "updated" && order3.join() === [order1[2], order1[1]].join() && gone && [400, 404].includes(publicGone) && order3.every(stored));

    step = "article cover replace / inline remove / cover remove";
    await openEditor(`${r.admin}/${r.id}/edit`);
    const cover2 = await uploadCover(image("cover2.png", [10, 10, 160]));
    res = await submit("Update");
    check("media", "Article: replace the cover and update", "new cover saved; old object deleted", `${describe(res)}, new ${field("articles", r.id, "cover_image_path") === cover2 ? "saved" : "NOT SAVED"}, old ${stored(cover1) ? "STILL STORED" : "deleted"}`,
      res.notice === "updated" && cover2 && field("articles", r.id, "cover_image_path") === cover2 && stored(cover2) && !stored(cover1));
    await openEditor(`${r.admin}/${r.id}/edit`);
    await page.getByRole("button", { name: "Remove image" }).click({ timeout: 10000 });
    res = await submit("Update");
    check("media", "Article: remove the inline image and update", "figure gone from the body; object deleted", `${describe(res)}, body ${bodyHas(inline) ? "STILL references it" : "clean"}, object ${stored(inline) ? "STILL STORED" : "deleted"}`,
      res.notice === "updated" && !bodyHas(inline) && !stored(inline));
    await openEditor(`${r.admin}/${r.id}/edit`);
    await page.getByRole("button", { name: "Remove cover" }).click({ timeout: 10000 });
    res = await submit("Update");
    check("media", "Article: remove the cover and update", "cover cleared; object deleted; folder empty", `${describe(res)}, cover ${field("articles", r.id, "cover_image_path")}, ${objects(articlePrefix).length} object(s) left`,
      res.notice === "updated" && field("articles", r.id, "cover_image_path") === "<absent>" && objects(articlePrefix).length === 0);

    step = "case study cover replace";
    await openEditor(`${c.admin}/${c.id}/edit`);
    const cs2 = await uploadCover(image("cs2.png", [0, 120, 120]));
    res = await submit("Update");
    check("media", "Case Study: replace the cover and update", "new cover saved; old object deleted", `${describe(res)}, new ${field("case_studies", c.id, "cover_image_path") === cs2 ? "saved" : "NOT SAVED"}, old ${stored(cs1) ? "STILL STORED" : "deleted"}`,
      res.notice === "updated" && cs2 && field("case_studies", c.id, "cover_image_path") === cs2 && !stored(cs1));
    // A refused save after a new upload: the record keeps the old cover; the next good save adopts the new
    // one and removes the old.
    await openEditor(`${c.admin}/${c.id}/edit`);
    const beforeFail = snap("case_studies", c.id);
    const cs3 = await uploadCover(image("cs3.png", [160, 160, 0]));
    await page.fill("#priceBdt", "abc");
    res = await submit("Update");
    check("media", "Case Study: new cover uploaded, then the save is refused (bad price)", "refused; record still has the old cover", `${describe(res)}, record ${snap("case_studies", c.id) === beforeFail ? "unchanged" : "CHANGED"}, new upload ${cs3 && stored(cs3) ? "kept for the next save" : "missing"}`,
      !res.saved && snap("case_studies", c.id) === beforeFail && field("case_studies", c.id, "cover_image_path") === cs2);
    await page.fill("#priceBdt", "1500");
    res = await submit("Update");
    check("media", "Case Study: the corrected save", "new cover saved; old object deleted; one object left", `${describe(res)}, cover ${field("case_studies", c.id, "cover_image_path") === cs3 ? "new" : "NOT NEW"}, ${objects(coverPrefix).length} object(s)`,
      res.notice === "updated" && field("case_studies", c.id, "cover_image_path") === cs3 && !stored(cs2) && objects(coverPrefix).join() === cs3);
    await refusedCase("rules", "Case Study (published): remove the cover and update", c, /A published Case Study must keep every required field/, async () => { await page.getByRole("button", { name: "Remove cover" }).click(); }, "Update");
    await refusedCase("rules", "Article (published): clear the body and update", r, /A published Article needs body text/, async () => { await page.locator(".ProseMirror").click(); await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.press("Delete"); }, "Update");
    await refusedCase("rules", "Analysis (published): remove every slide and update", a, /A published Analysis needs at least one slide/, async () => {
      for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Remove slide 1" }).click();
    }, "Update");

    // ================= Edit published content: public freshness
    step = "freshness";
    for (const [name, t] of [["analysis", a], ["article", r], ["case study", c]]) {
      await get(`${t.pub}/${t.slug}`); await get(t.pub); // warm the cached pages first
      const edited = `${t.title} edited`;
      await openEditor(`${t.admin}/${t.id}/edit`);
      await page.fill("#title", edited);
      res = await submit("Update");
      const detailS = await eventually(async () => (await get(`${t.pub}/${t.slug}`)).text.includes(edited));
      const archiveS = await eventually(async () => (await get(t.pub)).text.includes(edited));
      check(name, "edit the published title: detail page and archive refresh", "new title within 60 s", `${describe(res)}, detail ${seen(detailS)}, archive ${seen(archiveS)}`, res.notice === "updated" && detailS >= 0 && archiveS >= 0);
      t.title = edited;
    }

    // ================= Tags (2/3): filtering, rename, delete refused while in use
    step = "tags: filtering";
    {
      const fa = await get(`/api/analysis?topic=${idA}`), fb = await get(`/api/analysis?topic=${idB}`), fc = await get(`/api/case-studies?topic=${idA}`), fcb = await get(`/api/case-studies?topic=${idB}`);
      check("tags", "archive filter by tag A (Analysis, Case Study feeds)", "listed under A, not under B", `analysis A:${fa.text.includes(a.slug)} B:${fb.text.includes(a.slug)}; case study A:${fc.text.includes(c.slug)} B:${fcb.text.includes(c.slug)}`,
        fa.status === 200 && fa.text.includes(a.slug) && !fb.text.includes(a.slug) && fc.text.includes(c.slug) && !fcb.text.includes(c.slug));
      const art = await get(`${r.pub}/${r.slug}`);
      check("tags", "Article page shows its tags", "A and B shown", `${art.text.includes(TAG_A) ? "A" : "no A"}, ${art.text.includes(TAG_B) ? "B" : "no B"}`, art.text.includes(TAG_A) && art.text.includes(TAG_B));
    }
    step = "tags: delete in use";
    {
      // The second tab still shows tag A's Delete button from before it was used: the server must refuse.
      await tagsTab.getByRole("button", { name: `Delete ${TAG_A}` }).click({ timeout: 15000 });
      await tagsTab.getByRole("button", { name: "Delete", exact: true }).click({ timeout: 15000 });
      const feedback = await tagsTab.getByText(/attached to \d+ entr/).first().innerText({ timeout: 20000 }).catch(() => "");
      check("tags", "delete a tag in use (from a stale Tags screen)", "refused; tag and links kept", `${feedback ? `"${feedback.slice(0, 50)}"` : "no message"}, tag ${count(`public.tags where id = '${idA}'`) ? "kept" : "DELETED"}`,
        /attached to 3 entries/.test(feedback) && count(`public.tags where id = '${idA}'`) === 1 && count(`public.analysis_tags where tag_id = '${idA}'`) + count(`public.article_tags where tag_id = '${idA}'`) + count(`public.case_study_tags where tag_id = '${idA}'`) === 3);
      await tagsTab.close();
      await page.goto(BASE + "/admin/tags");
      const row = page.getByRole("row").filter({ hasText: TAG_A });
      const inUse = await row.getByText("In use").first().waitFor({ timeout: 15000 }).then(() => true, () => false);
      const delBtn = await row.getByRole("button", { name: `Delete ${TAG_A}` }).count();
      check("tags", "Tags screen for a tag in use", "marked In use, no Delete button", `${inUse ? "In use" : "not marked"}, ${delBtn} delete button(s)`, inUse && delBtn === 0);
    }
    step = "tags: rename";
    {
      await get(`${r.pub}/${r.slug}`); await get(`${c.pub}/${c.slug}`); // cached copies showing the old name
      await page.goto(BASE + "/admin/tags");
      await page.getByRole("button", { name: `Rename ${TAG_A}` }).click({ timeout: 15000 });
      await page.getByLabel(`New name for ${TAG_A}`).fill(TAG_A2);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText(`Renamed to “${TAG_A2}”.`).first().waitFor({ timeout: 20000 }).catch(() => {});
      const name = sql(`select name from public.tags where id = '${idA}'`);
      check("tags", "rename tag A", "same tag id, new name; links kept", `${name === TAG_A2 ? "renamed" : `name "${name}"`}, links ${count(`public.analysis_tags where tag_id = '${idA}'`) + count(`public.article_tags where tag_id = '${idA}'`) + count(`public.case_study_tags where tag_id = '${idA}'`)}`,
        name === TAG_A2 && count(`public.analysis_tags where tag_id = '${idA}'`) + count(`public.article_tags where tag_id = '${idA}'`) + count(`public.case_study_tags where tag_id = '${idA}'`) === 3);
      const artS = await eventually(async () => { const t = (await get(`${r.pub}/${r.slug}`)).text; return t.includes(TAG_A2) && !t.includes(TAG_A); });
      const csS = await eventually(async () => { const t = (await get(`${c.pub}/${c.slug}`)).text; return t.includes(TAG_A2) && !t.includes(TAG_A); }, 5);
      check("tags", "renamed tag on cached public pages (Article, Case Study)", "new name within 60 s", `Article ${seen(artS)}, Case Study ${csS < 0 ? "not within 5 s more" : seen(csS)}`, artS >= 0 && csS >= 0, artS < 0 ? "tag actions revalidate only admin paths; public pages keep the old name until their 300 s ISR window ends" : "");
    }
    step = "tags: unassign and delete";
    {
      await openEditor(`${r.admin}/${r.id}/edit`);
      await page.getByRole("button", { name: `Remove tag ${TAG_B}` }).click({ timeout: 10000 });
      res = await submit("Update");
      check("tags", "unassign tag B from the Article", "link removed; tag A link kept", `${describe(res)}, B links ${count(`public.article_tags where tag_id = '${idB}'`)}, A links ${count(`public.article_tags where article_id = '${r.id}' and tag_id = '${idA}'`)}`,
        res.notice === "updated" && count(`public.article_tags where tag_id = '${idB}'`) === 0 && count(`public.article_tags where article_id = '${r.id}' and tag_id = '${idA}'`) === 1);
      await page.goto(BASE + "/admin/tags");
      await page.getByRole("button", { name: `Delete ${TAG_B}` }).click({ timeout: 15000 });
      await page.getByRole("button", { name: "Delete", exact: true }).click({ timeout: 15000 });
      await page.getByText(`Deleted “${TAG_B}”.`).first().waitFor({ timeout: 20000 }).catch(() => {});
      check("tags", "delete the now-unused tag B", "tag row removed", `${count(`public.tags where id = '${idB}'`)} row(s)`, count(`public.tags where id = '${idB}'`) === 0);
    }

    // ================= Unpublish: gone from every public view
    step = "unpublish";
    for (const [name, t] of [["article", r], ["analysis", a], ["case study", c]]) {
      await openEditor(`${t.admin}/${t.id}/edit`);
      res = await submit("Unpublish");
      const s = await eventually(async () => { const v = await publicViews(t); return v.detail === 404 && !v.archive && !v.feed && !v.sitemap; });
      const v = await publicViews(t);
      check(name, "unpublish: detail page, archive, feed, sitemap", "draft; 404 and absent everywhere", `${describe(res)}, status ${field(t.table, t.id, "status")}, public ${s >= 0 ? `gone ${seen(s)}` : `detail ${v.detail}; still in ${["archive", "feed", "sitemap"].filter((k) => v[k]).join(", ") || "none"}`}`,
        res.notice === "unpublished" && field(t.table, t.id, "status") === "draft" && s >= 0);
      if (name === "article") {
        // The Analysis is still published: its Read Article link must go with the Article.
        const linkS = await eventually(async () => !(await get(`${a.pub}/${a.slug}`)).text.includes(`/articles/${r.slug}`));
        check("analysis", "linked Article unpublished: the Analysis drops its Read Article link", "link gone within 60 s", seen(linkS), linkS >= 0);
      }
    }

    // ================= Delete: record and relationships removed, orders kept
    step = "delete";
    sql(`insert into public.orders (customer_name, customer_email, bkash_number, bkash_transaction_number, case_study_id, case_study_title_snapshot, price_bdt_snapshot)
      values ('QA CMS Buyer', '${BUYER}', '01700000000', 'QACMS${RUN}', '${c.id}', ${quote(c.title)}, 1500);`);
    const del = async (t) => {
      await openEditor(`${t.admin}/${t.id}/edit`);
      await page.getByRole("button", { name: `Delete ${t.label}…` }).click({ timeout: 10000 });
      await Promise.all([page.waitForURL((u) => u.searchParams.get("notice") === "deleted", { timeout: 30000 }).catch(() => {}), page.getByRole("button", { name: "Delete permanently" }).click({ timeout: 10000 })]);
      return new URL(page.url()).searchParams.get("notice") === "deleted";
    };
    let ok = await del(r);
    check("article", "delete: row, tag links, Analysis link, Storage folder", "all removed; the Analysis kept", `${ok ? "deleted" : "NOT DELETED"}; row ${count(`public.articles where id = '${r.id}'`)}, tag links ${count(`public.article_tags where article_id = '${r.id}'`)}, link ${count(`public.analysis_article_links where article_id = '${r.id}'`)}, objects ${objects(articlePrefix).length}, analysis ${count(`public.analyses where id = '${a.id}'`)}`,
      ok && count(`public.articles where id = '${r.id}'`) === 0 && count(`public.article_tags where article_id = '${r.id}'`) === 0 && count(`public.analysis_article_links where article_id = '${r.id}'`) === 0 && objects(articlePrefix).length === 0 && count(`public.analyses where id = '${a.id}'`) === 1);
    ok = await del(a);
    check("analysis", "delete: row, slides, tag links, Storage folder", "all removed", `${ok ? "deleted" : "NOT DELETED"}; row ${count(`public.analyses where id = '${a.id}'`)}, slides ${count(`public.analysis_slides where analysis_id = '${a.id}'`)}, tag links ${count(`public.analysis_tags where analysis_id = '${a.id}'`)}, objects ${objects(slidePrefix).length}`,
      ok && count(`public.analyses where id = '${a.id}'`) === 0 && count(`public.analysis_slides where analysis_id = '${a.id}'`) === 0 && count(`public.analysis_tags where analysis_id = '${a.id}'`) === 0 && objects(slidePrefix).length === 0);
    ok = await del(c);
    const orderRow = sql(`select coalesce(case_study_id::text, 'null') || '|' || case_study_title_snapshot || '|' || price_bdt_snapshot from public.orders where customer_email = '${BUYER}'`);
    check("case study", "delete: row, tag links, Storage folder; its order kept", "removed; order kept with its snapshot, link cleared", `${ok ? "deleted" : "NOT DELETED"}; row ${count(`public.case_studies where id = '${c.id}'`)}, tag links ${count(`public.case_study_tags where case_study_id = '${c.id}'`)}, objects ${objects(coverPrefix).length}, order ${orderRow ? orderRow.split("|")[0] === "null" ? "kept, unlinked" : "STILL LINKED" : "MISSING"}`,
      ok && count(`public.case_studies where id = '${c.id}'`) === 0 && count(`public.case_study_tags where case_study_id = '${c.id}'`) === 0 && objects(coverPrefix).length === 0 && orderRow === `null|${c.title}|1500.00`);
    for (const [name, t] of [["article", r], ["analysis", a], ["case study", c]]) {
      const v = await publicViews(t);
      check(name, "deleted: public detail page and listings", "404 and absent", `detail ${v.detail}; listed in ${["archive", "feed", "sitemap"].filter((k) => v[k]).join(", ") || "none"}`, v.detail === 404 && !v.archive && !v.feed && !v.sitemap);
    }

    // ================= Tags (3/3): tag A is unused once its content is gone
    step = "tags: delete after content deletion";
    await page.goto(BASE + "/admin/tags");
    await page.getByRole("button", { name: `Delete ${TAG_A2}` }).click({ timeout: 15000 });
    await page.getByRole("button", { name: "Delete", exact: true }).click({ timeout: 15000 });
    await page.getByText(`Deleted “${TAG_A2}”.`).first().waitFor({ timeout: 20000 }).catch(() => {});
    check("tags", "delete tag A after its content was deleted", "links cascaded with the content; tag removed", `${count(`public.tags where id = '${idA}'`)} row(s)`, count(`public.tags where id = '${idA}'`) === 0);
  } catch (e) {
    check("probe", `${step} step`, "completed", `aborted (${e?.name || "Error"}: ${String(e?.message || "").split("\n")[0].replace(/[0-9a-f-]{36}/g, "<id>").slice(0, 100)})`, false, "later checks did not run");
  }
}

try { if (browser) await browser.close(); } catch {}
let cleanOk = true;
try { await cleanup(); cleanOk = leftovers() === 0; } catch { cleanOk = false; }
if (setupFailed) console.log(`SETUP FAILED: ${setupFailed} (no CMS result; this is not a pass)`);
if (!cleanOk) console.log("CLEANUP FAILED: the CMS probe's synthetic records or files were not all removed");
const failed = rows.filter((x) => !x.ok);
console.log(`\nCMS lifecycle probes: ${rows.length - failed.length} passed, ${failed.length} failed${setupFailed ? ", setup failed" : ""}; synthetic data removed: ${cleanOk ? "yes" : "NO"}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ setupFailed, rows, failed: failed.map((x) => `[${x.lifecycle}] ${x.operation}`), cleanup: cleanOk }, null, 2));
process.exit(setupFailed ? 3 : failed.length || !cleanOk ? 1 : 0);
