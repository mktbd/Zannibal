// Runtime measurement of the STAGING Worker on Cloudflare Workers Paid (Stage 05E-B2B). Never production.
//
// Usage: node scripts/staging/measure.mjs <base> --phase cold|warm|soak [--rounds 3] [--minutes 30] --out result.json
//   base: https://mktbd-staging.<subdomain>.workers.dev (refused otherwise; the site must be behind
//   Cloudflare Access and show the staging banner and noindex before any traffic is sent).
//   CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET: Cloudflare Access service token (staging).
//   CLOUDFLARE_ANALYTICS_TOKEN (Account Analytics: Read) + CLOUDFLARE_ACCOUNT_ID: Cloudflare's own
//   per-window CPU percentiles and invocation outcomes (GraphQL Analytics API): error monitoring
//   and cost planning (CPU is not a pass/fail gate on the Paid plan).
//
// cold: one pass over every route right after a deploy or >= 30 min idle (new isolates).
// warm: repeated sequential and concurrent passes.
// soak: one mixed request every 10 s for --minutes (default 30), one analytics window per 10 min.
// Order POSTs use synthetic Transaction IDs; the staging recipient is the non-payable placeholder.
// Prints aggregates only (no bodies, cookies, tokens).
import { writeFileSync } from "node:fs";
import { checkStagingSite } from "./isolation.mjs";

const args = process.argv.slice(2);
const BASE = (args[0] || "").replace(/\/$/, "");
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PHASE = opt("phase", "warm");
const ROUNDS = Number(opt("rounds", PHASE === "cold" ? 1 : 3));
const OUT = opt("out", null);
const ACCESS = process.env.CF_ACCESS_CLIENT_ID ? { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET } : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const windows = [];

async function hit(label, path, init = {}) {
  const t0 = performance.now();
  let status = 0, bytes = 0, is1102 = false, err = "";
  try {
    const res = await fetch(BASE + path, { redirect: "manual", ...init, headers: { ...ACCESS, ...(init.headers || {}) } });
    const body = Buffer.from(await res.arrayBuffer());
    status = res.status; bytes = body.length;
    is1102 = status >= 500 && /error code: 1102|Error 1102|exceeded resource limits/i.test(body.toString("utf8", 0, 4000));
  } catch (e) { err = e.name; }
  results.push({ label, status, bytes, ms: Math.round(performance.now() - t0), is1102, err });
}
async function window(label, fn) { const start = new Date(); await fn(); await sleep(1500); windows.push({ label, start: start.toISOString(), end: new Date().toISOString() }); }

async function discover() {
  const get = async (p) => (await fetch(BASE + p, { headers: ACCESS })).text();
  const slugs = (html, prefix) => [...new Set([...html.matchAll(new RegExp(`href="/${prefix}/([a-z0-9-]+)"`, "g"))].map((m) => m[1]))];
  const cs = slugs(await get("/case-studies"), "case-studies").slice(0, 3);
  const ar = slugs(await get("/articles"), "articles").slice(0, 3);
  const api = await (await fetch(BASE + "/api/analysis", { headers: ACCESS })).json().catch(() => ({}));
  return { cs, ar, an: (api.items || []).map((a) => a.slug).slice(0, 3) };
}

(async () => {
  await checkStagingSite(BASE, ACCESS);
  const d = await discover();
  console.log(`Phase ${PHASE}: ${d.cs.length} case studies, ${d.an.length} analyses, ${d.ar.length} articles discovered`);
  const pub = ["/", "/analysis", "/articles", "/case-studies", ...d.cs.map((s) => `/case-studies/${s}`), ...d.an.map((s) => `/analysis/${s}`), ...d.ar.map((s) => `/articles/${s}`)];
  const dynamic = async () => { for (const s of d.cs) await hit("buy-page", `/case-studies/${s}/buy`); await hit("sitemap", "/sitemap.xml"); await hit("robots", "/robots.txt"); await hit("api-list", "/api/analysis"); for (const s of d.an) await hit("api-viewer", `/api/analysis/${s}`); await hit("admin-login", "/admin/login"); await hit("not-found", "/no-such-page"); };
  const order = (i) => hit("order-post", "/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ slug: d.cs[0] || "x", expectedPriceBdt: 0, customerName: "Measure Test", email: "measure@example.test", bkashNumber: "01712345678", transactionNumber: `MEASURE${Date.now()}${i}` }) });

  if (PHASE === "soak") {
    const minutes = Number(opt("minutes", 30)); const mix = [...pub, "/sitemap.xml", "/api/analysis", "/admin/login"];
    for (let block = 0; block < Math.ceil(minutes / 10); block++)
      await window(`soak-${block + 1}`, async () => { for (let i = 0; i < 60; i++) { await hit("soak", mix[(block * 60 + i) % mix.length]); await sleep(10_000); } });
  } else if (PHASE === "cold") {
    await window("cold-public", async () => { for (const p of pub) await hit("cold-public", p); });
    await window("cold-dynamic", dynamic);
  } else {
    for (let r = 1; r <= ROUNDS; r++) {
      await window(`warm-public-r${r}`, async () => { for (let i = 0; i < 10; i++) for (const p of pub) await hit("public-page", p); });
      await window(`warm-concurrent-r${r}`, async () => { await Promise.all(Array.from({ length: 40 }, (_, i) => hit("public-concurrent", pub[i % pub.length]))); });
      await window(`warm-dynamic-r${r}`, async () => { for (let i = 0; i < 5; i++) await dynamic(); });
      // Wrong expected price -> each POST runs the rate limit and validation, then 409/429; nothing is written but counters.
      await window(`warm-orders-r${r}`, async () => { for (let i = 0; i < 8; i++) await order(i); });
    }
  }

  const by = {};
  for (const x of results) (by[x.label] ||= []).push(x);
  const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0; };
  const summary = Object.entries(by).map(([label, xs]) => ({ label, n: xs.length, statuses: Object.entries(xs.reduce((m, x) => ((m[x.status] = (m[x.status] || 0) + 1), m), {})).map(([k, v]) => `${k}:${v}`).join(" "), err1102: xs.filter((x) => x.is1102).length, netErrors: xs.filter((x) => x.err).length, wallP50: pct(xs.map((x) => x.ms), 50), wallP95: pct(xs.map((x) => x.ms), 95), kbAvg: Math.round(xs.reduce((s, x) => s + x.bytes, 0) / xs.length / 1024) }));
  console.table(summary);

  let analytics = null;
  if (process.env.CLOUDFLARE_ANALYTICS_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    await sleep(120_000); // analytics ingestion delay
    analytics = [];
    const query = "query($a:String!,$s:String!,$t:Time!,$u:Time!){viewer{accounts(filter:{accountTag:$a}){workersInvocationsAdaptive(limit:20,filter:{scriptName:$s,datetime_geq:$t,datetime_leq:$u}){sum{requests errors subrequests}quantiles{cpuTimeP50 cpuTimeP90 cpuTimeP99 cpuTimeP999}dimensions{status}}}}}";
    for (const w of windows) {
      const res = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_ANALYTICS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables: { a: process.env.CLOUDFLARE_ACCOUNT_ID, s: "mktbd-staging", t: w.start, u: w.end } }) });
      const j = await res.json().catch(() => ({}));
      if (j.errors) console.log(`   analytics query error in ${w.label}`);
      for (const r of j?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [])
        analytics.push({ window: w.label, status: r.dimensions?.status, requests: r.sum?.requests, errors: r.sum?.errors, cpuP50ms: r.quantiles?.cpuTimeP50 / 1000, cpuP99ms: r.quantiles?.cpuTimeP99 / 1000, cpuP999ms: r.quantiles?.cpuTimeP999 / 1000 });
    }
    console.table(analytics);
  } else console.log("   (no analytics credentials: Cloudflare CPU metrics not collected)");

  const out = { phase: PHASE, requests: results.length, err1102: results.filter((r) => r.is1102).length, netErrors: results.filter((r) => r.err).length, statuses: Object.fromEntries(summary.map((s) => [s.label, s.statuses])), summary, windows, analytics };
  console.log(`\n${out.requests} requests; error-1102 pages: ${out.err1102}; network errors: ${out.netErrors}`);
  if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));
})().catch((e) => { console.error(`measure failed (${e.name})`); process.exit(2); });
