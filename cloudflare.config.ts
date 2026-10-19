// Cloudflare Workers (Paid plan) configuration for mktbd, built with vinext.
// Stage 05E-B2B. Two targets, chosen by DEPLOY_TARGET (default "staging"):
//
//   staging     Worker "mktbd-staging" on workers.dev only (behind Cloudflare
//               Access), SITE_ENV=preview (noindex, staging banner), the staging
//               Supabase project, and the non-payable bKash placeholder.
//   production  Worker "mktbd", SITE_ENV=production, the production Supabase
//               project, served on the custom domains mktbd.co and www.mktbd.co
//               only (no workers.dev URL, no route). Deployed by
//               .github/workflows/cloudflare-production.yml.
//
// Build-time guard: the build throws unless SITE_ENV matches the target and the
// Supabase URL is a hosted *.supabase.co project whose ref differs from
// PRODUCTION_REF (staging) or equals it (production). PRODUCTION_REF is required
// for hosted builds, so the comparison can never be skipped. LOCAL_TEST=1 allows
// a local Supabase stack on 127.0.0.1 instead (local workerd testing only).
import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersCacheConfig } from "@vinext/cloudflare/cache/config";

const target = process.env.DEPLOY_TARGET ?? "staging";
if (target !== "staging" && target !== "production") throw new Error("DEPLOY_TARGET must be 'staging' or 'production'.");
const production = target === "production";

const localTest = process.env.LOCAL_TEST === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const hosted = supabaseUrl.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/);
const local = /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(supabaseUrl);
const productionRef = process.env.PRODUCTION_REF ?? "";

const expectedSiteEnv = production ? "production" : "preview";
if (process.env.SITE_ENV !== expectedSiteEnv) throw new Error(`${target} build: SITE_ENV must be '${expectedSiteEnv}'.`);
if (hosted) {
  if (!/^[a-z0-9]{20}$/.test(productionRef)) throw new Error(`${target} build: PRODUCTION_REF is required to prove the Supabase target.`);
  if (production && hosted[1] !== productionRef) throw new Error("production build: NEXT_PUBLIC_SUPABASE_URL is not the production project.");
  if (!production && hosted[1] === productionRef) throw new Error("staging build: NEXT_PUBLIC_SUPABASE_URL is the PRODUCTION project. Refusing.");
} else if (!(localTest && local)) {
  throw new Error(`${target} build: NEXT_PUBLIC_SUPABASE_URL must be a hosted *.supabase.co project.`);
}

const PRODUCTION_DOMAINS = ["mktbd.co", "www.mktbd.co"];

const cache = await createWorkersCacheConfig();

export default defineConfig({
  worker: defineWorker({
    ...cache,
    name: production ? "mktbd" : "mktbd-staging",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-09",
    // global_fetch_strictly_public: the Worker may only fetch public internet hosts (Supabase).
    // LOCAL_TEST=1 (local workerd against a Supabase stack on 127.0.0.1) drops it.
    compatibilityFlags: localTest ? ["nodejs_compat"] : ["nodejs_compat", "global_fetch_strictly_public"],
    // Paid plan: the default CPU limit is 30 s per request. Cap it at 1 s so a runaway render
    // fails fast (error 1102) instead of billing CPU time; measured page renders are well below.
    limits: { cpuMs: 1000 },
    workersDev: !production,
    previewUrls: false,
    // Production custom domains, declared here so every deploy re-asserts exactly this set: with a list
    // configured, cf deploy replaces the Worker's custom domains with it (a domain added only in the
    // dashboard would be removed, so add it here instead). Staging has none (workers.dev behind Access).
    domains: production ? PRODUCTION_DOMAINS : undefined,
    // Workers Logs: per-invocation CPU time, outcome and errors (included in Paid up to the monthly quota).
    // Spelled out to match the dashboard's settings exactly, so cf deploy's strict drift check sees no
    // change: top-level `enabled` stays false (the dashboard has no switch for it); logs are on via
    // logs.enabled; traces and issue detection are off.
    observability: {
      enabled: false,
      logs: { enabled: true, headSamplingRate: 1, invocationLogs: true, persist: true },
      traces: { enabled: false },
      issues: { enabled: false },
    },
    assets: { notFoundHandling: "none" },
    env: {
      ...cache.env,
      ASSETS: bindings.assets(),
      SITE_ENV: bindings.text(expectedSiteEnv),
      DEPLOY_PLATFORM: bindings.text("cloudflare"),
      // Staging: the non-payable placeholder (lib/payment-recipient.ts), shown with a "do not send
      // money" warning; a real number there pauses purchasing. Production: the real receiving number,
      // set in the Cloudflare dashboard by the owner (never committed); the placeholder there pauses
      // purchasing.
      BKASH_PAYMENT_NUMBER: production ? bindings.secret() : bindings.text("STAGING-NOT-PAYABLE"),
      // Service-role key of the target's own Supabase project: a Worker secret set in the Cloudflare
      // dashboard by the owner. CI never handles it.
      SUPABASE_SERVICE_ROLE_KEY: bindings.secret(),
    },
  }),
});
