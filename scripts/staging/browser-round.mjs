// Browser round against the STAGING Worker (Stage 05E-B2A): page views, admin/CMS, orders.
//
// Usage: node scripts/staging/browser-round.mjs <base> --out result.json
//   STAGING_ADMIN_EMAIL / STAGING_ADMIN_PASSWORD: the staging admin (secrets; typed into the form,
//   never printed). CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET: Access service token, attached
//   only to requests for the staging origin (never sent to Supabase or anywhere else).
// Writes synthetic data to STAGING only (an order with a synthetic Transaction ID, a CMS title edit
// that is restored, a cover upload). Prints check names and outcomes only.
// The result file is written even when the round stops early: an unexpected error is recorded as a
// failed "browser round completed" check and the process exits 2, so an incomplete round never passes.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { checkStagingSite } from "./isolation.mjs";

const args = process.argv.slice(2);
const BASE = (args[0] || "").replace(/\/$/, "");
const OUT = (() => { const i = args.indexOf("--out"); return i >= 0 ? args[i + 1] : null; })();
const ACCESS = process.env.CF_ACCESS_CLIENT_ID ? { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET } : {};
const ADMIN_EMAIL = process.env.STAGING_ADMIN_EMAIL, ADMIN_PASSWORD = process.env.STAGING_ADMIN_PASSWORD;
const LOGIN_PATH = "/admin/login";
const LOGIN_ERRORS = ["invalid_credentials", "unauthorized", "missing_fields"];
const ADMIN_PAGES = ["/admin", "/admin/analysis", "/admin/articles", "/admin/case-studies", "/admin/orders", "/admin/tags"];
// Checks that need a signed-in admin; recorded as failures (never passes) when login fails.
const ADMIN_DEPENDENT = [...ADMIN_PAGES.map((p) => `admin page ${p}`), "order status change (Pending -> Invalid)", "CMS edit visible on the public page within 60 s", "CMS title restored", "cover upload reaches Storage"];
// Headers the app sets on its own responses (lib/security-headers.ts). Used only as a fingerprint.
const WORKER_HEADERS = ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "cross-origin-opener-policy", "permissions-policy"];

async function loadPlaywright() {
  try { return await import("playwright"); } catch {}
  const require = createRequire(execSync("npm root -g").toString().trim() + "/");
  return require("playwright");
}

const checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 160) }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 160) : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (path, init = {}) => fetch(BASE + path, { redirect: "manual", ...init, headers: { ...ACCESS, ...(init.headers || {}) } });
const pathOf = (url) => { try { return new URL(url).pathname; } catch { return ""; } };

/** What a response reveals about its origin: app JSON body, app security headers, edge ray id. */
async function fingerprint(res) {
  const text = await res.text().catch(() => "");
  let json = null; try { json = JSON.parse(text); } catch {}
  return {
    status: res.status,
    appJson: /application\/json/i.test(res.headers.get("content-type") || "") && !!json && typeof json.error === "string",
    error: json && typeof json.error === "string" ? json.error : null,
    workerHeaders: WORKER_HEADERS.filter((h) => res.headers.has(h)),
    ray: res.headers.has("cf-ray"),
    // Edge error bodies are short public text; printable ASCII only, truncated.
    snippet: text.replace(/[^\x20-\x7e]+/g, " ").trim().slice(0, 60),
  };
}

/**
 * A 403 counts as a secure rejection only with evidence that it never reached the Worker. The
 * reference is the Worker's own 429 for the same route moments earlier (app JSON "rate_limited").
 * The 403 must not be app JSON (the route's own 403 is {"error":"forbidden"}), must carry none of
 * the security headers the reference carried, and must have passed through the Cloudflare edge.
 */
function edgeRejection(reference, res) {
  const reasons = [];
  if (!(reference.status === 429 && reference.appJson && reference.error === "rate_limited")) reasons.push("no Worker reference response");
  if (res.status !== 403) reasons.push(`status ${res.status}`);
  if (res.appJson) reasons.push(`app JSON (${res.error})`);
  const shared = reference.workerHeaders.filter((h) => res.workerHeaders.includes(h));
  if (shared.length) reasons.push(`Worker headers present (${shared.join(", ")})`);
  if (!res.ray) reasons.push("no cf-ray");
  const evidence = `403; app JSON no; Worker headers none of [${reference.workerHeaders.join(", ") || "none on reference"}]; cf-ray ${res.ray ? "yes" : "no"}; body "${res.snippet}"`;
  return { ok: reasons.length === 0, detail: reasons.length ? `not proven edge-blocked: ${reasons.join("; ")}` : evidence };
}

let browser = null, step = "start";
let pageStats = [], requestsPerView = null;

async function run() {
  step = "isolation gate";
  await checkStagingSite(BASE, ACCESS);
  step = "browser launch";
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const origin = new URL(BASE).origin;
  // Access headers for the staging origin only.
  await context.route("**/*", (route) => {
    const req = route.request();
    if (new URL(req.url()).origin === origin && Object.keys(ACCESS).length) return route.continue({ headers: { ...req.headers(), ...Object.fromEntries(Object.entries(ACCESS).map(([k, v]) => [k.toLowerCase(), v])) } });
    return route.continue();
  });

  // ---- A. page views: Worker requests per view and page weight
  step = "page views";
  const page = await context.newPage();
  const cs = [...(await (await api("/case-studies")).text()).matchAll(/href="\/case-studies\/([a-z0-9-]+)"/g)].map((m) => m[1])[0];
  const an = ((await (await api("/api/analysis")).json().catch(() => ({}))).items || [])[0]?.slug;
  const ar = [...(await (await api("/articles")).text()).matchAll(/href="\/articles\/([a-z0-9-]+)"/g)].map((m) => m[1])[0];
  const views = ["/", "/analysis", "/articles", "/case-studies", cs && `/case-studies/${cs}`, an && `/analysis/${an}`, ar && `/articles/${ar}`].filter(Boolean);
  for (const path of views) {
    const reqs = [];
    const onResponse = async (res) => { const u = new URL(res.url()); const len = Number(res.headers()["content-length"] || 0) || (await res.body().catch(() => Buffer.alloc(0))).length; reqs.push({ worker: u.origin === origin && !u.pathname.startsWith("/_next/static/") && !/\.(woff2?|css|js)$/.test(u.pathname), host: u.origin === origin ? "staging" : "other", bytes: len, type: res.request().resourceType() }); };
    page.on("response", onResponse);
    await page.goto(BASE + path, { waitUntil: "load" }); await sleep(3000); // let link prefetches fire
    page.off("response", onResponse);
    pageStats.push({ path, workerRequests: reqs.filter((r) => r.worker).length, totalKB: Math.round(reqs.reduce((s, r) => s + r.bytes, 0) / 1024), imageKB: Math.round(reqs.filter((r) => r.type === "image").reduce((s, r) => s + r.bytes, 0) / 1024) });
  }
  console.table(pageStats);
  // Set only once every view was measured, so a partial round never yields a projection.
  requestsPerView = pageStats.reduce((s, p) => s + p.workerRequests, 0) / pageStats.length;

  // ---- B. security, SEO, staging identification
  step = "security and SEO";
  const home = await api("/");
  check("homepage: CSP, nosniff, frame protection, noindex", ["content-security-policy", "x-content-type-options", "x-frame-options"].every((h) => home.headers.get(h)) && /noindex/.test(home.headers.get("x-robots-tag") || ""));
  check("robots.txt disallows everything", /Disallow:\s*\/\s*$/m.test(await (await api("/robots.txt")).text()));
  const sm = await api("/sitemap.xml"); check("sitemap.xml answers XML", sm.status === 200 && /<urlset/.test(await sm.text()));
  await page.goto(BASE + "/"); check("staging banner visible", await page.getByRole("note", { name: "Test site" }).isVisible());
  if (cs) { await page.goto(BASE + `/case-studies/${cs}/buy`); const t = await page.locator("main").innerText(); check("buy page shows only the non-payable placeholder", /STAGING-NOT-PAYABLE/.test(t) && /Do not send money/.test(t) && !/01[3-9]\d{2}\s?\d{6}/.test(t)); }

  // ---- C. orders (synthetic Transaction IDs; the recipient is the non-payable placeholder)
  step = "orders";
  const price = Number(((await (await api(`/case-studies/${cs}/buy`)).text()).match(/BDT\s?([\d,]+)/) || [])[1]?.replace(/,/g, "") || 0);
  const tx = `STG${Date.now().toString(36).toUpperCase()}`;
  const order = (email, txn) => api("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ slug: cs, expectedPriceBdt: price, customerName: "Staging Tester", email, bkashNumber: "01712345678", transactionNumber: txn }) });
  const r1 = await order("buyer.one@example.test", tx); const j1 = await r1.json().catch(() => ({}));
  check("order accepted (201, Pending, number only)", r1.status === 201 && j1.status === "pending" && Object.keys(j1).sort().join() === "caseStudyTitle,orderNumber,priceBdt,status", r1.status);
  const r2 = await order("buyer.one@example.test", tx.toLowerCase()); const j2 = await r2.json().catch(() => ({}));
  check("same details again (case variant) -> same order (200)", r2.status === 200 && j2.orderNumber === j1.orderNumber, r2.status);
  const r3 = await order("someone.else@example.test", ` ${tx} `);
  check("same Transaction ID, other email -> 409 duplicate_transaction", r3.status === 409 && (await r3.json().catch(() => ({}))).error === "duplicate_transaction", r3.status);
  let limited = 0, sent = 3;
  while (sent < 10 && !limited) { const r = await order(`rl${sent}@example.test`, `${tx}R${sent}`); sent++; if (r.status === 429) limited = sent; }
  // Limit 5 per IP per hour (lib/order-rate-limit-core.ts); the three submissions above count, so a fresh
  // window gives 201, 200, 409, 201, 201, then 429 at exactly #6. Earlier means the window was not fresh.
  check("per-IP rate limit: 429 at exactly the 6th submission (fresh window)", r1.status === 201 && limited === 6, `429 at #${limited || "none"}`);
  // Client-supplied address headers must not open a new bucket: the Worker trusts only CF-Connecting-IP.
  const spoof = (headers, n) => api("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, ...headers }, body: JSON.stringify({ slug: cs, expectedPriceBdt: price, customerName: "Staging Tester", email: `spoof${n}@example.test`, bkashNumber: "01712345678", transactionNumber: `${tx}SPOOF${n}` }) });
  const s1 = await fingerprint(await spoof({ "X-Forwarded-For": "203.0.113.7", "X-Real-IP": "203.0.113.7" }, 1));
  check("spoofed X-Forwarded-For / X-Real-IP do not reset the limit (429)", s1.status === 429, s1.status);
  // Cloudflare's edge sets CF-Connecting-IP itself; local workerd passes a client value through, so this
  // part is meaningful only against the deployed Worker. Either the Worker ignores the client value (429),
  // or the edge refuses the request before the Worker runs (403 with edge evidence; see edgeRejection).
  if (/\.workers\.dev$/.test(new URL(BASE).hostname)) {
    const s2 = await fingerprint(await spoof({ "CF-Connecting-IP": "203.0.113.7" }, 2));
    if (s2.status === 403) {
      const edge = edgeRejection(s1, s2);
      check("spoofed CF-Connecting-IP refused at the Cloudflare edge, before the Worker (403)", edge.ok, edge.detail);
    } else check("spoofed CF-Connecting-IP does not reset the limit (429)", s2.status === 429, s2.status);
    const s3 = await order("after.spoof@example.test", `${tx}AFTER`);
    check("rate limit still in force after the spoof attempts (429)", s3.status === 429, s3.status);
  } else console.log("   (CF-Connecting-IP spoof check runs only against the deployed Worker)");

  // ---- D0. admin refuses anonymous visitors (proxy redirect + requireAdmin)
  step = "anonymous admin";
  for (const p of ["/admin", "/admin/orders"]) {
    const r = await api(p);
    check(`anonymous ${p} -> redirect to login`, [302, 303, 307, 308].includes(r.status) && /\/admin\/login/.test(r.headers.get("location") || ""), r.status);
  }

  // ---- D. admin / CMS (staging admin; credentials typed, never printed)
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    step = "admin login";
    await page.goto(BASE + LOGIN_PATH);
    await page.fill('input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    // Success redirects to /admin; failure to /admin/login?error=<code>. Stop waiting on either.
    await Promise.all([page.waitForURL((u) => u.pathname !== LOGIN_PATH || u.searchParams.has("error"), { timeout: 30000 }).catch(() => {}), page.click('button[type="submit"]')]);
    const after = new URL(page.url());
    const loggedIn = after.pathname !== LOGIN_PATH && after.pathname.startsWith("/admin");
    const code = after.searchParams.get("error");
    check("admin login", loggedIn, loggedIn ? after.pathname : `still on ${LOGIN_PATH}${code ? ` (error=${LOGIN_ERRORS.includes(code) ? code : "other"})` : ""}`);
    if (!loggedIn) {
      for (const name of ADMIN_DEPENDENT) check(name, false, "not run: admin login failed");
    } else {
      step = "admin pages";
      // A redirect to the login page answers 200 too, so the final path must be the page requested.
      for (const p of ADMIN_PAGES) { const res = await page.goto(BASE + p); const final = pathOf(page.url()); check(`admin page ${p}`, res && res.status() === 200 && final === p, `${res?.status()} ${final}`); }
      // Status change on the order created above.
      step = "order status change";
      await page.goto(BASE + "/admin/orders");
      const href = j1.orderNumber ? await page.getByRole("link", { name: j1.orderNumber }).first().getAttribute("href", { timeout: 15000 }).catch(() => null) : null;
      if (href) {
        await page.goto(BASE + href);
        const invalid = page.getByRole("button", { name: `Mark order ${j1.orderNumber} as Invalid` });
        if (await invalid.waitFor({ timeout: 30000 }).then(() => true, () => false)) { await invalid.click(); await page.waitForURL(/notice=invalid/, { timeout: 30000 }).catch(() => {}); }
      }
      check("order status change (Pending -> Invalid)", /notice=invalid/.test(page.url()), href ? pathOf(page.url()) : "order not listed");
      // CMS edit -> public freshness (within 60 s), then restore.
      step = "CMS edit";
      await page.goto(BASE + "/admin/case-studies"); await page.getByRole("link", { name: /Staging Case Study 1:/ }).first().click();
      await page.waitForURL(/\/edit/); const original = await page.inputValue("#title"); const marker = ` (fresh ${Date.now() % 100000})`;
      await page.fill("#title", original + marker); await page.getByRole("button", { name: /^(Update|Save draft|Publish)$/ }).first().click(); await page.waitForURL(/notice=/, { timeout: 30000 }).catch(() => {});
      let fresh = 0; for (let t = 0; t < 12 && !fresh; t++) { const html = await (await api("/case-studies/staging-case-study-1")).text(); if (html.includes(marker.trim())) fresh = (t + 1) * 5; else await sleep(5000); }
      check("CMS edit visible on the public page within 60 s", fresh > 0, fresh ? `~${fresh}s` : "not seen");
      await page.fill("#title", original); await page.getByRole("button", { name: /^(Update|Save draft|Publish)$/ }).first().click(); await page.waitForURL(/notice=/, { timeout: 30000 }).catch(() => {});
      check("CMS title restored", (await page.inputValue("#title").catch(() => "")) === original);
      // Cover upload to staging Storage (a small generated image).
      step = "cover upload";
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
      await page.setInputFiles("#cover-file", { name: "cover.png", mimeType: "image/png", buffer: png }).catch(() => {});
      check("cover upload reaches Storage", await page.getByText(/New cover/).first().waitFor({ timeout: 30000 }).then(() => true, () => false));
    }
  } else console.log("   (admin/CMS steps skipped: no staging admin credentials)");
  step = "done";
}

let aborted = null, written = false;
function writeResults() {
  written = true;
  // Error name and step only: messages can echo URLs, selectors or typed values.
  if (aborted) check("browser round completed", false, `aborted during ${aborted.step} (${aborted.error}); later checks did not run`);
  const out = { checks, pageStats, requestsPerView: Number.isFinite(requestsPerView) ? requestsPerView : null, aborted, failed: checks.filter((c) => !c.ok).map((c) => c.name) };
  console.log(`\n${checks.filter((c) => c.ok).length} passed, ${out.failed.length} failed; Worker requests per page view: ${out.requestsPerView === null ? "not measured" : out.requestsPerView.toFixed(1)}`);
  if (OUT) { try { writeFileSync(OUT, JSON.stringify(out, null, 2)); } catch { console.error("browser round: could not write the result file"); return false; } }
  return out;
}
// An isolation refusal (isolation.mjs fail()) exits 97 directly; record it in the result file too.
process.on("exit", (code) => { if (!written) { aborted = { step, error: `exit ${code}` }; writeResults(); } });

try { await run(); } catch (e) { aborted = { step, error: e?.name || "Error" }; }
try { if (browser) await browser.close(); } catch {}
const out = writeResults();
process.exit(!out || aborted ? 2 : out.failed.length ? 1 : 0);
