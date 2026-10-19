// Placeholder for the STAGING Worker name (Stage 05E-B2B). Deployed first, so the workers.dev
// hostname exists and Cloudflare Access can be enabled and verified on it before the full
// application is ever uploaded. No bindings, no secrets, no Supabase, no application code.
import { defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "mktbd-staging",
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-10-09",
    limits: { cpuMs: 50 },
    workersDev: true,
    previewUrls: false,
  }),
});
