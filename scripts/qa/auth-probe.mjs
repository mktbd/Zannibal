// Level 2 QA (Stage 3A): admin authentication and authorization in a real browser against the local
// Worker and the DISPOSABLE local QA Supabase.
//
// Usage: node scripts/qa/auth-probe.mjs <base> --out result.json [--throttle]   (run by scripts/qa/local.sh)
// Env (local QA values only): QA_API_URL, QA_SERVICE_ROLE_KEY, QA_DB_URL, QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD.
//
// Checks: logout (and replaying the signed-out session's cookies), a real non-admin account against admin
// pages and a Server Action, and an admin session revoked or dropped in the middle of an edit. Every refused
// save is checked against the database (psql as the table owner): the record must be unchanged.
// Synthetic records only (a draft Case Study with id c0ffee00-...-a01, one @example.test non-admin account),
// removed at the end. Refuses to run unless the target is the local QA stack and the local Worker.
import { createClient } from "@supabase/supabase-js";
import { spawnSync, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
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
const LOGIN = "/admin/login";
const FIXTURE = "c0ffee00-0000-4000-8000-000000000a01";
const FIXTURE_TITLE = "QA Sec Auth Edit Target";
const quote = (v) => `'${String(v).replace(/'/g, "''")}'`;
const rows = [];
const check = (identity, operation, expected, actual, ok, detail = "") => {
  rows.push({ identity, operation, expected, actual, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${identity}] ${operation} — expected ${expected}, got ${actual}${detail ? `; ${detail}` : ""}`);
};
const fixtureSnap = () => sql(`select coalesce(md5(t::text), 'absent') from public.case_studies t where id = '${FIXTURE}'`);
const service = createClient(env.QA_API_URL, env.QA_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let browser, nonAdmin = null, setupFailed = null, step = "setup";

async function newContext() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  if (THROTTLE) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 100, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  }
  return { context, page };
}
async function login(page, email, password) {
  await page.goto(BASE + LOGIN);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => u.pathname !== LOGIN || u.searchParams.has("error"), { timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);
  return new URL(page.url());
}
const where = (page) => { const u = new URL(page.url()); return `${u.pathname}${u.searchParams.get("error") ? `?error=${u.searchParams.get("error")}` : ""}`; };
/** Open the fixture's editor and type a changed title, ready to save. */
async function openEditWithChange(page) {
  await page.goto(`${BASE}/admin/case-studies/${FIXTURE}/edit`);
  await page.locator("#title").waitFor({ timeout: 15000 });
  await page.fill("#title", `${FIXTURE_TITLE} (should not be saved)`);
}
/** Click the editor's save button and wait for wherever the app sends us (up to 30 s). */
async function clickSave(page) {
  const start = page.url();
  await Promise.all([page.waitForURL((u) => u.href !== start, { timeout: 30000 }).catch(() => {}), page.getByRole("button", { name: /^(Update|Save draft|Publish)$/ }).first().click({ timeout: 15000 })]);
  await page.waitForLoadState("load").catch(() => {});
}

try {
  sql(`delete from public.case_studies where id = '${FIXTURE}';
    insert into public.case_studies (id, title, slug, status, price_bdt) values ('${FIXTURE}', ${quote(FIXTURE_TITLE)}, 'qa-sec-auth-edit-target', 'draft', 900);`);
  const email = `qa-sec-auth-${randomUUID().slice(0, 8)}@example.test`, password = `qa-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error("could not create the non-admin account");
  nonAdmin = { id: data.user.id, email, password };
  if (sql(`select role from public.profiles where id = '${nonAdmin.id}'`) !== "user") throw new Error("the non-admin account did not get role 'user'");
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch();
} catch (e) { setupFailed = e.message; }

if (!setupFailed) {
  try {
    // ---- A. logout, then the signed-out session's cookies replayed in a fresh browser
    step = "logout";
    {
      const { context, page } = await newContext();
      const after = await login(page, env.QA_ADMIN_EMAIL, env.QA_ADMIN_PASSWORD);
      check("admin", "sign in", "/admin", after.pathname, after.pathname === "/admin");
      const saved = await context.cookies();
      await Promise.all([page.waitForURL((u) => u.pathname === LOGIN, { timeout: 30000 }).catch(() => {}), page.getByRole("button", { name: "Sign out" }).click({ timeout: 15000 })]);
      check("admin", "sign out", LOGIN, where(page), new URL(page.url()).pathname === LOGIN);
      for (const p of ["/admin", "/admin/orders", `/admin/case-studies/${FIXTURE}/edit`]) {
        await page.goto(BASE + p);
        check("signed out", `GET ${p.replace(FIXTURE, "<fixture>")}`, LOGIN, where(page), new URL(page.url()).pathname === LOGIN);
      }
      const replay = await newContext();
      await replay.context.addCookies(saved);
      await replay.page.goto(`${BASE}/admin/orders`);
      check("replayed cookies", "GET /admin/orders with the signed-out session's cookies", LOGIN, where(replay.page), new URL(replay.page.url()).pathname === LOGIN, "the session is revoked server-side, not just forgotten by the browser");
      await replay.context.close(); await context.close();
    }

    // ---- B. a real non-admin account
    step = "non-admin";
    let nonAdminCookies;
    {
      const { context, page } = await newContext();
      const after = await login(page, nonAdmin.email, nonAdmin.password);
      check("non-admin", "sign in at /admin/login", `${LOGIN}?error=unauthorized`, where(page), after.pathname === LOGIN && after.searchParams.get("error") === "unauthorized");
      for (const p of ["/admin", "/admin/orders", "/admin/tags", `/admin/case-studies/${FIXTURE}/edit`]) {
        await page.goto(BASE + p);
        const leaked = (await page.content()).includes(FIXTURE_TITLE);
        check("non-admin", `GET ${p.replace(FIXTURE, "<fixture>")}`, `${LOGIN} (no admin content)`, where(page), new URL(page.url()).pathname === LOGIN && !leaked, leaked ? "ADMIN CONTENT IN THE RESPONSE" : "");
      }
      nonAdminCookies = await context.cookies();
      await context.close();
    }
    // A Server Action sent with the non-admin's session: open the editor as admin, switch the browser's
    // session to the non-admin's, then save. requireAdmin() must refuse it and nothing may be written.
    {
      const { context, page } = await newContext();
      await login(page, env.QA_ADMIN_EMAIL, env.QA_ADMIN_PASSWORD);
      await openEditWithChange(page);
      const before = fixtureSnap();
      await context.clearCookies();
      await context.addCookies(nonAdminCookies);
      await clickSave(page);
      const same = fixtureSnap() === before;
      check("non-admin", "Server Action: save the Case Study editor", `${LOGIN}?error=unauthorized, record unchanged`, `${where(page)}, record ${same ? "unchanged" : "CHANGED"}`, new URL(page.url()).pathname === LOGIN && same);
      await context.close();
    }

    // ---- C. the admin session revoked server-side mid-edit (e.g. signed out elsewhere / revoked)
    step = "revoked session";
    {
      const { context, page } = await newContext();
      await login(page, env.QA_ADMIN_EMAIL, env.QA_ADMIN_PASSWORD);
      await openEditWithChange(page);
      const before = fixtureSnap();
      const revoked = sql(`with d as (delete from auth.sessions where user_id = (select id from auth.users where email = ${quote(env.QA_ADMIN_EMAIL)}) returning 1) select count(*) from d`);
      await clickSave(page);
      const same = fixtureSnap() === before;
      check("revoked admin session", "save after the session was revoked", `${LOGIN}, record unchanged`, `${where(page)}, record ${same ? "unchanged" : "CHANGED"}`, new URL(page.url()).pathname === LOGIN && same, `${revoked} session(s) revoked`);
      await context.close();
    }

    // ---- D. the session gone from the browser mid-edit (an expired/cleared session cookie)
    step = "dropped session";
    {
      const { context, page } = await newContext();
      await login(page, env.QA_ADMIN_EMAIL, env.QA_ADMIN_PASSWORD);
      await openEditWithChange(page);
      const before = fixtureSnap();
      await context.clearCookies();
      await clickSave(page);
      const same = fixtureSnap() === before;
      check("expired admin session", "save after the session cookie expired", `${LOGIN}, record unchanged`, `${where(page)}, record ${same ? "unchanged" : "CHANGED"}`, new URL(page.url()).pathname === LOGIN && same);
      await context.close();
    }

    // ---- E. control: a valid admin session can still save (so the refusals above mean something)
    step = "control";
    {
      const { context, page } = await newContext();
      await login(page, env.QA_ADMIN_EMAIL, env.QA_ADMIN_PASSWORD);
      await page.goto(`${BASE}/admin/case-studies/${FIXTURE}/edit`);
      await page.locator("#title").waitFor({ timeout: 15000 });
      await page.fill("#title", `${FIXTURE_TITLE} (admin)`);
      await clickSave(page);
      const saved = sql(`select title from public.case_studies where id = '${FIXTURE}'`);
      check("admin", "control: save with a valid session", "saved", saved === `${FIXTURE_TITLE} (admin)` ? "saved" : `not saved (${where(page)})`, saved === `${FIXTURE_TITLE} (admin)`);
      await context.close();
    }
  } catch (e) {
    check("probe", `${step} step`, "completed", `aborted (${e?.name || "Error"})`, false, "later checks did not run");
  }
}

try { if (browser) await browser.close(); } catch {}
let cleanOk = true;
try {
  sql(`delete from public.case_studies where id = '${FIXTURE}' or slug = 'qa-sec-auth-edit-target';`);
  if (nonAdmin) await service.auth.admin.deleteUser(nonAdmin.id);
  cleanOk = sql(`select (select count(*) from public.case_studies where id = '${FIXTURE}') + (select count(*) from auth.users where email like 'qa-sec-auth-%@example.test')`) === "0";
} catch { cleanOk = false; }
if (setupFailed) console.log(`SETUP FAILED: ${setupFailed} (no auth result; this is not a pass)`);
if (!cleanOk) console.log("CLEANUP FAILED: the auth probe's synthetic records were not all removed");
const failed = rows.filter((r) => !r.ok);
console.log(`\nAuth probes: ${rows.length - failed.length} passed, ${failed.length} failed${setupFailed ? ", setup failed" : ""}; synthetic data removed: ${cleanOk ? "yes" : "NO"}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ setupFailed, rows, failed: failed.map((r) => `[${r.identity}] ${r.operation}`), cleanup: cleanOk }, null, 2));
process.exit(setupFailed ? 3 : failed.length || !cleanOk ? 1 : 0);
