# Supabase Setup

Operational setup guide for mktbd's Supabase project — how to create it,
apply the schema, provision the first Admin, and configure Storage. This is
a technical companion to `docs/MKTBD_SPEC.md`; it does not define product
behavior, only how to stand the backend up.

Never put real credentials in this file or anywhere else in the repo.

---

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (or run a local
   instance — see section 8).
2. From **Project Settings → API**, note:
   - Project URL
   - `anon` / `public` key
   - `service_role` key (keep this one secret — never commit it, never send
     it to the browser)

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the three Supabase values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`NEXT_PUBLIC_*` values are safe to expose to the browser — they grant
nothing by themselves; every table is governed by Row Level Security (see
section 5). `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely and must stay
server-only; `lib/supabase/admin.ts` is the only place that reads it, and it
imports the `server-only` package specifically so any accidental import from
client code fails the build instead of shipping the key to the browser.

`SUPABASE_PROJECT_ID` is optional and only used locally by `npm run
gen:types` (section 9) — not read by the running application.

Since Stage 4E the service-role key is **required in production** for Case
Study purchases: `POST /api/orders` uses it (server-side only) to check the
shared rate limit (Stage 5E-A) and record Pending orders. Without it the
endpoint fails closed (503 `temporarily_unavailable`) and no order is
created. `BKASH_PAYMENT_NUMBER` (also server-only, see `.env.example`) sets
the receiving bKash number shown on the purchase page; when it is unset,
purchasing is paused.

All application variables (none of the values belong in the repository;
`.env.example` documents each one):

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL; embedded in the build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key; access is governed by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | for purchases | Server-only; order submission and rate limiting |
| `BKASH_PAYMENT_NUMBER` | to open purchasing | Server-only; unset = purchasing paused |
| `SITE_URL` | no | Canonical origin, default `https://mktbd.co` (Stage 5C) |
| `ORDER_RATE_LIMIT_PER_IP` | no | Default 5 order submissions per client IP per hour |
| `ORDER_RATE_LIMIT_GLOBAL` | no | Default 100 per hour across all clients |
| `ORDER_RATE_LIMIT_TRUST_PROXY` | no | Off-Vercel hosting behind a proxy that overwrites `X-Forwarded-For`/`X-Real-IP` only; never set it on Vercel |
| `SUPABASE_PROJECT_ID` | no | Local type generation only -- see section 8 for why it must not be left set in a shell used for local Supabase work |

`VERCEL` and `VERCEL_ENV` are set by Vercel itself. On Vercel, changing an
environment variable takes effect only on the next deployment.

## 3. Applying migrations

Schema changes live in `supabase/migrations/` as plain, version-controlled
SQL — not manual dashboard edits. Each file is scoped to one concern and
commented; read them in order to understand the schema:

| File | Covers |
|---|---|
| `20261003000001_foundations.sql` | extensions, `content_status`/`order_status` enums, shared `updated_at` trigger |
| `20261003000002_profiles.sql` | admin authorization (`profiles`, `is_admin()`, new-user trigger) |
| `20261003000003_tags.sql` | shared tag reservoir, name normalization |
| `20261003000004_analyses.sql` | `analyses`, `analysis_slides` |
| `20261003000005_case_studies.sql` | `case_studies` |
| `20261003000006_content_tags.sql` | `analysis_tags`, `case_study_tags`, and the tag-visibility policy that depends on them |
| `20261003000007_orders.sql` | `orders`, order-number generation |
| `20261003000008_storage.sql` | `editorial-media` bucket + Storage policies |
| `20261004000009_storage_restrict_listing.sql` | replaces the public `SELECT` policy on `storage.objects` with an admin-only one, so the bucket can't be listed anonymously |
| `20261008000010_articles.sql` | Stage 5A, applied to production 2026-10-08. `articles`, `article_tags`, Article branch of the tag-visibility policy, `analysis_article_links` (one-to-one Analysis ↔ Article link; publicly readable only when switched on and both records are published). The "PROPOSED" note in the file's header comment predates its approval; migration files are not edited after being applied |
| `20261009000011_order_hardening.sql` | Stage 5E-A, applied to production 2026-10-09 (GitHub Actions run #12, after preflight run #10 and dry-run #11). Unique index on the normalised bKash Transaction ID (`upper(btrim(...))`), four order-field length constraints, `authenticated` may update only `orders.status`, unused `anon`/`authenticated` privileges on `orders` revoked, `order_rate_limits` table and `consume_order_rate_limit()` (service role only). Additive; reverse procedure in `MKTBD_SPEC.md` section 7, "Payment security (Stage 5E-A)" |

**Against the production project**, use the manual GitHub Actions
workflow `.github/workflows/supabase-migrate.yml` ("Supabase migrate
(manual)"), never a local `db push`. It runs the
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
with the project credentials held as repository secrets, checks that
`supabase/migrations/` contains exactly the expected files, and has four
modes, each run separately and each needing its own approval:

| Mode | What it does | Writes? |
|---|---|---|
| `preflight` | One pinned, reviewed SELECT (`supabase/checks/*_preflight.sql`) reporting **aggregate counts only** about existing data that could stop the pending migration; fails if a blocking count is above 0 | no |
| `dry-run` | Shows the remote migration history and the push plan; fails unless the plan is exactly the expected pending migration(s) | no |
| `apply` | Repeats the dry-run checks, pushes, then verifies every expected version is recorded remotely | **yes** |
| `verify` | One pinned, reviewed, catalog-only SELECT (`supabase/checks/*_verify.sql`) returning named **true/false checks only**; fails unless every check is true | no |

Order for a new migration: update the workflow's expected/pending lists
(and, if the migration needs them, add a preflight and a verify query with
their SHA-256 pinned in the workflow) in a reviewed commit, then run
`preflight` → `dry-run` → `apply` → `verify`. The `preflight` and `verify`
queries run through the CLI's linked connection with the workflow's
database privileges: the pinned hash guarantees that only the reviewed
query runs, and the workflow's guards refuse anything but a single
read-only SELECT -- but the hash does not by itself restrict database
permissions, so review those queries as carefully as a migration.

**Production verification for migration 11.** `verify` mode runs
`supabase/checks/20261009000011_order_hardening_verify.sql`: 18 checks,
from system catalogs, privilege functions and the migration history only
(it never reads a row of `orders` or any other customer/content table) --
migration recorded; the unique index exists, is valid and is exactly
`upper(btrim(bkash_transaction_number))`; the four length constraints are
validated; `authenticated` can update `status` and no other column, `anon`
nothing; `anon`/`authenticated` have no INSERT/DELETE/TRUNCATE/REFERENCES/
TRIGGER on `orders` while admin reads keep SELECT; `order_rate_limits`
exists with RLS on, no policies and no privileges for `anon`,
`authenticated` or `service_role`; `consume_order_rate_limit()` exists,
is `SECURITY DEFINER` with an empty `search_path`, and only `service_role`
may execute it; exactly the twelve expected public tables, all with RLS;
exactly the expected 21 public and 4 Storage policies, and their
definitions (command, roles, USING, WITH CHECK) match migrations 1-11 by
hash. The policy hash assumes the same Postgres major version as local
development (17); a mismatch fails closed and should be investigated
before anything else is changed.

**Rollback.** Migrations are additive and are not edited after being
applied. To undo one, write and review a new migration that reverses it,
then roll it out the same way. For migration 11 the reverse (and the
order: application first, because the 5E-A code fails closed without
`consume_order_rate_limit()`) is in `MKTBD_SPEC.md` section 7.

**Against local Supabase** (requires Docker — see section 8):

```bash
npx supabase start
npx supabase db reset   # applies every migration from scratch
```

Never hand-apply schema changes through the dashboard's SQL editor as a
substitute for a migration file — it drifts the live database from what's
in version control. The SQL editor is fine for one-off *data* changes (like
first-admin provisioning below), never for schema.

## 4. Provisioning the first Admin

There is no self-serve sign-up flow in V1 (by design — see
`MKTBD_SPEC.md` section 12). Creating the first account, and granting it
Admin, is a deliberate two-step manual process:

1. **Create the user.** Supabase Dashboard → Authentication → Users → "Add
   user" → set an email and password directly (or send an invite). This
   creates a row in `auth.users`; a trigger (`handle_new_user`) immediately
   creates a matching `public.profiles` row with `role = 'user'`.
2. **Grant Admin.** Dashboard → SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = '<the user's UUID, from the Users list>';
   ```

That's it — the user can now sign in at `/admin/login`. Every subsequent
admin account is provisioned the same way (step 1 by whoever manages the
Supabase project, step 2 by an existing admin or the project owner via SQL).
There is intentionally no in-app "promote to admin" button in V1.

## 5. Row Level Security model

RLS is enabled on every table in `public`. The short version (full detail
is in each migration's comments):

- **Anonymous/authenticated-non-admin**: can read only `status = 'published'`
  Analyses, Articles (migration 10) and Case Studies (and their slides/tags, via joins that are
  independently policy-checked so a draft can't leak through a join — see
  `20261003000006_content_tags.sql`). Cannot read `profiles` (other than
  their own row) or `orders` at all. Cannot write anything.
- **Admin** (`public.profiles.role = 'admin'`, checked via the
  `public.is_admin()` SECURITY DEFINER helper): full read/write on
  Analyses, Articles, Case Studies, slides, tags; read + update (not delete) on
  Orders; full Storage access to the `editorial-media` bucket.
- **Orders have no public INSERT policy at all.** MKTBD_SPEC.md section 9
  asks for a controlled server-side mutation boundary for public order
  submission rather than an open client-side INSERT grant. That boundary
  is `POST /api/orders` (Stage 4E): it validates the customer's input,
  re-reads the published Case Study with the anon client, and only then
  inserts a Pending order with the service-role client. Nothing but the
  service role can write to `orders`.

## 6. Storage configuration

One public bucket, `editorial-media`, created by
`20261003000008_storage.sql`:

- Public bucket: images are delivered by URL
  (`/storage/v1/object/public/editorial-media/...`) without consulting
  `storage.objects` RLS.
- Listing/API `SELECT` is admin-only since
  `20261004000009_storage_restrict_listing.sql` (originally public in
  migration 8), so anonymous clients cannot enumerate paths.
- 5 MB per-file limit, restricted to `image/jpeg`, `image/png`,
  `image/webp`.
- Insert/update/delete restricted to admins via the same `is_admin()`
  check used everywhere else.

No bucket exists for the paid Case Study PDF — per spec, that's never
uploaded to the CMS in V1; fulfilment is manual.

Path convention (enforced by the Admin CMS, not the database; the comment
in migration 8 predates it). Object names are random UUIDs so they can't be
guessed; slide order lives in `analysis_slides.position`, not in the name:

```
analysis/{analysis_id}/{uuid}.{jpg|png|webp}
case-studies/{case_study_id}/cover-{uuid}.{jpg|png|webp}
articles/{article_id}/cover-{uuid}.{jpg|png|webp}   (migration 10)
articles/{article_id}/image-{uuid}.{jpg|png|webp}   (migration 10; inline body images)
```

Article paths need no Storage policy change: the existing admin-only
write policies cover the whole bucket.

Uploads go straight from the browser to Storage under the admin's own
session. After a save or delete succeeds, the CMS removes any object in
that record's folder that no row references (replaced covers, removed
slides, abandoned uploads).

## 7. Auth URL / redirect configuration

For local development against the Next.js dev server
(`http://localhost:3000`), no extra Auth URL configuration is needed —
email/password sign-in doesn't involve a redirect-based OAuth flow. If a
magic-link or OAuth provider is added later, configure **Authentication →
URL Configuration** in the dashboard with the deployed site URL and
`/admin/login` as an allowed redirect target.

## 8. Local development

This repo includes `supabase/config.toml` (from `supabase init`). Full
local development (`supabase start`) requires Docker, which this project
doesn't assume is available in every environment — if it isn't, develop
against a real (free-tier) hosted Supabase project instead; the workflow is
identical either way.

With Docker available:

```bash
npx supabase start     # spins up local Postgres + Auth + Storage + API
npx supabase db reset  # (re)applies all migrations -- DELETES all local data
```

**CLI safety: inherited production credentials.** The Supabase CLI reads
`SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`
from the environment. If a shell (or a CI/cloud session) has them set for
the production project:

- `supabase start` uses `SUPABASE_PROJECT_ID` instead of `project_id` in
  `supabase/config.toml` to name the local containers and volumes, so a
  "separate" local stack can silently attach to an existing one;
- `--linked` commands, and commands like `migration repair` or `db query`
  run without an explicit target, can reach the **production** project.

So, for local work:

- run the CLI with those variables removed, e.g.
  `env -u SUPABASE_PROJECT_ID -u SUPABASE_ACCESS_TOKEN -u SUPABASE_DB_PASSWORD -u SUPABASE_SERVICE_ROLE_KEY npx supabase ...`;
- target a local database explicitly with `--local` or
  `--db-url "postgresql://postgres:postgres@127.0.0.1:<port>/postgres?sslmode=disable"`,
  and check the container names (`docker ps`) and port before anything
  that writes;
- never run `db reset` against a database whose data you need; for tests
  that must delete data, use a separate disposable stack (its own
  `project_id` and ports), and make destructive test scripts refuse to run
  unless the target database carries a marker that only the disposable
  database has;
- production schema changes go only through the workflow in section 3.

`supabase start` prints a local URL/anon key/service-role key — put those
in `.env.local` for local development.

## 9. Regenerating database types

`lib/types/content.ts` is currently hand-written to mirror the schema in
`supabase/migrations/`. Once a real project exists, Supabase can generate
exact TypeScript types from the live schema:

```bash
SUPABASE_PROJECT_ID=<your-project-ref> npm run gen:types
```

This writes `lib/types/database.types.ts`. That file is not committed yet
(generating it requires live project credentials this repo doesn't have),
and `lib/types/content.ts` is not auto-derived from it — a future task
should decide whether `content.ts` stays a hand-maintained, app-shaped
layer on top of the generated types (recommended: keeps DB-row shape out of
UI code) or is retired in favor of them directly.

## 10. Security assumptions

- RLS is the actual enforcement boundary for all data access — the
  application's own checks (`lib/auth/admin.ts`, `proxy.ts`) are
  defense-in-depth, not the only gate. A bug in either would still be
  caught by Postgres refusing the query/mutation.
- The service-role key is never sent to the browser and is only read from
  `lib/supabase/admin.ts` (the client) and `lib/order-rate-limit.ts` (as
  the key for the rate limit's IP hashing), both server-only. The client
  is used in exactly two places, both behind `POST /api/orders`:
  `lib/data/orders.ts` (duplicate-transaction lookup and the INSERT of a
  Pending order, Stage 4E) and `lib/order-rate-limit.ts` (calling
  `consume_order_rate_limit()`, Stage 5E-A). Public reads, Admin reads and
  every Admin mutation still go through RLS.
- `public.is_admin()` is `SECURITY DEFINER` so it can read `profiles`
  regardless of the calling role's own row-visibility — this is standard
  Supabase practice for this exact pattern, and the function's one query
  is narrowly scoped (no wildcard access it grants beyond "is this uid an
  admin").
- Admin promotion has no in-app path. This is intentional: it keeps
  "become an admin" from ever being reachable through an application bug,
  at the cost of a manual SQL step per new admin (acceptable for mktbd's
  V1 single-admin scale).
