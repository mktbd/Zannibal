// Level 2 QA (Stage 3A): Supabase RLS and Storage security probes against the DISPOSABLE local QA stack.
//
// Usage: node scripts/qa/rls-probe.mjs --out result.json   (run by scripts/qa/local.sh)
// Env (local QA values only): QA_API_URL, QA_ANON_KEY, QA_SERVICE_ROLE_KEY, QA_DB_URL,
//   QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD (the seeded synthetic admin).
//
// Three identities -- anonymous, a non-admin account created here, and the admin -- read and write every
// public table and the editorial-media bucket through the real PostgREST/Storage APIs. Each outcome is
// classified (denied, empty, allowed, rejected, network, error) and every refused write is checked against
// the database directly (psql as the table owner), so "no error" never passes for "no effect".
// Synthetic records only (ids c0ffee00-..., emails @example.test), all removed at the end. Refuses to run
// unless the API and database are the local QA stack (127.0.0.1:55321/55322) with the qa_disposable marker.
// Prints identities, operations and outcomes only -- never keys, tokens or passwords.
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const LOCAL_API = /^http:\/\/127\.0\.0\.1:55321\/?$/;
export const LOCAL_DB = /^postgres(?:ql)?:\/\/[^@/\s]+@127\.0\.0\.1:55322\/postgres$/;
const BUCKET = "editorial-media";

/**
 * Classify a supabase-js result or a thrown error. "denied" = an explicit permission/RLS refusal;
 * "empty" = success that touched or returned nothing (RLS filtered it out); "hidden" = "not found" for
 * an object the caller is not allowed to see; "rejected" = a Storage type/size refusal; "network" = the
 * request never got an answer; "error" = anything else.
 */
export function classify(result) {
  if (result?.thrown) {
    const t = result.thrown;
    return /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket|network/i.test(`${t?.message} ${t?.cause?.code ?? ""}`) ? "network" : "error";
  }
  const e = result?.error;
  if (e) {
    const msg = `${e.message ?? ""} ${e.error ?? ""}`;
    const status = Number(e.status ?? e.statusCode ?? 0);
    if (/fetch failed|ECONNREFUSED|network/i.test(msg) && !status && !e.code) return "network";
    if (e.code === "42501" || /permission denied|row-level security|not allowed|unauthorized/i.test(msg) || status === 401 || status === 403) return "denied";
    if (String(e.statusCode) === "404" || /^object not found$/i.test(String(e.message || "").trim())) return "hidden";
    if (/mime type|invalid_mime_type|exceeded the maximum allowed size|payload too large|entity too large/i.test(msg) || status === 413 || status === 415) return "rejected";
    return "error";
  }
  const d = result?.data;
  if (d === null || d === undefined || (Array.isArray(d) && d.length === 0)) return "empty";
  return "allowed";
}

/** Short, safe description of an error for the report (no tokens; messages from local Postgres/Storage). */
const errText = (r) => (r?.thrown ? String(r.thrown?.message || r.thrown).slice(0, 80) : r?.error ? `${r.error.code || r.error.statusCode || r.error.status || ""} ${String(r.error.message || "").slice(0, 80)}`.trim() : "");

async function main() {
  const args = process.argv.slice(2);
  const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
  const env = process.env;
  const API = env.QA_API_URL || "", DB = env.QA_DB_URL || "";
  const refuse = (why) => { console.error(`REFUSED: ${why}`); process.exit(97); };
  if (!LOCAL_API.test(API)) refuse("QA_API_URL is not the local QA API (http://127.0.0.1:55321).");
  if (!LOCAL_DB.test(DB)) refuse("QA_DB_URL is not the local QA database (127.0.0.1:55322).");
  for (const k of ["QA_ANON_KEY", "QA_SERVICE_ROLE_KEY", "QA_ADMIN_EMAIL", "QA_ADMIN_PASSWORD"]) if (!env[k]) refuse(`${k} is not set.`);

  const sql = (q) => {
    const r = spawnSync("psql", [DB, "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`setup SQL failed: ${(r.stderr || "").split("\n")[0].slice(0, 120)}`);
    return r.stdout.trim();
  };
  if (sql("select count(*) from pg_namespace where nspname = 'qa_disposable'") !== "1") refuse("the database has no qa_disposable marker.");

  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(API, env.QA_SERVICE_ROLE_KEY, opts);
  const rows = [];
  let setupFailed = null;

  // ---- fixtures (owner/service role; synthetic ids and emails only)
  const id = (n) => `c0ffee00-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const F = {
    tagPub: id(1), tagDraft: id(2), aPub: id(10), aDraft: id(11), slidePub: id(12), slideDraft: id(13),
    csPub: id(20), csDraft: id(21), arPub: id(30), arDraft: id(31), order: id(40),
  };
  const users = [];
  const objects = { pub: `case-studies/${F.csPub}/cover-qa-sec-pub.png`, draft: `case-studies/${F.csDraft}/cover-qa-sec-draft.png` };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const cleanup = async () => {
    try {
      sql(`begin;
        delete from public.orders where id::text like 'c0ffee00-%' or customer_email like 'qa-sec-%@example.test';
        delete from public.analysis_article_links where analysis_id::text like 'c0ffee00-%' or article_id::text like 'c0ffee00-%';
        delete from public.analysis_tags where analysis_id::text like 'c0ffee00-%' or tag_id::text like 'c0ffee00-%';
        delete from public.case_study_tags where case_study_id::text like 'c0ffee00-%' or tag_id::text like 'c0ffee00-%';
        delete from public.article_tags where article_id::text like 'c0ffee00-%' or tag_id::text like 'c0ffee00-%';
        delete from public.analysis_slides where id::text like 'c0ffee00-%' or analysis_id::text like 'c0ffee00-%';
        delete from public.analyses where id::text like 'c0ffee00-%' or slug like 'qa-sec-%';
        delete from public.case_studies where id::text like 'c0ffee00-%' or slug like 'qa-sec-%';
        delete from public.articles where id::text like 'c0ffee00-%' or slug like 'qa-sec-%';
        delete from public.tags where id::text like 'c0ffee00-%' or name like 'QA Sec %';
        commit;`);
    } catch (e) { console.error(`cleanup: database rows not fully removed (${e.message})`); }
    const { data: objs } = await service.storage.from(BUCKET).list(`case-studies/${F.csPub}`).catch(() => ({ data: [] }));
    const paths = [objects.pub, objects.draft, ...(objs || []).map((o) => `case-studies/${F.csPub}/${o.name}`)];
    await service.storage.from(BUCKET).remove([...new Set(paths)]).catch(() => {});
    for (const u of users) await service.auth.admin.deleteUser(u.id).catch(() => {});
  };

  try {
    await cleanup(); // a crashed earlier run must not leave fixtures behind
    sql(`begin;
      insert into public.tags (id, name) values ('${F.tagPub}', 'QA Sec Published Tag'), ('${F.tagDraft}', 'QA Sec Draft-only Tag');
      insert into public.analyses (id, title, slug, status) values ('${F.aPub}', 'QA Sec Published Analysis', 'qa-sec-analysis-pub', 'published'), ('${F.aDraft}', 'QA Sec Draft Analysis', 'qa-sec-analysis-draft', 'draft');
      insert into public.analysis_slides (id, analysis_id, storage_path, position) values ('${F.slidePub}', '${F.aPub}', 'analysis/${F.aPub}/qa-sec-1.png', 0), ('${F.slideDraft}', '${F.aDraft}', 'analysis/${F.aDraft}/qa-sec-1.png', 0);
      insert into public.analysis_tags (analysis_id, tag_id) values ('${F.aPub}', '${F.tagPub}'), ('${F.aDraft}', '${F.tagDraft}');
      insert into public.case_studies (id, title, slug, status, price_bdt, cover_image_path) values ('${F.csPub}', 'QA Sec Published Case Study', 'qa-sec-case-pub', 'published', 900, '${objects.pub}'), ('${F.csDraft}', 'QA Sec Draft Case Study', 'qa-sec-case-draft', 'draft', 900, '${objects.draft}');
      insert into public.case_study_tags (case_study_id, tag_id) values ('${F.csPub}', '${F.tagPub}'), ('${F.csDraft}', '${F.tagDraft}');
      insert into public.articles (id, title, slug, status) values ('${F.arPub}', 'QA Sec Published Article', 'qa-sec-article-pub', 'published'), ('${F.arDraft}', 'QA Sec Draft Article', 'qa-sec-article-draft', 'draft');
      insert into public.article_tags (article_id, tag_id) values ('${F.arPub}', '${F.tagPub}'), ('${F.arDraft}', '${F.tagDraft}');
      insert into public.analysis_article_links (analysis_id, article_id, read_article_enabled) values ('${F.aPub}', '${F.arPub}', true), ('${F.aDraft}', '${F.arDraft}', true);
      insert into public.orders (id, customer_name, customer_email, bkash_number, bkash_transaction_number, case_study_id, case_study_title_snapshot, price_bdt_snapshot)
        values ('${F.order}', 'QA Sec Buyer', 'qa-sec-buyer@example.test', '01712345678', 'QASEC${Date.now().toString(36).toUpperCase()}', '${F.csPub}', 'QA Sec Published Case Study', 900);
      commit;`);
    for (const p of [objects.pub, objects.draft]) {
      const { error } = await service.storage.from(BUCKET).upload(p, png, { contentType: "image/png", upsert: true });
      if (error) throw new Error(`fixture upload failed (${error.statusCode || error.message})`);
    }
    for (const n of [1, 2]) {
      const email = `qa-sec-user${n}-${randomUUID().slice(0, 8)}@example.test`, password = `qa-${randomUUID()}`;
      const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data?.user) throw new Error(`could not create non-admin user ${n}`);
      users.push({ id: data.user.id, email, password });
    }
    if (sql(`select string_agg(role, ',' order by id) from public.profiles where id in ('${users[0].id}', '${users[1].id}')`) !== "user,user") throw new Error("new accounts did not get role 'user'");
  } catch (e) {
    setupFailed = e.message;
  }

  // ---- identities
  const signIn = async (email, password) => {
    const c = createClient(API, env.QA_ANON_KEY, opts);
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`sign-in failed for a test identity (${error.status || error.message})`);
    return c;
  };
  let anon, user, admin;
  if (!setupFailed) {
    try {
      anon = createClient(API, env.QA_ANON_KEY, opts);
      user = await signIn(users[0].email, users[0].password);
      admin = await signIn(env.QA_ADMIN_EMAIL, env.QA_ADMIN_PASSWORD);
      if (sql(`select p.role from public.profiles p join auth.users u on u.id = p.id where u.email = '${env.QA_ADMIN_EMAIL.replace(/'/g, "''")}'`) !== "admin") throw new Error("the seeded admin does not have role 'admin'");
    } catch (e) { setupFailed = e.message; }
  }
  const identities = { anonymous: anon, "non-admin": user, admin };

  const run = async (fn) => { try { return await fn(); } catch (thrown) { return { thrown }; } };
  const snap = (table, where) => sql(`select coalesce(md5(string_agg(t::text, '|' order by t::text)), 'absent') from public.${table} t where ${where}`);
  const record = (identity, area, operation, expected, result, extra = {}) => {
    const actual = classify(result);
    const okOutcome = expected.includes(actual);
    const ok = okOutcome && extra.stateOk !== false;
    const category = ok ? "" : actual === "network" ? "infra" : extra.stateOk === false ? "STATE CHANGED" : "policy/app";
    rows.push({ identity, area, operation, expected: expected.join("|"), actual, state: extra.state ?? "", ok, category, detail: ok ? "" : errText(result) });
  };

  if (!setupFailed) {
    // ---- 1. reads: published visible to all, drafts and private tables to the admin only
    const readCases = [
      ["analyses", "id", F.aPub, F.aDraft],
      ["analysis_slides", "id", F.slidePub, F.slideDraft],
      ["analysis_tags", "analysis_id", F.aPub, F.aDraft],
      ["case_studies", "id", F.csPub, F.csDraft],
      ["case_study_tags", "case_study_id", F.csPub, F.csDraft],
      ["articles", "id", F.arPub, F.arDraft],
      ["article_tags", "article_id", F.arPub, F.arDraft],
      ["analysis_article_links", "analysis_id", F.aPub, F.aDraft],
      ["tags", "id", F.tagPub, F.tagDraft],
    ];
    for (const [who, c] of Object.entries(identities)) {
      for (const [table, col, pub, draft] of readCases) {
        record(who, "read", `${table}: published row`, ["allowed"], await run(() => c.from(table).select("*").eq(col, pub)));
        record(who, "read", `${table}: draft-only row`, who === "admin" ? ["allowed"] : ["empty"], await run(() => c.from(table).select("*").eq(col, draft)));
      }
      record(who, "read", "orders: synthetic order", who === "admin" ? ["allowed"] : ["empty", "denied"], await run(() => c.from("orders").select("id").eq("id", F.order)));
      record(who, "read", "profiles: another user's profile", who === "admin" ? ["allowed"] : ["empty"], await run(() => c.from("profiles").select("id, role").eq("id", users[1].id)));
      if (who === "non-admin") record(who, "read", "profiles: own profile", ["allowed"], await run(() => c.from("profiles").select("id, role").eq("id", users[0].id)));
      record(who, "read", "order_rate_limits (service-only)", ["denied"], await run(() => c.from("order_rate_limits").select("*").limit(1)));
    }

    // ---- 2. refused writes (anonymous, non-admin): denied or no effect, and the database unchanged
    const draftCols = { analyses: { title: "QA Sec HACKED", slug: "qa-sec-hacked-a" }, case_studies: { title: "QA Sec HACKED", slug: "qa-sec-hacked-c" }, articles: { title: "QA Sec HACKED", slug: "qa-sec-hacked-r" } };
    const writeCases = [
      { table: "analyses", where: `id = '${F.aPub}'`, insert: () => ({ id: id(90), ...draftCols.analyses }), update: { title: "QA Sec HACKED" }, key: ["id", F.aPub] },
      { table: "analyses", label: "analyses: publish a draft", where: `id = '${F.aDraft}'`, update: { status: "published" }, key: ["id", F.aDraft] },
      { table: "analysis_slides", where: `id = '${F.slidePub}'`, insert: () => ({ id: id(91), analysis_id: F.aPub, storage_path: "analysis/x/qa-sec-evil.png", position: 9 }), update: { storage_path: "analysis/x/qa-sec-evil.png" }, key: ["id", F.slidePub] },
      { table: "analysis_tags", where: `analysis_id = '${F.aPub}'`, insert: () => ({ analysis_id: F.aPub, tag_id: F.tagDraft }), key: ["analysis_id", F.aPub] },
      { table: "case_studies", where: `id = '${F.csPub}'`, insert: () => ({ id: id(92), ...draftCols.case_studies }), update: { price_bdt: 1 }, key: ["id", F.csPub] },
      { table: "case_study_tags", where: `case_study_id = '${F.csPub}'`, insert: () => ({ case_study_id: F.csPub, tag_id: F.tagDraft }), key: ["case_study_id", F.csPub] },
      { table: "articles", where: `id = '${F.arPub}'`, insert: () => ({ id: id(93), ...draftCols.articles }), update: { title: "QA Sec HACKED" }, key: ["id", F.arPub] },
      { table: "article_tags", where: `article_id = '${F.arPub}'`, insert: () => ({ article_id: F.arPub, tag_id: F.tagDraft }), key: ["article_id", F.arPub] },
      { table: "analysis_article_links", where: `analysis_id = '${F.aPub}'`, update: { read_article_enabled: false }, key: ["analysis_id", F.aPub] },
      { table: "tags", where: `id = '${F.tagPub}'`, insert: () => ({ id: id(94), name: "QA Sec Evil Tag" }), update: { name: "QA Sec HACKED" }, key: ["id", F.tagPub] },
      { table: "orders", where: `id = '${F.order}'`, insert: () => ({ customer_name: "QA Sec Evil", customer_email: "qa-sec-evil@example.test", bkash_number: "01700000000", bkash_transaction_number: `EVIL${Date.now()}`, case_study_title_snapshot: "x", price_bdt_snapshot: 0, status: "fulfilled" }), update: { status: "fulfilled" }, key: ["id", F.order] },
      { table: "order_rate_limits", where: "true", insert: () => ({ bucket: "global", window_start: new Date().toISOString(), hits: 0 }), update: { hits: 0 }, key: ["bucket", "global"] },
    ];
    for (const who of ["anonymous", "non-admin"]) {
      const c = identities[who];
      for (const w of writeCases) {
        const name = w.label || w.table;
        if (w.insert && !w.label) {
          const row = w.insert();
          const before = sql(`select count(*) from public.${w.table}`);
          const res = await run(() => c.from(w.table).insert(row).select());
          const after = sql(`select count(*) from public.${w.table}`);
          record(who, "write", `${name}: insert`, ["denied"], res, { stateOk: before === after, state: before === after ? "row count unchanged" : `row count ${before} -> ${after}` });
        }
        if (w.update) {
          const before = snap(w.table, w.where);
          const res = await run(() => c.from(w.table).update(w.update).eq(w.key[0], w.key[1]).select());
          const same = snap(w.table, w.where) === before;
          record(who, "write", `${name}: update`, ["denied", "empty"], res, { stateOk: same, state: same ? "row unchanged" : "ROW CHANGED" });
        }
        if (!w.label) {
          const before = snap(w.table, w.where);
          const res = await run(() => c.from(w.table).delete().eq(w.key[0], w.key[1]).select());
          const same = snap(w.table, w.where) === before;
          record(who, "write", `${name}: delete`, ["denied", "empty"], res, { stateOk: same, state: same ? "row unchanged" : "ROW CHANGED" });
        }
      }
      // Profiles: no self-promotion, no changing anyone else's role, no forged profile rows.
      for (const [label, target] of [["own role -> admin", users[0].id], ["another user's role -> admin", users[1].id]]) {
        const before = snap("profiles", `id = '${target}'`);
        const res = await run(() => c.from("profiles").update({ role: "admin" }).eq("id", target).select());
        const same = snap("profiles", `id = '${target}'`) === before;
        record(who, "write", `profiles: ${label}`, ["denied", "empty"], res, { stateOk: same, state: same ? "role still 'user'" : "ROLE CHANGED" });
      }
      const before = sql("select count(*) from public.profiles");
      const res = await run(() => c.from("profiles").insert({ id: randomUUID(), role: "admin" }).select());
      const same = sql("select count(*) from public.profiles") === before;
      record(who, "write", "profiles: insert an admin profile", ["denied"], res, { stateOk: same, state: same ? "row count unchanged" : "ROW ADDED" });
      // The service-only RPC.
      const hits = sql("select coalesce(sum(hits), 0) from public.order_rate_limits");
      const rpc = await run(() => c.rpc("consume_order_rate_limit", { p_client: "ip:" + "0".repeat(64), p_client_limit: 5, p_global_limit: 100, p_window_seconds: 3600 }));
      const sameHits = sql("select coalesce(sum(hits), 0) from public.order_rate_limits") === hits;
      record(who, "rpc", "consume_order_rate_limit (service-only)", ["denied"], rpc, { stateOk: sameHits, state: sameHits ? "counters unchanged" : "COUNTERS CHANGED" });
    }

    // ---- 3. the admin: permitted operations succeed (each restored), owner-only ones stay refused
    {
      const before = snap("analyses", `id = '${F.aDraft}'`);
      record("admin", "write", "analyses: update a draft title", ["allowed"], await run(() => admin.from("analyses").update({ title: "QA Sec Draft Analysis (edited)" }).eq("id", F.aDraft).select()), { state: snap("analyses", `id = '${F.aDraft}'`) !== before ? "row changed as intended" : "", stateOk: snap("analyses", `id = '${F.aDraft}'`) !== before });
      await admin.from("analyses").update({ title: "QA Sec Draft Analysis" }).eq("id", F.aDraft);
      const tagId = id(95);
      record("admin", "write", "tags: insert", ["allowed"], await run(() => admin.from("tags").insert({ id: tagId, name: "QA Sec Admin Tag" }).select()));
      record("admin", "write", "tags: delete", ["allowed"], await run(() => admin.from("tags").delete().eq("id", tagId).select()), { stateOk: sql(`select count(*) from public.tags where id = '${tagId}'`) === "0", state: "removed" });
      record("admin", "write", "analysis_slides: insert", ["allowed"], await run(() => admin.from("analysis_slides").insert({ id: id(96), analysis_id: F.aDraft, storage_path: `analysis/${F.aDraft}/qa-sec-2.png`, position: 1 }).select()));
      record("admin", "write", "analysis_slides: delete", ["allowed"], await run(() => admin.from("analysis_slides").delete().eq("id", id(96)).select()));
      record("admin", "write", "orders: status -> fulfilled", ["allowed"], await run(() => admin.from("orders").update({ status: "fulfilled" }).eq("id", F.order).select()), { stateOk: sql(`select status from public.orders where id = '${F.order}'`) === "fulfilled", state: "status fulfilled" });
      record("admin", "write", "orders: status restored -> pending", ["allowed"], await run(() => admin.from("orders").update({ status: "pending" }).eq("id", F.order).select()), { stateOk: sql(`select status from public.orders where id = '${F.order}'`) === "pending", state: "status pending" });
      // By design even the admin cannot: change customer/payment fields, create or delete orders, change roles.
      const ob = snap("orders", `id = '${F.order}'`);
      record("admin", "write", "orders: change customer email (immutable)", ["denied"], await run(() => admin.from("orders").update({ customer_email: "qa-sec-changed@example.test" }).eq("id", F.order).select()), { stateOk: snap("orders", `id = '${F.order}'`) === ob, state: "row unchanged" });
      const oc = sql("select count(*) from public.orders");
      record("admin", "write", "orders: insert (server-side only)", ["denied"], await run(() => admin.from("orders").insert({ customer_name: "QA Sec", customer_email: "qa-sec-x@example.test", bkash_number: "01700000000", bkash_transaction_number: `QASECX${Date.now()}`, case_study_title_snapshot: "x", price_bdt_snapshot: 0 }).select()), { stateOk: sql("select count(*) from public.orders") === oc, state: "row count unchanged" });
      record("admin", "write", "orders: delete (never deleted)", ["denied", "empty"], await run(() => admin.from("orders").delete().eq("id", F.order).select()), { stateOk: snap("orders", `id = '${F.order}'`) === ob, state: "row unchanged" });
      const pb = snap("profiles", `id = '${users[0].id}'`);
      record("admin", "write", "profiles: grant admin via the API (owner-only)", ["denied", "empty"], await run(() => admin.from("profiles").update({ role: "admin" }).eq("id", users[0].id).select()), { stateOk: snap("profiles", `id = '${users[0].id}'`) === pb, state: "role still 'user'" });
      record("admin", "write", "order_rate_limits: delete (service-only)", ["denied"], await run(() => admin.from("order_rate_limits").delete().eq("bucket", "global").select()));
    }

    // ---- 4. Storage
    const objectSnap = (p) => sql(`select coalesce(md5(string_agg(coalesce(metadata::text, '') || updated_at::text, '|')), 'absent') from storage.objects where bucket_id = '${BUCKET}' and name = '${p}'`);
    for (const who of ["anonymous", "non-admin"]) {
      const s = identities[who].storage.from(BUCKET);
      const newPath = `case-studies/${F.csPub}/qa-sec-${who}-new.png`;
      let r = await run(() => s.upload(newPath, png, { contentType: "image/png" }));
      record(who, "storage", "upload a new object", ["denied"], r, { stateOk: objectSnap(newPath) === "absent", state: objectSnap(newPath) === "absent" ? "object absent" : "OBJECT CREATED" });
      let before = objectSnap(objects.pub);
      r = await run(() => s.upload(objects.pub, png, { contentType: "image/png", upsert: true }));
      record(who, "storage", "replace a published cover (upsert)", ["denied"], r, { stateOk: objectSnap(objects.pub) === before, state: objectSnap(objects.pub) === before ? "object unchanged" : "OBJECT REPLACED" });
      r = await run(() => s.update(objects.pub, png, { contentType: "image/png" }));
      record(who, "storage", "update a published cover", ["denied"], r, { stateOk: objectSnap(objects.pub) === before, state: objectSnap(objects.pub) === before ? "object unchanged" : "OBJECT REPLACED" });
      r = await run(() => s.list(`case-studies/${F.csPub}`));
      record(who, "storage", "list a prefix that holds objects", ["empty"], r, { state: "listing hidden (objects exist)" });
      r = await run(() => s.remove([objects.pub]));
      record(who, "storage", "delete a published cover", ["empty", "denied"], r, { stateOk: objectSnap(objects.pub) === before, state: objectSnap(objects.pub) === before ? "object still present" : "OBJECT DELETED" });
      before = objectSnap(objects.draft);
      r = await run(() => s.move(objects.draft, `case-studies/${F.csPub}/qa-sec-moved.png`));
      record(who, "storage", "move (rename) a draft cover", ["denied", "hidden"], r, { stateOk: objectSnap(objects.draft) === before, state: objectSnap(objects.draft) === before ? "object unchanged" : "OBJECT MOVED" });
    }
    {
      const s = admin.storage.from(BUCKET);
      const p = `case-studies/${F.csPub}/qa-sec-admin.png`;
      record("admin", "storage", "upload a new object", ["allowed"], await run(() => s.upload(p, png, { contentType: "image/png" })), { stateOk: objectSnap(p) !== "absent", state: "object created" });
      record("admin", "storage", "list the prefix", ["allowed"], await run(() => s.list(`case-studies/${F.csPub}`)));
      const before = objectSnap(p);
      record("admin", "storage", "replace it (upsert)", ["allowed"], await run(() => s.upload(p, png, { contentType: "image/png", upsert: true })), { stateOk: objectSnap(p) !== before, state: "object replaced" });
      record("admin", "storage", "delete it", ["allowed"], await run(() => s.remove([p])), { stateOk: objectSnap(p) === "absent", state: "object removed" });
      const html = `case-studies/${F.csPub}/qa-sec.html`, svg = `case-studies/${F.csPub}/qa-sec.svg`, big = `case-studies/${F.csPub}/qa-sec-big.png`;
      record("admin", "storage", "bucket refuses text/html", ["rejected"], await run(() => s.upload(html, Buffer.from("<script>alert(1)</script>"), { contentType: "text/html" })), { stateOk: objectSnap(html) === "absent", state: "object absent" });
      record("admin", "storage", "bucket refuses image/svg+xml", ["rejected"], await run(() => s.upload(svg, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), { contentType: "image/svg+xml" })), { stateOk: objectSnap(svg) === "absent", state: "object absent" });
      record("admin", "storage", "bucket refuses a file over 5 MB", ["rejected"], await run(() => s.upload(big, Buffer.alloc(5 * 1024 * 1024 + 1), { contentType: "image/png" })), { stateOk: objectSnap(big) === "absent", state: "object absent" });
    }
    // Public delivery: published media by URL works; the bucket is public, so a draft's media is reachable
    // too if its (unguessable) path is known -- by design (migration 9), reported as such.
    for (const [label, p, expectStatus] of [["published cover", objects.pub, 200], ["draft cover (by design: public bucket)", objects.draft, 200], ["non-existent object", `case-studies/${F.csPub}/qa-sec-missing.png`, 400]]) {
      const r = await run(() => fetch(`${API}/storage/v1/object/public/${BUCKET}/${p}`));
      const status = r?.status, type = r?.headers?.get?.("content-type") || "";
      const ok = expectStatus === 200 ? status === 200 && /^image\/png/.test(type) : status === 400 || status === 404;
      rows.push({ identity: "anonymous", area: "storage", operation: `public URL: ${label}`, expected: expectStatus === 200 ? "200 image/png" : "400|404", actual: r?.thrown ? "network" : `${status} ${type.split(";")[0]}`.trim(), state: "", ok: ok && !r?.thrown, category: ok ? "" : r?.thrown ? "infra" : "policy/app", detail: "" });
    }
  }

  await cleanup();
  const leftover = setupFailed ? "" : sql("select (select count(*) from public.analyses where id::text like 'c0ffee00-%') + (select count(*) from public.case_studies where id::text like 'c0ffee00-%') + (select count(*) from public.articles where id::text like 'c0ffee00-%') + (select count(*) from public.tags where id::text like 'c0ffee00-%') + (select count(*) from public.orders where id::text like 'c0ffee00-%') + (select count(*) from storage.objects where name like '%qa-sec%') + (select count(*) from auth.users where email like 'qa-sec-%@example.test')");

  // ---- report
  if (setupFailed) console.log(`SETUP FAILED: ${setupFailed} (no security result; this is not a pass)`);
  for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  [${r.identity}] ${r.area}: ${r.operation} — expected ${r.expected}, got ${r.actual}${r.state ? `; ${r.state}` : ""}${r.ok ? "" : ` (${r.category}${r.detail ? `: ${r.detail}` : ""})`}`);
  const failed = rows.filter((r) => !r.ok);
  const cleanOk = setupFailed || leftover === "0";
  if (!cleanOk) console.log(`CLEANUP FAILED: ${leftover} synthetic record(s) or object(s) left in the QA stack`);
  console.log(`\nRLS/Storage probes: ${rows.length - failed.length} passed, ${failed.length} failed${setupFailed ? ", setup failed" : ""}; synthetic data removed: ${cleanOk ? "yes" : "NO"}`);
  if (OUT) writeFileSync(OUT, JSON.stringify({ setupFailed, rows, failed: failed.map((r) => `[${r.identity}] ${r.area}: ${r.operation}`), cleanup: cleanOk }, null, 2));
  process.exit(setupFailed ? 3 : failed.length || !cleanOk ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch((e) => { console.error(`rls-probe aborted (${e?.name || "Error"}: ${String(e?.message || "").slice(0, 120)})`); process.exit(2); });
