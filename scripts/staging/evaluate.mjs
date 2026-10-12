// Go/no-go evaluation for the STAGING test on Cloudflare Workers Paid (Stage 05E-B2B).
//
// Usage: node scripts/staging/evaluate.mjs --measure cold.json warm1.json warm2.json soak.json
//          --browser browser.json [--daily-views <expected>]
// PASS only if every criterion passes. Missing evidence is a FAIL, never a pass.
// The Worker size budget is enforced earlier, in the deploy job (scripts/staging/bundle-size.mjs).
// CPU time and request volume are reported for cost planning only; they are not pass/fail gates
// on the Paid plan (the Worker's own CPU cap, limits.cpuMs in cloudflare.config.ts, surfaces as
// error 1102, which criterion 1 counts).
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const list = (flag) => { const i = args.indexOf(flag); if (i < 0) return []; const out = []; for (let j = i + 1; j < args.length && !args[j].startsWith("--"); j++) out.push(args[j]); return out; };
const one = (flag) => list(flag)[0];
const read = (f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } };
const measures = list("--measure").map(read);
const browser = read(one("--browser") || "");
const dailyViews = Number(one("--daily-views"));
const FAILURE_OUTCOMES = /exceeded|exception|internalError|scriptThrew/i;

const criteria = [];
const add = (name, ok, detail) => criteria.push({ name, ok: !!ok, detail });

// 1. Runtime stability and error monitoring: no error-1102 pages, no network errors, and no failed
//    invocation outcomes recorded by Cloudflare, across cold, two warm runs and the soak.
const phases = measures.filter(Boolean).map((m) => m.phase);
const needPhases = ["cold", "warm", "soak"].every((p) => phases.includes(p)) && phases.filter((p) => p === "warm").length >= 2;
const err1102 = measures.reduce((s, m) => s + (m?.err1102 || 0), 0);
const netErrors = measures.reduce((s, m) => s + (m?.netErrors || 0), 0);
const analyticsRows = measures.flatMap((m) => m?.analytics || []);
const badOutcomes = analyticsRows.filter((r) => r.status && FAILURE_OUTCOMES.test(r.status)).reduce((s, r) => s + (r.requests || 0), 0);
add(
  "1. runtime stability: zero 1102 / failed outcomes / network errors (cold, 2x warm, soak)",
  needPhases && measures.every((m) => m && m.analytics) && analyticsRows.length > 0 && err1102 === 0 && netErrors === 0 && badOutcomes === 0,
  `phases=${phases.join(",") || "none"}; 1102 pages=${err1102}; network errors=${netErrors}; failed outcomes=${badOutcomes}; analytics rows=${analyticsRows.length}`,
);

// 2. Functionality: every browser check passes (security headers, robots/sitemap, staging identity,
//    orders incl. duplicate Transaction ID and rate limit, admin/CMS, freshness, uploads), and every
//    measured route answers only its expected statuses (no 5xx anywhere).
const okStatus = { "public-page": /^(200:\d+\s?)+$/, "public-concurrent": /^(200:\d+\s?)+$/, "cold-public": /^(200:\d+\s?)+$/, "buy-page": /^(200:\d+\s?)+$/, sitemap: /^(200:\d+\s?)+$/, robots: /^(200:\d+\s?)+$/, "api-list": /^(200:\d+\s?)+$/, "api-viewer": /^(200:\d+\s?)+$/, "admin-login": /^(200:\d+\s?)+$/, "not-found": /^(404:\d+\s?)+$/, "order-post": /^((409|429):\d+\s?)+$/, soak: /^(200:\d+\s?)+$/ };
const statusProblems = measures.flatMap((m) => (m?.summary || []).filter((s) => !okStatus[s.label] || !okStatus[s.label].test(s.statuses)).map((s) => `${m.phase}/${s.label}=${s.statuses}`));
add(
  "2. functionality, security headers, orders, admin/CMS, freshness; expected statuses only",
  browser && browser.failed?.length === 0 && browser.checks?.length > 0 && statusProblems.length === 0,
  browser ? `browser failed: ${browser.failed?.join("; ") || "none"}; status problems: ${statusProblems.join("; ") || "none"}` : "no browser results",
);

for (const c of criteria) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}  — ${c.detail}`);

// Report only (Paid plan cost planning): CPU percentiles and projected monthly usage.
const pct = (key) => analyticsRows.reduce((m, r) => Math.max(m, r[key] || 0), 0);
console.log(`\nCPU (worst window): p50 ${pct("cpuP50ms").toFixed(1)} ms, p99 ${pct("cpuP99ms").toFixed(1)} ms, p99.9 ${pct("cpuP999ms").toFixed(1)} ms (cap 1000 ms)`);
const perView = browser?.requestsPerView;
if (Number.isFinite(perView) && dailyViews > 0) {
  const monthlyRequests = perView * dailyViews * 30;
  const monthlyCpuMs = monthlyRequests * pct("cpuP50ms");
  console.log(`Projection: ${perView.toFixed(1)} Worker requests/view x ${dailyViews} views/day ≈ ${Math.round(monthlyRequests).toLocaleString("en")} requests/month (10M included); ≈ ${Math.round(monthlyCpuMs).toLocaleString("en")} CPU-ms/month at p50 (30M included)`);
} else console.log("Projection: not computed (requests per view or expected daily views missing)");

const pass = criteria.every((c) => c.ok);
console.log(`\nStaging decision: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
