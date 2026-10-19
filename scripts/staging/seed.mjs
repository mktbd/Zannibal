// Synthetic STAGING fixtures (Stage 05E-B2A). Never production, never real data.
//
// Staging mode (GitHub Actions, environment "staging-db"):
//   STAGING_REF_CONFIRM, PRODUCTION_REF, STAGING_SUPABASE_URL, STAGING_DB_URL,
//   STAGING_SUPABASE_SERVICE_ROLE_KEY, STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD
//   -> isolation checks (scripts/staging/isolation.mjs) + staging marker.
// Local mode (--local-qa): the disposable local QA stack only (qa_disposable marker).
//
// Creates fixed-ID fixtures (UUIDs starting 5ea00000-), replacing earlier seed rows only:
// tags, published/draft Analyses with slides, Case Studies, Articles (one with an inline
// image), one Analysis<->Article link, one synthetic order for the smoke test, and the staging
// admin user. Images are generated
// here (no external files). Prints counts only -- never credentials or row data.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { checkMarkerDb, checkRefs, fail, psql } from "./isolation.mjs";

const LOCAL = process.argv.includes("--local-qa");
const env = process.env;
let SUPABASE_URL, DB_URL, SERVICE_KEY;
if (LOCAL) {
  SUPABASE_URL = env.QA_SUPABASE_URL; DB_URL = env.QA_DB_URL; SERVICE_KEY = env.QA_SERVICE_ROLE_KEY;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(SUPABASE_URL || "") || !/@127\.0\.0\.1:\d+\//.test(DB_URL || "")) fail("--local-qa needs local QA_SUPABASE_URL / QA_DB_URL.");
  if (psql(DB_URL, "select count(*) from pg_namespace where nspname = 'qa_disposable'") !== "1") fail("not the disposable QA database.");
} else {
  const ref = checkRefs(env, { requireDb: true });
  SUPABASE_URL = env.STAGING_SUPABASE_URL; DB_URL = env.STAGING_DB_URL; SERVICE_KEY = env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) fail("STAGING_SUPABASE_SERVICE_ROLE_KEY is missing.");
  checkMarkerDb(DB_URL, ref);
}
const ADMIN_EMAIL = env.STAGING_ADMIN_EMAIL || (LOCAL ? "staging-admin@example.test" : "");
const ADMIN_PASSWORD = env.STAGING_ADMIN_PASSWORD || (LOCAL ? `local-${randomUUID()}` : "");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ADMIN_EMAIL) || ADMIN_PASSWORD.length < 16) fail("STAGING_ADMIN_EMAIL / STAGING_ADMIN_PASSWORD (16+ chars) are required.");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const id = (kind, n) => `5ea00000-0000-4000-8${kind}00-${String(n).padStart(12, "0")}`; // kind: 1 analysis, 2 case study, 3 article, 4 tag, 6 order
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const day = (n) => new Date(Date.UTC(2026, 8, 30 - n)).toISOString().slice(0, 10);

// ---- images (synthetic; sizes chosen to resemble real uploads)
async function image(width, height, label, format) {
  const shapes = Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 97) % width}" cy="${(i * 53) % height}" r="${40 + ((i * 31) % 160)}" fill="hsl(${(i * 37) % 360},55%,55%)" fill-opacity="0.45"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4f1ea"/>${shapes}<text x="50%" y="48%" font-family="sans-serif" font-size="${Math.round(width / 14)}" font-weight="700" text-anchor="middle" fill="#111">STAGING FIXTURE</text><text x="50%" y="58%" font-family="sans-serif" font-size="${Math.round(width / 24)}" text-anchor="middle" fill="#111">${label}</text></svg>`;
  const img = sharp(Buffer.from(svg));
  return format === "jpg" ? img.jpeg({ quality: 88 }).toBuffer() : img.png().toBuffer();
}
async function upload(path, buf, type) {
  const { error } = await sb.storage.from("editorial-media").upload(path, buf, { contentType: type, upsert: true });
  if (error) fail(`storage upload failed (${error.statusCode || error.name})`);
}

(async () => {
  // Remove earlier seed rows (fixed IDs only); test orders and rate-limit counters are left alone.
  psql(DB_URL, `begin;
    delete from public.analysis_article_links where analysis_id::text like '5ea00000-%' or article_id::text like '5ea00000-%';
    delete from public.analysis_tags where analysis_id::text like '5ea00000-%';
    delete from public.case_study_tags where case_study_id::text like '5ea00000-%';
    delete from public.article_tags where article_id::text like '5ea00000-%';
    delete from public.analysis_slides where analysis_id::text like '5ea00000-%';
    delete from public.analyses where id::text like '5ea00000-%';
    delete from public.case_studies where id::text like '5ea00000-%';
    delete from public.articles where id::text like '5ea00000-%';
    delete from public.tags where id::text like '5ea00000-%';
    commit;`);

  const tags = ["Fintech", "Telecom", "Retail", "Logistics", "Energy", "Manufacturing"];
  psql(DB_URL, `insert into public.tags (id, name) values ${tags.map((t, i) => `(${q(id(4, i + 1))}, ${q(`Staging ${t}`)})`).join(",")};`);

  // Analyses: 8 published + 1 draft, 3 slides each.
  const analyses = Array.from({ length: 9 }, (_, i) => ({ id: id(1, i + 1), title: i === 8 ? "DRAFT — Staging Analysis" : `Staging Analysis ${i + 1}: Market Structure`, slug: i === 8 ? "staging-draft-analysis" : `staging-analysis-${i + 1}`, status: i === 8 ? "draft" : "published", date: day(i) }));
  psql(DB_URL, `insert into public.analyses (id, title, slug, publication_date, status) values ${analyses.map((a) => `(${q(a.id)}, ${q(a.title)}, ${q(a.slug)}, ${q(a.date)}, ${q(a.status)})`).join(",")};`);
  const slideRows = [];
  for (const a of analyses) for (let s = 0; s < 3; s++) {
    const path = `analysis/${a.id}/${randomUUID()}.png`;
    await upload(path, await image(1080, 1350, `${a.slug} · slide ${s + 1}`, "png"), "image/png");
    slideRows.push(`(${q(a.id)}, ${q(path)}, ${s})`);
  }
  psql(DB_URL, `insert into public.analysis_slides (analysis_id, storage_path, position) values ${slideRows.join(",")};`);
  psql(DB_URL, `insert into public.analysis_tags (analysis_id, tag_id) values ${analyses.map((a, i) => `(${q(a.id)}, ${q(id(4, (i % tags.length) + 1))})`).join(",")};`);

  // Case Studies: 8 published + 1 draft, landscape covers.
  const cases = [];
  for (let i = 0; i < 9; i++) {
    const cid = id(2, i + 1);
    const cover = `case-studies/${cid}/cover-${randomUUID()}.jpg`;
    await upload(cover, await image(2400, 1600, `case study ${i + 1}`, "jpg"), "image/jpeg");
    cases.push(`(${q(cid)}, ${q(i === 8 ? "DRAFT — Staging Case Study" : `Staging Case Study ${i + 1}: Building at Scale`)}, ${q(i === 8 ? "staging-draft-case-study" : `staging-case-study-${i + 1}`)}, ${q(cover)}, ${q("Synthetic staging fixture. Not a real report.")}, ${q("Synthetic staging fixture.\n\nNot for sale.")}, ${500 + i * 100}, ${q("Staging")}, ${20 + i}, ${q(day(i))}, ${q(i === 8 ? "draft" : "published")})`);
  }
  psql(DB_URL, `insert into public.case_studies (id, title, slug, cover_image_path, short_description, product_description, price_bdt, industry, page_count, publication_date, status) values ${cases.join(",")};`);
  psql(DB_URL, `insert into public.case_study_tags (case_study_id, tag_id) values ${Array.from({ length: 9 }, (_, i) => `(${q(id(2, i + 1))}, ${q(id(4, (i % tags.length) + 1))})`).join(",")};`);

  // Articles: 4 published + 1 draft; the first has an inline image.
  const articles = [];
  for (let i = 0; i < 5; i++) {
    const aid = id(3, i + 1);
    const cover = `articles/${aid}/cover-${randomUUID()}.jpg`;
    await upload(cover, await image(2400, 1350, `article ${i + 1}`, "jpg"), "image/jpeg");
    const content = [{ type: "paragraph", content: [{ type: "text", text: "Synthetic staging article. Not real reporting." }] }, { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "A section" }] }, { type: "paragraph", content: [{ type: "text", text: "More synthetic text for layout and timing." }] }];
    if (i === 0) {
      const inline = `articles/${aid}/image-${randomUUID()}.png`;
      await upload(inline, await image(2000, 1250, "inline image", "png"), "image/png");
      content.splice(2, 0, { type: "figure", attrs: { path: inline, alt: "Synthetic chart", caption: "Staging fixture" } });
    }
    articles.push(`(${q(aid)}, ${q(i === 4 ? "DRAFT — Staging Article" : `Staging Article ${i + 1}: What Changed`)}, ${q(i === 4 ? "staging-draft-article" : `staging-article-${i + 1}`)}, ${q("Synthetic staging article.")}, ${q(cover)}, ${q(JSON.stringify({ type: "doc", content }))}::jsonb, ${q(day(i))}, ${q(i === 4 ? "draft" : "published")})`);
  }
  psql(DB_URL, `insert into public.articles (id, title, slug, short_description, cover_image_path, body, publication_date, status) values ${articles.join(",")};`);
  psql(DB_URL, `insert into public.analysis_article_links (analysis_id, article_id, read_article_enabled) values (${q(id(1, 1))}, ${q(id(3, 1))}, true);`);

  // Smoke-test order fixture: written directly to the database (never through POST /api/orders, so no
  // rate-limit capacity is used). Upserted on its fixed ID so its order number stays stable; a re-seed
  // resets it to Pending. The smoke test changes its status and restores it.
  const cs1 = id(2, 1);
  psql(DB_URL, `insert into public.orders (id, customer_name, customer_email, bkash_number, bkash_transaction_number, case_study_id, case_study_title_snapshot, price_bdt_snapshot, status)
    select ${q(id(6, 1))}, 'Smoke Fixture', 'smoke.fixture@example.test', '01712345678', 'STGSMOKEFIXTURE0001', c.id, c.title, c.price_bdt, 'pending' from public.case_studies c where c.id = ${q(cs1)}
    on conflict (id) do update set status = 'pending', case_study_id = excluded.case_study_id, case_study_title_snapshot = excluded.case_study_title_snapshot, price_bdt_snapshot = excluded.price_bdt_snapshot;`);

  // Staging admin user (password from a secret; never printed).
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u) => u.email === ADMIN_EMAIL);
  const userId = existing
    ? (await sb.auth.admin.updateUserById(existing.id, { password: ADMIN_PASSWORD, email_confirm: true })).data?.user?.id
    : (await sb.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true })).data?.user?.id;
  if (!userId) fail("could not create or update the staging admin user.");
  psql(DB_URL, `update public.profiles set role = 'admin' where id = ${q(userId)};`);

  const counts = psql(DB_URL, "select (select count(*) from public.analyses where id::text like '5ea00000-%') || ' analyses, ' || (select count(*) from public.case_studies where id::text like '5ea00000-%') || ' case studies, ' || (select count(*) from public.orders where id::text like '5ea00000-%') || ' order fixture, ' || (select count(*) from public.articles where id::text like '5ea00000-%') || ' articles, ' || (select count(*) from public.analysis_slides where analysis_id::text like '5ea00000-%') || ' slides'");
  console.log(`Seeded synthetic fixtures: ${counts}; staging admin ready.`);
})().catch((e) => { console.error(`seed failed (${e.name})`); process.exit(2); });
