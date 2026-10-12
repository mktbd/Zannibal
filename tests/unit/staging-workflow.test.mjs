import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Stage 05E-B2B: the Cloudflare staging workflow must never reach production credentials -- not by
// reference, not through inherited or dynamic secret contexts -- each job may only use the secrets of
// its own GitHub environment, and the application is only ever uploaded behind Cloudflare Access.
const workflow = readFileSync(new URL("../../.github/workflows/cloudflare-staging.yml", import.meta.url), "utf8");

/** Top-level section text, and each job's text keyed by job id (two-space indented keys under jobs:). */
function sections(text) {
  const [head, jobsText = ""] = text.split(/^jobs:\s*$/m);
  const jobs = {};
  let current = null;
  for (const line of jobsText.split("\n")) {
    const m = line.match(/^ {2}([a-z][a-z0-9-]*):\s*$/);
    if (m) jobs[(current = m[1])] = "";
    else if (current) jobs[current] += `${line}\n`;
  }
  return { head, jobs };
}
const secretsIn = (text) => [...new Set([...text.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort();
const { head, jobs } = sections(workflow);

test("staging workflow: manual dispatch only, read-only token", () => {
  assert.match(head, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(head, /^\s+(push|pull_request|pull_request_target|schedule|workflow_run|repository_dispatch|workflow_call):/m);
  assert.match(head, /permissions:\s*\n\s+contents: read\s*\n/);
  assert.doesNotMatch(workflow, /write-all|id-token:\s*write|contents:\s*write|permissions:\s*\n\s+[a-z-]+:\s*write/);
});

test("staging workflow: only the ref-only production identifier is read at top level", () => {
  assert.deepEqual(secretsIn(head), ["PRODUCTION_SUPABASE_REF"]);
});

test("staging workflow: no inherited, dynamic or bulk secret access", () => {
  assert.doesNotMatch(workflow, /secrets:\s*inherit/, "no secrets: inherit");
  assert.doesNotMatch(workflow, /toJSON\(\s*secrets\s*\)/i, "no toJSON(secrets)");
  assert.doesNotMatch(workflow, /secrets\s*\[/, "no secrets[...] dynamic lookup");
  assert.doesNotMatch(workflow, /^\s{4}uses:/m, "no reusable-workflow jobs (they could receive secrets)");
  for (const id of Object.keys(jobs)) assert.doesNotMatch(jobs[id], /^\s{4}container:|^\s{4}services:/m, `${id}: no containers or services`);
});

test("staging workflow: each job uses only its own environment's secrets", () => {
  const expected = {
    database: { environment: "staging-db", secrets: ["STAGING_ADMIN_PASSWORD", "STAGING_DB_URL", "STAGING_SUPABASE_SERVICE_ROLE_KEY"] },
    placeholder: { environment: "staging-deploy", secrets: ["CLOUDFLARE_DEPLOY_TOKEN"] },
    deploy: { environment: "staging-deploy", secrets: ["CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET", "CLOUDFLARE_DEPLOY_TOKEN"] },
    test: { environment: "staging-test", secrets: ["CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET", "CLOUDFLARE_ANALYTICS_TOKEN", "STAGING_ADMIN_PASSWORD"] },
    "production-build-check": { environment: null, secrets: [] },
  };
  assert.deepEqual(Object.keys(jobs).sort(), Object.keys(expected).sort());
  for (const [id, want] of Object.entries(expected)) {
    const env = jobs[id].match(/^ {4}environment:\s*(\S+)\s*$/m)?.[1] ?? null;
    assert.equal(env, want.environment, `${id} environment`);
    assert.deepEqual(secretsIn(jobs[id]), want.secrets, `${id} secrets`);
  }
});

test("staging workflow: no production credential names anywhere; every job runs an isolation gate", () => {
  for (const name of ["SUPABASE_PROJECT_ID", "SUPABASE_DB_PASSWORD", "SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN"])
    assert.doesNotMatch(workflow, new RegExp(`(secrets|vars)\\.${name}\\b`), name);
  for (const [id, text] of Object.entries(jobs)) assert.match(text, /node scripts\/staging\/check\.mjs|checkRefs\(process\.env\)/, `${id} has an isolation gate`);
});

test("staging workflow: the application is uploaded only behind verified Cloudflare Access", () => {
  const d = jobs.deploy;
  const access = d.indexOf('check.mjs --access "$BASE"');
  assert.ok(access > 0, "deploy-staging checks Access");
  assert.ok(access < d.indexOf("npm run build:vinext") && access < d.indexOf("vinext-cloudflare deploy"), "Access gate runs before build and upload");
  assert.match(d, /DEPLOY_TARGET: staging/);
  assert.match(d, /deploy --skip-build/, "deploys only the checked build");
  assert.ok(d.indexOf('check.mjs --site "$BASE"') > d.indexOf("vinext-cloudflare deploy"), "verified after upload");
  // The placeholder job deploys only the static placeholder project, never the application.
  assert.match(jobs.placeholder, /working-directory: scripts\/staging\/placeholder\s*\n\s+run: npx cf deploy --prebuilt/);
  assert.doesNotMatch(jobs.placeholder, /build:vinext|vinext-cloudflare|NEXT_PUBLIC_|SUPABASE/);
});

test("staging workflow: no production deployment", () => {
  assert.doesNotMatch(jobs["production-build-check"], /cf deploy|vinext-cloudflare deploy|CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(workflow, /DEPLOY_TARGET:\s*production/);
});
