import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Stages 05E-B2B/B2C: the Cloudflare staging workflow must never reach production credentials -- not
// by reference, not through inherited, dynamic or bulk secret contexts -- each job may only use the
// secrets of its own GitHub environment, and only in the steps that need them; it runs only the
// approved cloudflare-staging revision, dispatched from main; and the application is only ever
// uploaded behind Cloudflare Access.
const workflow = readFileSync(new URL("../../.github/workflows/cloudflare-staging.yml", import.meta.url), "utf8");
const lines = workflow.split("\n");

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
const PRODUCTION_NAMES = ["SUPABASE_PROJECT_ID", "SUPABASE_DB_PASSWORD", "SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "VERCEL_TOKEN"];

test("staging workflow: manual dispatch only, read-only token", () => {
  assert.match(head, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.doesNotMatch(head, /^\s+(push|pull_request|pull_request_target|schedule|workflow_run|repository_dispatch|workflow_call):/m);
  assert.match(head, /permissions:\s*\n\s+contents: read\s*\n/);
  assert.doesNotMatch(workflow, /write-all|id-token:\s*write|contents:\s*write|actions:\s*write|permissions:\s*\n\s+[a-z-]+:\s*write/);
});

test("staging workflow: nothing secret at workflow level", () => {
  assert.deepEqual(secretsIn(head), []);
  const env = head.match(/^env:\s*\n((?: {2}.*\n)+)/m)?.[1] ?? "";
  assert.deepEqual([...env.matchAll(/^ {2}([A-Z_]+):/gm)].map((m) => m[1]), ["WORKER_BUDGET_KIB"]);
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
    authorize: { environment: null, secrets: [] },
    database: { environment: "staging-db", secrets: ["PRODUCTION_SUPABASE_REF", "STAGING_ADMIN_PASSWORD", "STAGING_DB_URL", "STAGING_SUPABASE_SERVICE_ROLE_KEY"] },
    placeholder: { environment: "staging-deploy", secrets: ["CLOUDFLARE_DEPLOY_TOKEN"] },
    deploy: { environment: "staging-deploy", secrets: ["CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET", "CLOUDFLARE_DEPLOY_TOKEN", "PRODUCTION_SUPABASE_REF"] },
    test: { environment: "staging-test", secrets: ["CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET", "CLOUDFLARE_ANALYTICS_TOKEN", "PRODUCTION_SUPABASE_REF", "STAGING_ADMIN_PASSWORD"] },
    "production-build-check": { environment: null, secrets: [] },
    "db-diagnose": { environment: "staging-db", secrets: ["PRODUCTION_SUPABASE_REF", "STAGING_DB_URL"] },
  };
  assert.deepEqual(Object.keys(jobs).sort(), Object.keys(expected).sort());
  for (const [id, want] of Object.entries(expected)) {
    const env = jobs[id].match(/^ {4}environment:\s*(\S+)\s*$/m)?.[1] ?? null;
    assert.equal(env, want.environment, `${id} environment`);
    assert.deepEqual(secretsIn(jobs[id]), want.secrets, `${id} secrets`);
  }
  assert.doesNotMatch(workflow, /environment:\s*(supabase-)?production\b/i, "never binds a production environment");
});

test("staging workflow: secrets only at step level, never in install, checkout, setup or artifact steps", () => {
  lines.forEach((line, i) => {
    if (!/secrets\./.test(line)) return;
    assert.match(line, /^ {10}[A-Z][A-Z0-9_]*: \$\{\{ secrets\.[A-Z0-9_]+ \}\}\s*$/, `line ${i + 1}: secret must be a step-level env entry`);
    let j = i;
    while (j >= 0 && !/^ {6}- /.test(lines[j])) j--;
    let k = i + 1;
    while (k < lines.length && !/^ {6}- |^ {2}[a-z]/.test(lines[k])) k++;
    const step = lines.slice(j, k).join("\n");
    assert.doesNotMatch(step, /uses:\s*actions\/(checkout|setup-node|upload-artifact)|supabase\/setup-cli|npm ci|npm install|playwright install/, `line ${i + 1}: secret in a setup/install step`);
  });
});

test("staging workflow: authorize gates every run on main + the approved cloudflare-staging revision", () => {
  const a = jobs.authorize;
  assert.match(a, /\[ "\$EVENT" = workflow_dispatch \]/);
  assert.match(a, /\[ "\$REF" = refs\/heads\/main \]/);
  assert.match(a, /WORKFLOW_REF" = "\$REPO\/\.github\/workflows\/cloudflare-staging\.yml@refs\/heads\/main"/);
  assert.match(a, /REQUESTED: \$\{\{ inputs\.staging_sha \}\}/);
  assert.match(a, /APPROVED: \$\{\{ vars\.CLOUDFLARE_STAGING_APPROVED_SHA \}\}/);
  assert.match(a, /\^\[0-9a-f\]\{40\}\$/, "full SHA only");
  assert.match(a, /\[ "\$REQUESTED" = "\$APPROVED" \]/);
  assert.match(a, /merge-base --is-ancestor "\$REQUESTED" HEAD/, "contained in cloudflare-staging");
  assert.match(a, /ref: cloudflare-staging/);
  assert.match(a, /cmp -s approved-workflow\.yml main-tree\/\.github\/workflows\/cloudflare-staging\.yml/, "same workflow file as main");
});

test("staging workflow: dispatch inputs never reach a script except as environment variables", () => {
  const allowed = [
    /^ +[A-Z][A-Z0-9_]*: \$\{\{ inputs\.[a-z_]+ \}\}\s*$/, // step/job env entry
    /^ +if: inputs\.mode == '[a-z-]+'( \|\| inputs\.mode == '[a-z-]+')?\s*$/, // job/step condition on the choice input
    /--db \$\{\{ inputs\.mode == 'migrate-staging' && 'fresh-or-marked' \|\| 'marked' \}\}/, // constant strings only
  ];
  lines.forEach((line, i) => {
    if (line.includes("inputs.") && /\$\{\{|^ +if:/.test(line)) assert.ok(allowed.some((rx) => rx.test(line)), `line ${i + 1}: inputs used outside an env entry or condition`);
  });
});

test("staging workflow: every other job needs authorize and checks out only the approved revision", () => {
  for (const [id, text] of Object.entries(jobs)) {
    if (id === "authorize") continue;
    assert.match(text, /^ {4}needs: authorize\s*$/m, `${id} needs authorize`);
    const checkouts = [...text.matchAll(/uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n((?: {8}.*\n)*)/g)];
    assert.ok(checkouts.length >= 1, `${id} checks out`);
    for (const c of checkouts) assert.match(c[1], /ref: \$\{\{ needs\.authorize\.outputs\.sha \}\}/, `${id}: checkout pinned to the approved revision`);
  }
});

test("staging workflow: no production credential names; every job checks settings and credentials first", () => {
  for (const name of PRODUCTION_NAMES) assert.doesNotMatch(workflow, new RegExp(`(secrets|vars)\\.${name}\\b`), name);
  for (const [id, text] of Object.entries(jobs)) {
    if (id === "authorize") continue;
    assert.match(text, /node (scripts\/staging\/|\.\.\/)check\.mjs/, `${id} has an isolation gate`);
  }
  // The first gate of each job that uses staging settings fails on any missing one.
  for (const id of ["database", "placeholder", "deploy", "test", "db-diagnose"]) {
    const first = jobs[id].split("\n").find((l) => /check\.mjs/.test(l)) ?? "";
    assert.match(first, /--require [A-Z_,]+/, `${id}: first gate checks required settings`);
  }
  assert.match(jobs.database, /check\.mjs --db [^\n]*--require [A-Z_,]*STAGING_DB_URL/, "database gate requires the staging DB URL");
  // Gates run before the work they protect.
  const before = (id, gate, work) => assert.ok(jobs[id].indexOf(gate) >= 0 && jobs[id].indexOf(gate) < jobs[id].indexOf(work), `${id}: ${gate} before ${work}`);
  before("database", "check.mjs --db", "supabase db push");
  before("db-diagnose", "check.mjs --env --require", "db-diagnose.mjs");
  before("database", "check.mjs --db", "node scripts/staging/seed.mjs");
  before("placeholder", "check.mjs --env --require CLOUDFLARE_API_TOKEN", "npx cf deploy");
  before("deploy", "check.mjs --anon", "npm run build:vinext");
  before("test", "checkRefs(process.env)", "measure.mjs");
});

test("staging workflow: the application is uploaded only behind verified Cloudflare Access", () => {
  const d = jobs.deploy;
  const access = d.indexOf('check.mjs --access "$BASE"');
  assert.ok(access > 0, "deploy-staging checks Access");
  assert.ok(access < d.indexOf("npm run build:vinext") && access < d.indexOf("vinext-cloudflare deploy"), "Access gate runs before build and upload");
  assert.match(d, /DEPLOY_TARGET: staging/);
  assert.match(d, /deploy --skip-build/, "deploys only the checked build");
  assert.ok(d.indexOf('check.mjs --site "$BASE"') > d.indexOf("vinext-cloudflare deploy"), "verified after upload");
  assert.match(jobs.placeholder, /working-directory: scripts\/staging\/placeholder/);
  assert.match(jobs.placeholder, /npx cf deploy --prebuilt/);
  assert.doesNotMatch(jobs.placeholder, /build:vinext|vinext-cloudflare|NEXT_PUBLIC_|SUPABASE/);
});

test("staging workflow: no production deployment, and the production build check uses no production value", () => {
  const p = jobs["production-build-check"];
  assert.doesNotMatch(p, /cf deploy|vinext-cloudflare deploy|CLOUDFLARE_API_TOKEN|secrets\./);
  assert.match(p, /dummy=buildcheck0000000000/);
  assert.doesNotMatch(workflow, /DEPLOY_TARGET:\s*production/);
});

test("staging workflow: the temporary database diagnostic is read-only, TLS-only and runs no third-party code", () => {
  const d = jobs["db-diagnose"];
  assert.match(d, /^ {4}if: inputs\.mode == 'diagnose-staging-db'\s*$/m);
  const code = d.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  assert.doesNotMatch(code, /setup-node|npm ci|npm install|upload-artifact|supabase db|mark-staging|seed\.mjs|psql/, "only the two built-in-only scripts run");
  const script = readFileSync(new URL("../../scripts/staging/db-diagnose.mjs", import.meta.url), "utf8");
  const sql = [...script.matchAll(/"-c",\s*"([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(sql, ["select 1"], "exactly one statement, select 1");
  assert.match(script, /searchParams\.set\("sslmode", "require"\)/, "sslmode=require forced in the connection URL");
  assert.match(script, /PGSSLMODE: "require"/, "and in the environment");
  assert.doesNotMatch(script, /sslmode", "(prefer|allow|disable)"|PGSSLMODE: "(prefer|allow|disable)"/, "no unencrypted fallback");
  assert.match(script, /checkRefs\(env, \{ requireDb: true \}\)/, "same isolation proof as the migrate gate");
  assert.doesNotMatch(script, /(say|console\.log|process\.stdout\.write)\([^)]*\b(raw|password|host|user|conn\.href|r\.stderr|u\.href)\b[^)]*\)/, "never prints connection details or raw errors");
});
