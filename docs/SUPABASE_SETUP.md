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
Study purchases: `POST /api/orders` uses it (server-side only) to record
Pending orders. Without it the purchase form shows a "couldn't be
submitted" message and no order is created. `BKASH_PAYMENT_NUMBER` (also
server-only, see `.env.example`) sets the receiving bKash number shown on
the purchase page; when it is unset, purchasing is paused.

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

**Against a hosted project**, using the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
(already a devDependency — run via `npx supabase`):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

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
  Analyses and Case Studies (and their slides/tags, via joins that are
  independently policy-checked so a draft can't leak through a join — see
  `20261003000006_content_tags.sql`). Cannot read `profiles` (other than
  their own row) or `orders` at all. Cannot write anything.
- **Admin** (`public.profiles.role = 'admin'`, checked via the
  `public.is_admin()` SECURITY DEFINER helper): full read/write on
  Analyses, Case Studies, slides, tags; read + update (not delete) on
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
```

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
npx supabase db reset  # (re)applies all migrations
```

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
  `lib/supabase/admin.ts`, which is called from exactly one place:
  `lib/data/orders.ts`, for the duplicate-transaction lookup and the
  INSERT of a Pending order behind `POST /api/orders` (Stage 4E). Public
  reads, Admin reads and every Admin mutation still go through RLS.
- `public.is_admin()` is `SECURITY DEFINER` so it can read `profiles`
  regardless of the calling role's own row-visibility — this is standard
  Supabase practice for this exact pattern, and the function's one query
  is narrowly scoped (no wildcard access it grants beyond "is this uid an
  admin").
- Admin promotion has no in-app path. This is intentional: it keeps
  "become an admin" from ever being reachable through an application bug,
  at the cost of a manual SQL step per new admin (acceptable for mktbd's
  V1 single-admin scale).
