# Cloudflare Workers (Paid) — hosting, staging and deployment (Stage 05E-B2B)

Status: **prepared, not run.** Nothing has been pushed, deployed or
migrated, no DNS has changed and no production secret has been
configured.

Production still runs on Vercel with the production Supabase project, and
production purchasing settings are unchanged.

Decision: mktbd will be hosted on **Cloudflare Workers Paid** ($5/month),
built with **vinext 1.1.0**. Workers Free is no longer the target, so its
10 ms CPU and 100,000 requests/day gates have been removed.

Related: `docs/IMAGE_OPTIMIZATION.md` (upload-time image variants, design),
`docs/SUPABASE_SETUP.md` (migrations and the production workflow).

---

## 1. Architecture

```
                        GitHub Actions — .github/workflows/cloudflare-staging.yml
                        (manual dispatch from main, approved cloudflare-staging SHA, reviewer per job)
  ┌──────────────────────┬───────────────────────┬──────────────────────┬──────────────────────┐
  │ database             │ deploy                │ test                 │ production-build-    │
  │ env staging-db       │ env staging-deploy    │ env staging-test     │ check (no env, no    │
  │ migrate / seed       │ build → config check  │ cold, browser, warm, │ credentials, no      │
  │ staging DB only      │ → size → deploy       │ soak, evaluate       │ upload)              │
  └─────────┬────────────┴──────────┬────────────┴──────────┬───────────┴──────────────────────┘
            ▼                       ▼                       ▼
  Supabase "mktbd-staging"   Worker "mktbd-staging"  ◀── Cloudflare Access (owner + CI token)
  separate org, synthetic    https://mktbd-staging.<sub>.workers.dev
  data, staging marker       noindex, red banner, bKash placeholder, CPU cap 1 s

  Later, separate approvals:  Worker "mktbd" (SITE_ENV=production, no workers.dev, no route yet)
                              ── custom domain mktbd.co (DNS move) ── production Supabase
```

**One codebase, two Worker targets** (`cloudflare.config.ts`, chosen by
`DEPLOY_TARGET`):

| | staging | production |
|---|---|---|
| Worker | `mktbd-staging` | `mktbd` |
| Reachable at | workers.dev only, behind Cloudflare Access | nothing yet (no workers.dev, no route); custom domain later |
| `SITE_ENV` | `preview`: noindex everywhere, red staging banner | `production`: indexable, HSTS |
| Supabase | staging project (ref must differ from `PRODUCTION_REF`) | production project (ref must equal `PRODUCTION_REF`) |
| bKash recipient | `STAGING-NOT-PAYABLE` in the build; a real number pauses purchasing | dashboard secret, real number; the placeholder pauses purchasing |
| Service-role key | Worker secret (staging value), set in the dashboard | Worker secret (production value), set in the dashboard later |
| CPU cap | `limits.cpuMs = 1000` | `limits.cpuMs = 1000` |
| Deployed by CI | yes, `deploy-staging` (manual + reviewer) | **no**, `production-build-check` only builds |

**Runtime** (the same for both targets):
- **Requests:** vinext's fetch handler on Workers, `nodejs_compat` and
  `global_fetch_strictly_public` (the Worker can only fetch public hosts).
  Static assets come from Workers Static Assets, which are free and not
  billed as Worker requests.
- **Caching:** ISR pages (5 minutes) are cached through vinext's Workers
  Cache adapter, and CMS saves invalidate it by tag.
- **Images:** `next/image` serves Storage originals as-is until
  upload-time variants land (`docs/IMAGE_OPTIMIZATION.md`); images never
  pass through the Worker.
- **Bindings:** only static assets, version metadata, plain-text values and
  two secrets. No KV, R2, D1, Durable Objects, Queues, Images or AI;
  `scripts/staging/check-build-config.mjs` fails the build if any appears.
- **Auth:** admin authentication and authorization are unchanged. The
  `proxy.ts` redirect, `requireAdmin()` on every admin page and Server
  Action, and RLS on every table and the Storage bucket all apply as before.
- **Order rate limit:** keyed on `CF-Connecting-IP`, which Cloudflare's
  edge sets (`DEPLOY_PLATFORM=cloudflare`). `X-Forwarded-For`/`X-Real-IP`
  are ignored. The limit is 5 per IP and 100 globally per hour, enforced in
  the database and failing closed (503).
- **Monitoring:** Workers Logs record each invocation's CPU time, outcome
  and exceptions. Cloudflare's GraphQL Analytics API supplies per-window
  CPU percentiles and outcomes to the test job.

**Paid-plan figures used here:**
- 10M requests and 30M CPU-ms per month included;
- 10 MiB gzip Worker limit, against a 5 MiB budget enforced by CI;
- the default CPU limit is 30 s; capped to 1 s here so a runaway render
  fails fast with error 1102 instead of billing CPU time.

The test reports the CPU percentiles and a monthly projection for cost
planning. They are not pass/fail gates.

## 2. What changed from 05E-B2A (Free → Paid)

- **Removed Free-tier gates:**
  - CPU p99 ≤ 10 ms;
  - daily Worker requests ≤ 50,000;
  - Worker ≤ 2304 KiB against the 3 MB Free limit.
- **Kept:**
  - runtime stability (zero 1102 and failed outcomes);
  - functionality and security checks;
  - freshness;
  - bundle-size check, now against the 5 MiB budget;
  - error monitoring through Workers Logs and analytics;
  - client-IP handling;
  - `SITE_ENV` handling;
  - rate limiting;
  - admin checks.
- **Added:**
  - a production target with build guards;
  - the CPU cap;
  - `check-build-config.mjs` (exact config shape per target, free binding
    types only);
  - `bundle-size.mjs` (the deploy job refuses to upload an oversized
    Worker);
  - deploying the checked build only (`--skip-build`);
  - a credential-free `production-build-check` mode;
  - a unit test pinning each job's allowed secrets;
  - browser checks that anonymous `/admin` is refused and that spoofed
    client-IP headers don't reset the order limit.
- **Soak:** 30 minutes (was 60).
- **Workflow modes:** `deploy` → `deploy-staging`, `test-all` →
  `test-staging`, and the `size_kib` input is gone (size is enforced at
  deploy).

## 3. Staging isolation and safeguards

Isolation never rests on variable names alone. Every staging job proves
*from content* that it targets staging (`scripts/staging/isolation.mjs`,
`check.mjs`; refusal exits 97 before any work):

| Check | Where |
|---|---|
| The staging ref is **typed at dispatch** (20 characters). | all staging jobs |
| `PRODUCTION_REF` (from `PRODUCTION_SUPABASE_REF`, held in the staging environments, never the production workflow's `SUPABASE_PROJECT_ID`) must be present and well-formed. A wrong value still can't reach production: production has no staging marker, isn't brand new and has no `staging_identity()`, so every database and deploy gate refuses it. | database, deploy, test |
| **Approved revision only:** dispatched from `main`; `staging_sha` = `CLOUDFLARE_STAGING_APPROVED_SHA`, contained in `cloudflare-staging`, carrying a byte-identical workflow file; every job checks out exactly that SHA. | `authorize` (no secrets) |
| Every required staging setting is present (`--require`), so a missing secret or variable fails before any work. | every job |
| Ref in `STAGING_SUPABASE_URL` = typed ref ≠ production ref; ref in `STAGING_DB_URL` = typed ref. | database, deploy, test |
| None of `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` is set in the job (checked at run time; values never read). | every job |
| **Access before application:** the anonymous request is redirected to `<team>.cloudflareaccess.com` *and* the CI service token gets 200. A 404 (no Worker yet), a 200, a 403 without the login redirect, or a lookalike host all fail. | deploy-staging (before build and upload, and again after) |
| Migrate: database brand new or carrying this ref's marker. Seed: marker required. | database |
| Deploy: anon RPC `public.staging_identity()` answers `mktbd-staging:<ref>`; no DB credential in this job. | deploy |
| Build: target, `SITE_ENV` and Supabase ref all agree (`cloudflare.config.ts`); built config matches the staging shape (`check-build-config.mjs`). | deploy |
| Target is `https://mktbd-staging.<sub>.workers.dev`, refuses requests without the Access service token, accepts them with it, and shows the banner and noindex. | test (and every test script) |

Further:
- **Separate credentials:**
  - three GitHub environments, each limited to `main` (where the reviewed
    workflow file lives) and each requiring a reviewer;
  - secrets passed only to the steps that use them, never to dependency
    installation or tool setup;
  - the database job never sees Cloudflare tokens, and the deploy job
    never sees a database credential;
  - the service key and admin password reach the database job only in
    `seed-staging` mode.
- **No production credential:**
  - the workflow references no production credential;
  - `tests/unit/staging-workflow.test.mjs` fails if any job references a
    secret outside its allowed list, or if the workflow gains a trigger
    other than manual dispatch, a write permission, or a production deploy;
  - GitHub exposes only secrets a workflow references explicitly.
- **Workflow hardening:** `permissions: contents: read`, one run at a time,
  third-party actions pinned by commit SHA, `persist-credentials: false`,
  and free-text inputs passed only through environment variables.
- **Synthetic data only:** fixed `5ea00000-` IDs, generated images,
  `@example.test` addresses. No production data is copied.
- **No real payments:** the staging recipient is the placeholder, and
  measurement POSTs stop at 409/429.
- **Logs:** counts, statuses and check names only. psql errors are
  swallowed. The admin password is typed by Playwright and never printed.

## 4. Cloudflare configuration

**Account, done once by the owner:**
1. On the Workers Paid account, note the Account ID →
   `CLOUDFLARE_ACCOUNT_ID`.
2. Set a billing notification: *Billing → Billable usage → Notifications*,
   e.g. an alert at $10 so overage is noticed.
3. Choose the workers.dev subdomain → `CLOUDFLARE_WORKERS_SUBDOMAIN`.

**Staging (Access first: the application never runs on an unprotected origin):**
1. **Deploy token** (*My Profile → API Tokens → Custom*):
   - *Account → Workers Scripts → Edit* and *Account → Account Settings →
     Read*;
   - this account only, 30-day TTL, nothing at zone level;
   - → `CLOUDFLARE_DEPLOY_TOKEN` (`staging-deploy`).
   - If the first deploy reports a missing permission, add only that one.
2. **Analytics token**, separate: *Account → Account Analytics → Read* →
   `CLOUDFLARE_ANALYTICS_TOKEN` (`staging-test`).
3. **`deploy-staging-placeholder`** puts a static page on the
   `mktbd-staging` name (`scripts/staging/placeholder`):
   - no bindings, no secrets, no Supabase, no application code;
   - noindex, labelled "STAGING PLACEHOLDER";
   - `robots.txt` disallows everything; non-GET requests get 405.

   The hostname now exists, so Access can be attached to it.
4. **Cloudflare Access:**
   - *mktbd-staging → Settings → Domains & Routes → workers.dev → Enable
     Cloudflare Access*;
   - in *Zero Trust → Access → Applications*, add two policies:
     - **Allow** → the owner's emails;
     - **Service Auth** → a new service token "github-staging" →
       `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` in **both**
       `staging-deploy` and `staging-test`;
   - Zero Trust Free covers up to 50 users. If it asks to upgrade, stop
     and ask.
5. **Verify by hand:** in a private browser window,
   `https://mktbd-staging.<sub>.workers.dev/` must show the Cloudflare
   Access login, not the placeholder.
6. **Worker secret:** *Workers & Pages → mktbd-staging → Settings →
   Variables and Secrets* → secret `SUPABASE_SERVICE_ROLE_KEY` = the
   **staging** service-role key. Secrets persist across deploys.
7. **`deploy-staging`** uploads the application only after
   `check.mjs --access` proves Access is enforcing. It verifies again after
   the upload (Access + banner + noindex).
8. **Check in the dashboard after the first application deploy:**
   - no add-on products were enabled;
   - **Workers Cache usage (vinext's ISR cache) shows no separate
     charge**; if it does, stop and ask;
   - Workers Logs volume is within the included quota.

**Production, not now (each item a separate approval):**
- add the `mktbd.co` zone to Cloudflare (DNS change);
- create the production Worker's secrets (`SUPABASE_SERVICE_ROLE_KEY`,
  `BKASH_PAYMENT_NUMBER`) in the dashboard;
- attach the custom domain;
- add a production deploy job: its own `production-deploy` environment,
  limited to `main`, with a required reviewer and its own deploy token;
- cut over from Vercel.

## 5. Supabase staging configuration

1. Create a **separate free organization** and project **`mktbd-staging`**
   in the same region as production.
2. *Authentication:* **disable sign-ups**; keep email confirmation on.
3. *API keys:* the URL, anon key and service-role key go into the GitHub
   variables and secrets below and the staging Worker secret. Prefer the
   legacy JWT anon / service_role keys (the format production uses); if
   only the new publishable/secret keys are offered, ask before
   substituting.
4. *Connect → Session pooler* URI → `STAGING_DB_URL`. The direct host is
   IPv6-only, and GitHub runners have no IPv6.
5. Make no manual changes. `migrate-staging` applies migrations 1–11 (the
   same files as production), the marker and the 18/18 verification;
   `seed-staging` creates the synthetic fixtures and the staging admin.

## 6. GitHub secrets and variables

The workflow is dispatched **from `main`** (section 7), so the staging
environments are restricted to `main`, not to `cloudflare-staging`.

Create under *Settings → Environments*. For each staging environment:
- **Deployment branches and tags → Selected → `main`**;
- **Required reviewers → owner** (with "Prevent self-review" off, since
  the owner is the only reviewer);
- **Allow administrators to bypass** off.

| Environment | Secrets | Variables |
|---|---|---|
| `staging-db` | `STAGING_DB_URL` (session pooler), `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_ADMIN_PASSWORD` (≥ 16 chars), `PRODUCTION_SUPABASE_REF` | `STAGING_SUPABASE_URL`, `STAGING_ADMIN_EMAIL` |
| `staging-deploy` | `CLOUDFLARE_DEPLOY_TOKEN`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `PRODUCTION_SUPABASE_REF` | `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_SUBDOMAIN` |
| `staging-test` | `CLOUDFLARE_ANALYTICS_TOKEN`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `STAGING_ADMIN_PASSWORD`, `PRODUCTION_SUPABASE_REF` | `STAGING_SUPABASE_URL`, `STAGING_ADMIN_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_SUBDOMAIN`, `EXPECTED_DAILY_PAGEVIEWS` (cost projection only) |

**`PRODUCTION_SUPABASE_REF`** is the production project ref: an
identifier, not a credential (it also appears in the public site's Supabase
URL).
- It is kept in the three staging environments rather than at repository
  level, so a workflow on any other branch can't read it.
- It is a secret so it is masked in logs.
- If it is missing, every staging job fails closed.

**Repository variable `CLOUDFLARE_STAGING_APPROVED_SHA`** is the full
commit SHA of the reviewed `cloudflare-staging` revision that may run.
Setting it is the owner's act of approval. Repository variables can only
be changed by administrators.

## 6a. Production credential isolation: migration sequence

**Today (reviewed by name only; no values read or printed):**
- `supabase-migrate.yml` on `main` reads three **repository-level**
  secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
  `SUPABASE_PROJECT_ID`.
- Its job binds no environment.
- **Exposure:** any workflow file on any branch, pushed by anyone with
  write access and dispatched there, can read these secrets. This predates
  the Cloudflare work. The Cloudflare staging workflow references none of
  them, as enforced by test.

**Target:**
- The three secrets live only in environment **`supabase-production`**:
  - deployment branch `main` only;
  - required reviewer: owner;
  - admin bypass off.
- `supabase-migrate.yml` binds `environment: supabase-production` and
  refuses any ref other than `main` as its first step. The patch is
  prepared; the regression tests pass.
- The name avoids GitHub's case-insensitive `Production`/`Preview`
  environments that the Vercel integration creates for its deployment
  records.

**Exact sequence.** Each step is a separate approval. Steps 1–6 should be
done in one sitting, and **before** the staging workflow is registered on
`main` or any staging secret is created.
1. Create environment `supabase-production`: deployment branches `main`
   only, required reviewer owner, admin bypass off. No secrets yet.
   *Effect: none on existing runs.*
2. Add `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and
   `SUPABASE_PROJECT_ID` to `supabase-production`, same names, values
   copied by the owner from Supabase. GitHub can't reveal or copy existing
   secret values.
   *Effect: none yet; the migration job doesn't bind the environment.*
3. Commit the prepared patch to `main`
   (`supabase-migrate.environment.patch`: the environment binding and the
   main-only guard), through the normal review.
   *Effect: in this job, the environment's secrets take precedence over
   repository secrets with the same names.*
4. Run `supabase-migrate` in **`preflight`** mode from `main` (read-only;
   it waits for the reviewer). This proves the job gets the environment's
   credentials.
5. **Delete the three repository-level secrets.**
6. Run `preflight` again: it still passes, so nothing depends on
   repository scope. Confirm *Settings → Secrets → Actions → Repository
   secrets* no longer lists them.

**Rollback:** remove the `environment:` line (revert the commit), or
re-create the repository secrets. Either restores today's behaviour, and
with it today's exposure.

**Exposure during the transition:**
- Steps 1–4: the repository-level secrets still exist, so the exposure is
  exactly today's, not wider. Keep the window short, and don't push new
  workflow files or create staging environments until step 5.
- Step 5 onwards: only jobs on `main` that bind `supabase-production`, and
  are approved by the reviewer, can obtain the credentials.

**How the production migration workflow keeps working:**
- Same file, same secret names, same `env:` expressions, same steps
  (verified byte-for-byte apart from the two additions).
- It is dispatched from `main` as before.
- New: a reviewer approval before the job starts, and a refusal when it is
  dispatched from another branch. That refusal comes from the environment
  rule and from its own guard step.

**Why staging can never use the production credentials:**
- After step 5 they exist only in `supabase-production`.
- The staging workflow never binds `supabase-production`; a test forbids
  any production environment.
- It never names the production secrets.
- It has no bulk or dynamic secret access (`toJSON(secrets)`,
  `secrets[...]`, `secrets: inherit` and reusable workflows are forbidden).
- It passes secrets only at step level, and never to install or setup
  steps.
- Each job refuses if a production credential name is present.
- The staging code it runs is only the approved revision, inside jobs bound
  to staging environments, with a read-only `GITHUB_TOKEN` that can't
  dispatch other workflows.

## 7. Dispatch, branch selection and workflow modes

**Registration:** GitHub only lists and dispatches a `workflow_dispatch`
workflow whose file is on the default branch. `main` therefore carries
`.github/workflows/cloudflare-staging.yml` alone, with no application or
script files. The same file, byte for byte, is on `cloudflare-staging`.

**Branch selection:** each run uses the workflow file from the ref chosen
in "Use workflow from".

| Chosen ref | What happens |
|---|---|
| **`main`** (the only supported choice) | `authorize` checks the event, `ref = refs/heads/main` and the workflow path. It then approves `staging_sha` only if it equals `CLOUDFLARE_STAGING_APPROVED_SHA`, is contained in `cloudflare-staging`, and its copy of this workflow is byte-identical to `main`'s. Every other job checks out exactly that SHA. |
| `cloudflare-staging` or any other branch | That branch's copy of the file runs. Its `authorize` refuses (ref is not `main`). Even a modified copy gets **no staging secret** (the staging environments allow `main` only) and **no production secret** (after §6a they exist only in `supabase-production`, which also allows `main` only). |

**Arbitrary code with production credentials:**
- *Through this workflow:* it never binds `supabase-production` and runs
  only reviewed `main` YAML with the approved revision.
- *Through any other branch's workflow:* after §6a step 5 there is no
  repository-level production secret left to read.
- *Remaining trust root:* write access to `main`. Protect `main` (pull
  request with review, no force-push, no deletion).

**Workflow modes:**

| Mode | Job / environment | What it does |
|---|---|---|
| `migrate-staging` | database / `staging-db` | gate (`--db fresh-or-marked`) → `supabase db push` (1–11) → `mark-staging.sql` → 18/18 verification |
| `seed-staging` | database / `staging-db` | gate (`--db marked`) → synthetic fixtures + staging admin (idempotent) |
| `deploy-staging-placeholder` | placeholder / `staging-deploy` | gate (`--env`) → build `scripts/staging/placeholder` → `check-build-config --target placeholder` (no bindings) → `cf deploy --prebuilt` |
| `deploy-staging` | deploy / `staging-deploy` | gate (`--anon`) → **Access gate (`--access`)** → staging build (guard) → `check-build-config --target staging` → `bundle-size` (5 MiB budget) → `vinext-cloudflare deploy --skip-build` → post-deploy `--site` check |
| `smoke-staging` | smoke / `staging-test` | gate (refs + Access + banner + noindex) → smoke round (`--profile smoke`, about 5 min): headers and staging identity, admin login and pages, CMS edit saved → public within 60 s → restored, cover upload → deleted and verified gone, the seeded order fixture's status changed → restored. **No order request**, so the full test's per-IP window stays fresh. JSON artifact for 14 days |
| `test-staging` | test / `staging-test` | gate (refs + Access + banner + noindex) → cold → browser round → warm ×2 → 30-min soak → evaluate; JSON artifact for 14 days. **Fail-fast:** if the browser round fails, warm, soak and evaluate are skipped and the failed check names go to the job summary |
| `production-build-check` | no environment, no credentials | gate (`--env`) → production build (placeholder anon key) → `check-build-config --target production` → `bundle-size`; nothing uploaded |

Every mode first runs `authorize` (no secrets), then its job at the approved revision.

Order after every deployment: `deploy-staging` → `smoke-staging` →
`test-staging`, each only after the previous one passed. The smoke round's
order check uses the order fixture written by `seed-staging` (directly to
the database, never through the order API), so run `seed-staging` once
after this change; until then it falls back to the newest synthetic order
from an earlier full test. Wait 60 minutes before re-running
`test-staging` after a run that stopped early (including a fail-fast
stop), so the browser round gets a fresh per-IP order window.

**Staging acceptance criteria** (`evaluate.mjs`; missing evidence is a FAIL):
1. Runtime stability: zero error-1102 pages, network errors and failed
   invocation outcomes across cold, two warm runs and the soak.
   Cloudflare analytics are required.
2. Functionality: every browser check passes, and every measured route
   returns only its expected statuses. The browser checks cover:
   - security headers, `robots.txt` and the sitemap;
   - the banner and the placeholder;
   - orders: 201 → 200 (case variant) → 409 (duplicate Transaction ID) →
     429 at exactly the 6th;
   - spoofed IP headers don't reset the limit;
   - anonymous `/admin` redirects to login;
   - admin login and six pages;
   - Pending → Invalid;
   - a CMS edit visible publicly within 60 s, then restored;
   - a cover upload, then its deletion, verified at the public URL.

The size budget is enforced at deploy. CPU percentiles and the monthly
request and CPU projection are reported.

## 8. Local validation (05E-B2B)

All on the disposable QA stack (`qa_disposable` marker), with every
production credential and production `NEXT_PUBLIC_*` value removed from
the environment.

| Check | Result |
|---|---|
| Unit tests | 106/106 (4 new workflow-policy tests; a mutation adding a production secret makes 2 fail) |
| ESLint, `tsc` | clean |
| `next build` emulating **Vercel production** (`VERCEL=1 VERCEL_ENV=production`) | `/`, `/analysis`, `/admin/login`, `/api/analysis`: one CSP and one HSTS header each, `/` indexable, no banner, normal `robots.txt`, so Vercel production is unchanged |
| Build guard (`cloudflare.config.ts`) | 13 cases: 4 valid configurations accepted, 9 bad ones refused (prod URL on staging, staging URL on production, missing `PRODUCTION_REF`, wrong `SITE_ENV`, local URL without `LOCAL_TEST`, bad target, non-Supabase URL) |
| Production-target build with no credentials (fake ref, placeholder key, no network) | builds; config check OK (`mktbd`, no workers.dev, bKash secret, CPU cap 1000 ms); 680 KiB gzip |
| Staging-target build on QA | config check OK; 680 KiB gzip |
| `bundle-size.mjs` | passes at 5120; fails at 500 and above the 10 MiB limit |
| Staging Worker on local workerd | browser round **23/23**; cold, warm and soak: 0 × 1102, 0 network errors, expected statuses only |

Production-mode Worker, isolation-gate and evaluator results are in the
stage report.

## 8a. Pre-deployment QA (required)

**Rule:** a staging deployment is recommended only after Level 1 and
Level 2 both pass on the exact commit to be deployed. Level 3
(`smoke-staging`, §7) then runs before the full `test-staging`.

| Level | Command | What it proves | Time |
|---|---|---|---|
| 1. Static | `npm run qa:static` | lint, `next typegen` + `tsc`, unit tests, secret scan, staging workflow identical to main, staging build refuses the production URL, synthetic production and staging builds with `check-build-config` and the bundle budget | ~1 min |
| 2. Local integration | `npm run qa:local` | the Worker on local workerd against a disposable local Supabase (real Postgres, RLS, Auth, Storage): the smoke round, then the full browser round (as on staging), in a throttled Chromium (CPU ×4, 4 Mbit/s); fails if the smoke round changes the order rate-limit counters, and the full round's fresh-window check proves it end to end | ~4 min |
| 3. Staging smoke | `smoke-staging` mode (§7) | the deployed Worker behind Access with the staging Supabase project | ~5 min |

Both scripts first remove every credential-like environment variable.
Level 1 builds with synthetic, non-existent Supabase refs. Level 2 runs
the `mktbd-qa` stack: config generated from `supabase/config.toml` with
ports 55xxx, refused if the workdir is linked to a hosted project, reset
to the repo's migrations, marked `qa_disposable`, and seeded with
synthetic fixtures and a random admin password. Its `LOCAL_TEST` build is
deleted when the run ends. `.dev.vars` (local QA key only) is removed as
soon as the Worker is up. Prerequisites: Docker running, `npm ci`,
Playwright with Chromium.

Level 2 cannot reproduce, so they stay for the staging tests: Cloudflare
Access and edge behaviour (CF-Connecting-IP, edge error pages), global
Workers Cache propagation, `global_fetch_strictly_public` (dropped by
`LOCAL_TEST`), real latency, hosted-Supabase dashboard settings, and
Cloudflare analytics.

**Security probes (Stage 3A, part of Level 2):** after the browser rounds,
`scripts/qa/rls-probe.mjs` reads and writes every public table and the
`editorial-media` bucket through the real PostgREST and Storage APIs as
three identities: anonymous, a non-admin account created for the run, and
the admin. Every refused write is checked against the database, so "no
error" never passes for "no effect". `scripts/qa/auth-probe.mjs` covers
these in a real browser, each refused save with an unchanged record:

- logout, and replaying the signed-out session's cookies;
- a non-admin account against admin pages and a Server Action;
- an admin session revoked, or its cookie gone, mid-edit;
- a control save with a valid admin session.

Both use synthetic records only, remove them, and refuse anything but the
local QA stack.

**CMS lifecycle probe (Stage 3B, part of Level 2):**
`scripts/qa/cms-probe.mjs` drives the admin UI as the seeded admin, for an
Analysis, an Article and a Case Study:

- create a draft and check it is absent from the detail page, archive,
  feed, sitemap and homepage;
- refused publishing attempts (no slides, empty body, no cover, price 0 or
  malformed, missing fields, a slug in use, media never uploaded or from
  another record), each with an unchanged record;
- media: slides uploaded, reordered and removed; Article covers and inline
  images replaced and removed; Case Study covers replaced, including after
  a refused save. Old objects must be gone from Storage;
- publish, edit while published (the cached detail page and archive must
  refresh within 60 s), unpublish and delete. Delete must also remove
  slides, tag links, the Article link and the Storage folder; orders stay,
  unlinked;
- tags: create, duplicate refusal, inline create, archive filtering,
  rename, delete refused while in use, and delete once unused.

Results are read back from the database, `storage.objects` and the public
site. The probe uses `qa-cms-*` records only, removes them, and refuses
anything but the local QA stack.

Throttling makes timing bugs more likely to show, not certain to.
Interacting with a control before React hydrates it is the known case
(staging run #19: no upload request was ever sent). The browser round
waits for hydration (`interactive()`), and
`tests/unit/browser-test-rules.test.mjs` fails any `setInputFiles`
without that wait. Test uploads are deleted through the CMS discard path
and verified gone. Diagnostics (failed requests, 5xx, console and page
errors) are sanitized: paths without queries, with IDs, tokens, JWTs and
emails redacted.

## 9. Before the first staging deployment

Each step is a separate approval; stop on any failure.

1. **Production credential isolation** (§6a, steps 1–6), including the
   `supabase-migrate.yml` environment patch on `main`.
2. **Commit the 05E-B2C changes to `cloudflare-staging` and push.** Note
   the resulting full SHA.
3. **Register the workflow on `main`:** one commit adding only
   `.github/workflows/cloudflare-staging.yml`, byte-identical to the
   branch's copy.
4. **Protect `main`:** require pull requests with review, block
   force-pushes and deletion.
5. **Owner setup:**
   - Cloudflare account steps 1–3, the deploy token and the analytics
     token (§4);
   - the Supabase staging org and project (§5);
   - the three staging environments (`main` only, reviewer, no bypass) and
     their secrets and variables, including `PRODUCTION_SUPABASE_REF` (§6).
6. **Owner:** set repository variable `CLOUDFLARE_STAGING_APPROVED_SHA` to
   the SHA from step 2.
7. **Dispatch from `main`**, each run approved: `production-build-check`,
   then `migrate-staging`, `seed-staging`, `deploy-staging-placeholder`.
8. **Owner:** enable Access on mktbd-staging's workers.dev route (email +
   Service Auth), put the service token into `staging-deploy` and
   `staging-test`, check the Access login in a private window, and set the
   staging Worker secret.
9. **Dispatch** `deploy-staging` (refuses unless Access is proven), then
   `test-staging`.
10. Review the results together.

**Whenever `cloudflare-staging` changes,** before the next run: review
it, update `CLOUDFLARE_STAGING_APPROVED_SHA`, and, if the workflow file
changed, commit the identical file to `main`. `authorize` refuses until
both match.

Production hosting comes after this, each step approved separately: image
variants, the DNS move, production secrets, a production deploy job and
the cutover.

Rollback at any point: unset `CLOUDFLARE_STAGING_APPROVED_SHA` (every run
then refuses), redeploy the placeholder or delete the staging Worker,
revoke the Cloudflare tokens and the Access service token, pause the
staging project. Production is unaffected.

## 10. Open issues

- **Images:** until upload-time variants are implemented
  (`docs/IMAGE_OPTIMIZATION.md`), Workers serves Storage originals as-is.
  Locally that was up to 4.2 MB of images on an Analysis page, against
  05D's optimized output on Vercel. This **blocks the production cutover**,
  not staging.
- **Freshness across locations:** CMS saves invalidate Workers Cache by
  tag, which is designed to propagate globally. The staging freshness
  check runs from one location only, so it can't prove that. Before
  cutover, check a CMS edit from a second region, or accept the 5-minute
  ISR window as the bound.
- **Vercel preview deployments:** `VERCEL_ENV=preview` is non-production,
  so previews now show the staging banner, are noindex (as before) and
  accept only the bKash placeholder. With a real number configured,
  purchasing is paused on previews. Production and local `next dev` are
  unchanged.
- `revalidatePath("/case-studies/[slug]", "page")` didn't refresh detail
  pages under `next start` (pre-existing). The freshness check covers
  vinext; fix by revalidating concrete paths.
- vinext's header matcher doesn't match `/` with `/:path*`; handled by an
  explicit `/` rule in `next.config.ts`, which is a harmless duplicate
  under Next.js (verified: one header each).
- vinext 1.1.0 and `@cloudflare/vite-plugin` 2.0.0-beta are pinned exactly;
  treat upgrades as their own change.
- Locally, `build:vinext` overwrites `.next/types/routes.d.ts`. Run
  `npx next typegen` before `tsc`. CI is unaffected.
