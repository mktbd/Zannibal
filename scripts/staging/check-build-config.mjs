// Built Worker configuration check (Stage 05E-B2B). Run after `npm run build:vinext`.
//
// Usage: node scripts/staging/check-build-config.mjs --target staging|production|placeholder
//   placeholder: scripts/staging/placeholder (run from the repository root after its build). It must
//   be the mktbd-staging Worker with no bindings and no exports at all.
// Reads .cloudflare/output/v0/workers/default/worker.config.json and fails unless it matches the
// target exactly: Worker name, workers.dev exposure, SITE_ENV, the bKash recipient binding, the CPU
// cap, strict public fetch, and only binding types that carry no extra Cloudflare charge (static
// assets, plain text, secrets, version metadata). A KV/R2/D1/Durable Object/Images/Queue/AI binding
// appearing in the build fails it, so no paid service is added without a deliberate change here.
// Prints field names and outcomes only (never secret values; secrets are not in this file anyway).
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const target = args[args.indexOf("--target") + 1];
if (!["staging", "production", "placeholder"].includes(target)) { console.error("usage: check-build-config.mjs --target staging|production|placeholder"); process.exit(2); }

const root = target === "placeholder" ? "scripts/staging/placeholder/" : "";
let c;
try { c = JSON.parse(readFileSync(`${root}.cloudflare/output/v0/workers/default/worker.config.json`, "utf8")); }
catch { console.error("check-build-config: worker.config.json not found (run the build first)"); process.exit(2); }

if (target === "placeholder") {
  const bad = [];
  if (c.name !== "mktbd-staging") bad.push("name is mktbd-staging");
  if (c.workersDev !== true || c.previewUrls !== false) bad.push("workers.dev only, no preview URLs");
  if (c.routes || c.route || c.domains) bad.push("no routes or custom domains");
  if (!Number.isFinite(c.limits?.cpuMs)) bad.push("CPU cap set");
  if (Object.keys(c.env || {}).length || Object.keys(c.exports || {}).length) bad.push("no bindings and no exports");
  if (bad.length) { for (const b of bad) console.error(`FAIL  ${b}`); process.exit(1); }
  console.log("Built placeholder Worker config OK (mktbd-staging, no bindings).");
  process.exit(0);
}

const production = target === "production";
const problems = [];
const expect = (name, ok) => { if (!ok) problems.push(name); };
const env = c.env || {};

expect(`name is ${production ? "mktbd" : "mktbd-staging"}`, c.name === (production ? "mktbd" : "mktbd-staging"));
expect(`workersDev is ${!production}`, c.workersDev === !production);
expect("previewUrls is false", c.previewUrls === false);
expect("no routes or custom domains in config", !c.routes && !c.route && !c.domains);
expect("CPU cap limits.cpuMs is set and <= 5000", Number.isFinite(c.limits?.cpuMs) && c.limits.cpuMs > 0 && c.limits.cpuMs <= 5000);
// LOCAL_TEST=1 (local workerd against a Supabase stack on 127.0.0.1) drops global_fetch_strictly_public; CI never sets it.
const localTest = process.env.LOCAL_TEST === "1";
expect(
  localTest ? "nodejs_compat (LOCAL_TEST build)" : "nodejs_compat and global_fetch_strictly_public",
  ["nodejs_compat", ...(localTest ? [] : ["global_fetch_strictly_public"])].every((f) => (c.compatibilityFlags || []).includes(f)),
);
expect(`SITE_ENV = ${production ? "production" : "preview"}`, env.SITE_ENV?.type === "text" && env.SITE_ENV.value === (production ? "production" : "preview"));
expect("DEPLOY_PLATFORM = cloudflare", env.DEPLOY_PLATFORM?.type === "text" && env.DEPLOY_PLATFORM.value === "cloudflare");
expect(
  production ? "BKASH_PAYMENT_NUMBER is a dashboard secret (never in the build)" : "BKASH_PAYMENT_NUMBER is the STAGING-NOT-PAYABLE placeholder",
  production ? env.BKASH_PAYMENT_NUMBER?.type === "secret" : env.BKASH_PAYMENT_NUMBER?.type === "text" && env.BKASH_PAYMENT_NUMBER.value === "STAGING-NOT-PAYABLE",
);
expect("SUPABASE_SERVICE_ROLE_KEY is a dashboard secret", env.SUPABASE_SERVICE_ROLE_KEY?.type === "secret");
const allowed = new Set(["assets", "text", "secret", "version-metadata"]);
const extra = Object.entries(env).filter(([, v]) => !allowed.has(v?.type)).map(([k, v]) => `${k}:${v?.type}`);
expect(`only free binding types (found: ${extra.join(", ") || "none"})`, extra.length === 0);
const exportsBad = Object.entries(c.exports || {}).filter(([, v]) => v?.type !== "worker").map(([k, v]) => `${k}:${v?.type}`);
expect(`exports are Worker entrypoints only (found: ${exportsBad.join(", ") || "none"})`, exportsBad.length === 0);

if (problems.length) { for (const p of problems) console.error(`FAIL  ${p}`); process.exit(1); }
console.log(`Built ${target} Worker config OK (${Object.keys(env).length} bindings, CPU cap ${c.limits.cpuMs} ms).`);
