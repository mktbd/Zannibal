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
                        (manual dispatch, branch cloudflare-staging, reviewer approval per job)
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
| `PRODUCTION_REF` (from the ref-only repository secret `PRODUCTION_SUPABASE_REF`, never the production workflow's `SUPABASE_PROJECT_ID`) must be present and well-formed. | all jobs |
| Ref in `STAGING_SUPABASE_URL` = typed ref ≠ production ref; ref in `STAGING_DB_URL` = typed ref. | database, deploy, test |
| None of `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` is set in the job (checked at run time; values never read). | every job |
| **Access before application:** the anonymous request is redirected to `<team>.cloudflareaccess.com` *and* the CI service token gets 200. A 404 (no Worker yet), a 200, a 403 without the login redirect, or a lookalike host all fail. | deploy-staging (before build and upload, and again after) |
| Migrate: database brand new or carrying this ref's marker. Seed: marker required. | database |
| Deploy: anon RPC `public.staging_identity()` answers `mktbd-staging:<ref>`; no DB credential in this job. | deploy |
| Build: target, `SITE_ENV` and Supabase ref all agree (`cloudflare.config.ts`); built config matches the staging shape (`check-build-config.mjs`). | deploy |
| Target is `https://mktbd-staging.<sub>.workers.dev`, refuses requests without the Access service token, accepts them with it, and shows the banner and noindex. | test (and every test script) |

Further:
- **Separate credentials:**
  - three GitHub environments, each limited to the `cloudflare-staging`
    branch and each requiring a reviewer;
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

Create under *Settings → Environments*. For each environment: **Deployment
branches → `cloudflare-staging` only**, and **Required reviewers → owner**.

| Environment | Secrets | Variables |
|---|---|---|
| `staging-db` | `STAGING_DB_URL` (session pooler), `STAGING_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_ADMIN_PASSWORD` (≥ 16 chars) | `STAGING_SUPABASE_URL`, `STAGING_ADMIN_EMAIL` |
| `staging-deploy` | `CLOUDFLARE_DEPLOY_TOKEN`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_SUBDOMAIN` |
| `staging-test` | `CLOUDFLARE_ANALYTICS_TOKEN`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `STAGING_ADMIN_PASSWORD` | `STAGING_SUPABASE_URL`, `STAGING_ADMIN_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_SUBDOMAIN`, `EXPECTED_DAILY_PAGEVIEWS` (cost projection only) |

**Repository-level (new):** secret `PRODUCTION_SUPABASE_REF`.
- It holds the production project ref: an identifier that also appears in
  the public site's Supabase URL, not a credential.
- It is the only production value the staging workflow reads, and only to
  prove the staging target is a different project.
- It is a secret rather than a variable so it is masked in logs.
- If it is missing, every staging job fails closed.

## 6a. Production credential isolation: migration plan

**Today (reviewed by name only; no values read or printed):**
- `supabase-migrate.yml` reads three **repository-level** secrets:
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`.
- It binds no environment, so any workflow on any branch, written by anyone
  with write access, could reference them.
- The staging workflow references none of them: the policy tests and the
  run-time gates enforce that.

**Target:**
- Those three secrets live only in a protected GitHub environment
  `production`:
  - deployment branches: `main` only;
  - required reviewer: owner;
  - optionally a short wait timer.
- `supabase-migrate.yml` binds `environment: production`.
- No branch other than `main` can obtain them, and every run needs an
  approval.

**Steps** (each a separate approval; nothing done yet). Order matters so
the migration workflow never loses access:
1. Create environment `production`: branches `main` only, reviewer owner.
   No secrets yet.
2. Add the same three secrets to `production`, same names and values,
   copied by the owner from the Supabase dashboard (GitHub can't reveal
   existing secret values). While both exist, the environment secret takes
   precedence inside environment-bound jobs.
3. Add repository secret `PRODUCTION_SUPABASE_REF` (the project ref only),
   used by the staging workflow.
4. A one-line change to `.github/workflows/supabase-migrate.yml`, under
   `jobs.migrate`:
   ```yaml
       environment: production
   ```
   Commit it on `main` through the normal approval. A `preflight` or
   `verify` run then proves the workflow reads the environment secrets
   (it waits for the reviewer and passes the same checks as before).
5. Only then delete the three **repository-level** secrets. Run `verify`
   again to prove nothing depends on them.
6. Rollback: re-add the repository secrets, or remove the `environment:`
   line. Either restores today's behaviour.

**How the production migration workflow keeps working:**
- The secret names are unchanged, and its `env:` block
  (`${{ secrets.SUPABASE_* }}`) resolves the environment's secrets once
  the job binds `environment: production`.
- It is manual dispatch on `main`, so the branch rule is satisfied. The
  only new step is the reviewer approval before the job starts.
- The staging workflow is unaffected: it never referenced those names, and
  it reads `PRODUCTION_SUPABASE_REF` instead.

**Why the staging workflow can't use production credentials (after and
before the move):**
- It references no production secret name. Policy tests forbid
  `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_SERVICE_ROLE_KEY` and `VERCEL_TOKEN` in `secrets.` or `vars.`.
- It has no bulk or dynamic secret access: `toJSON(secrets)`,
  `secrets[...]`, `secrets: inherit` and reusable-workflow jobs are all
  forbidden by test.
- GitHub passes a job only the secrets its YAML names. Nothing is inherited
  from the runner or the repository into the process environment.
- Every job's first step refuses if any production credential name is set
  (`check.mjs`, `checkRefs`).
- After the move, those secrets exist only in `production`, which the
  `cloudflare-staging` branch can't use, so even an edited staging
  workflow couldn't read them.

## 7. Workflow modes

| Mode | Job / environment | What it does |
|---|---|---|
| `migrate-staging` | database / `staging-db` | gate (`--db fresh-or-marked`) → `supabase db push` (1–11) → `mark-staging.sql` → 18/18 verification |
| `seed-staging` | database / `staging-db` | gate (`--db marked`) → synthetic fixtures + staging admin (idempotent) |
| `deploy-staging-placeholder` | placeholder / `staging-deploy` | gate (`--env`) → build `scripts/staging/placeholder` → `check-build-config --target placeholder` (no bindings) → `cf deploy --prebuilt` |
| `deploy-staging` | deploy / `staging-deploy` | gate (`--anon`) → **Access gate (`--access`)** → staging build (guard) → `check-build-config --target staging` → `bundle-size` (5 MiB budget) → `vinext-cloudflare deploy --skip-build` → post-deploy `--site` check |
| `test-staging` | test / `staging-test` | gate (refs + Access + banner + noindex) → cold → browser round → warm ×2 → 30-min soak → evaluate; JSON artifact for 14 days |
| `production-build-check` | no environment, no credentials | gate (`--env`) → production build (placeholder anon key) → `check-build-config --target production` → `bundle-size`; nothing uploaded |

Run `test-staging` right after `deploy-staging`. Wait 60 minutes before
re-running it after a run that stopped before the soak, so the browser
round gets a fresh per-IP order window.

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
   - a cover upload.

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

## 9. Before the first staging deployment

Each step is a separate approval; stop on any failure.

1. Done in this stage: branch `cloudflare-staging` pushed (not merged).
2. **Owner setup:**
   - Cloudflare account steps 1–3, the deploy token and the analytics
     token (section 4);
   - the Supabase staging org and project (section 5);
   - the three GitHub environments, each limited to `cloudflare-staging`
     with a required reviewer;
   - their secrets and variables, plus repository secret
     `PRODUCTION_SUPABASE_REF` (section 6).

   Report the staging ref and subdomain (they are not secret).
3. Approve **`production-build-check`**: no credentials, no upload.
4. Approve **`migrate-staging`** (typed ref), then **`seed-staging`**.
5. Approve **`deploy-staging-placeholder`**: static page only.
6. **Owner:** enable Access on mktbd-staging's workers.dev route (email +
   Service Auth policies) and put the service token into `staging-deploy`
   and `staging-test`. Check in a private window that the Access login
   appears. Set the Worker secret `SUPABASE_SERVICE_ROLE_KEY` (staging
   value).
7. Approve **`deploy-staging`**. It refuses unless Access is proven, then
   uploads the application and re-verifies Access, banner and noindex.
8. Approve **`test-staging`** right after it (about 60–75 minutes).
9. Review the results together.

The production credential move (section 6a) can happen at any point. It
doesn't affect staging, and it is recommended before any production
Cloudflare work.

Production hosting comes after this, each step approved separately: image
variants, the DNS move, production secrets, a production deploy job and
the cutover.

Rollback at any point: redeploy the placeholder, or delete the staging
Worker; revoke both tokens and the Access service token; pause the staging
project. Production is unaffected.

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
