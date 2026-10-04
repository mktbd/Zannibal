# mktbd — Project Specification

This document is the persistent source of truth for the mktbd website and
CMS. It is populated from approved product, UX, CMS, architecture, security
and design decisions.

**Do not silently change an approved decision in this document.** If
implementation reveals a conflict or a materially better approach, raise it
for explicit approval before changing anything here. Technical
implementation details may evolve as needed; the product specification
should remain stable unless the owner approves a change.

At the start of any substantial implementation task, read this document
first.

---

## 1. Product Purpose

mktbd is a Bangladesh-focused business/media publication.

Central proposition: **"mktbd breaks down how businesses grow in
Bangladesh."**

The website is primarily an owned repository for mktbd's business analysis
and research. Two content products:

- **Analysis** — free visual business analyses (multi-slide carousels),
  also published on LinkedIn.
- **Case Studies** — paid, substantially deeper written business
  case studies/research products.

The site should feel like a modern editorial/business publication. It is
explicitly **not** a SaaS site, corporate consultancy site, startup landing
page, generic blog, news portal, or e-commerce marketplace. Editorial
restraint is a core value, not a nice-to-have.

---

## 2. Public Information Architecture

There are only **three** primary public destinations:

| Route | Purpose |
|---|---|
| `/` | Home |
| `/analysis` | Analysis listing |
| `/case-studies` | Case Studies catalogue |

Dynamic content views are not additional primary navigation destinations:

- `/analysis/[slug]`
- `/case-studies/[slug]`

**Do not add** other primary pages (About, Contact, Services, Blog,
Authors, Categories, Pricing, Newsletter, etc.) without explicit approval.

Primary navigation: mktbd logo (→ Home), Analysis, Case Studies. There is
no separate "Home" nav label.

---

## 3. Home Page

Exact conceptual hierarchy, top to bottom. Do not add sections beyond this
without explicit instruction.

```
HEADER
BRAND HERO
LATEST ANALYSIS
PREMIUM CASE STUDIES INTRODUCTION
CO-BUILD YOUR STORY
FOOTER
```

### Header
Left: mktbd logo → Home. Right: Analysis, Case Studies.

### Brand Hero
- Black/dark background, copy on the left.
- Primary positioning: **"We Break Down How Bangladeshi Businesses Grow"**
- Editorial Bangladesh/business image on the right, fading naturally toward
  black near the copy area (not a rigid two-column image box).
- Editorial, cinematic, relatively **compact** — not an oversized
  full-screen startup hero.

### Latest Analysis
- Automatically shows the 3 most recently published Analysis entries.
- Each entry's cover is its first carousel slide.
- Desktop: three tall vertical (9:16) covers side by side, proportions
  preserved. Title sits bottom-right over a subtle black gradient.
- Clicking opens the Analysis carousel viewer.
- "View All Analysis" bottom-right of section, links to `/analysis`.
- Mobile: horizontal swipeable row, vertical cover proportions preserved,
  natural scroll + scroll-snap, next card partially visible.

### Premium Case Studies Introduction
- Not a product listing — a large editorial/banner introduction to the
  paid Case Studies product.
- Image with darkening/gradient treatment.
- Core message: **"Dive Deeper with Our Premium Case Studies"**
- Leads to `/case-studies`.

### Co-Build Your Story
- Compact collaboration CTA for businesses to collaborate on a case study.
- Working headline: **"Co-Build Your Story With Us"**
- Concise supporting copy + email-based CTA. No Contact page.

### Footer
Extremely lean: mktbd, Analysis, Case Studies, LinkedIn, Copyright. No
mega-footer.

---

## 4. Analysis (`/analysis`)

```
HEADER
ANALYSIS HERO
SEARCH + FILTER
EDITORIAL GRID
```

### Hero
Same visual language as Home (black background, copy left, image right
fading to black). Working copy: **"Armchair Analysis about Bangladeshi
Businesses"** (may be refined later).

### Grid
Instagram-profile-like browsing, not a traditional article archive.

- Desktop: 3-column grid.
- Tablet: 2 columns where appropriate.
- Mobile: 2-column visual grid (Instagram-profile-like).
- Each card is primarily the first slide/cover. **No** excerpts, authors,
  dates, visible tags, engagement metrics, or other metadata clutter.

### Viewer
Clicking an Analysis opens a large modal/lightbox over the Analysis page.
Original uploaded slides are used as-is — **never recreate carousel
artwork as HTML.**

- Desktop: left/right nav controls, keyboard left/right, Escape closes.
- Mobile: swipe navigation.
- All: preserve slide aspect ratio (never crop unnecessarily), show
  position (e.g. `1 / 8`), close control, darkened backdrop, background
  scroll locked while open.
- Shareable URL: `/analysis/[slug]` must load the Analysis experience
  directly.

### Search
Operates across Analysis **title** and **tags**. Case-insensitive, partial
match, updates results in place (no separate results page).

### Filter
Uses the shared tag system. An Analysis may have multiple tags. Tags are
discovery metadata — they don't need to be visible on grid cards.

---

## 5. Case Studies (`/case-studies`)

```
HEADER
CASE STUDIES HERO
SEARCH + FILTER
CASE STUDY CATALOGUE
```

### Hero
Same visual language as Home/Analysis. Working copy: **"Deep Dive into Our
Case Studies"**

### Catalogue
Information hierarchy inspired by a premium business case-study store
(e.g. Harvard Business Publishing) — **not** its visual design. Each
listing shows: cover image, tags/category, title, price in BDT, short
description, publication date, "Dive In" CTA. Price is visible before
opening the product.

Search covers title, short description, tags. Filter uses the same shared
tag reservoir as Analysis.

---

## 6. Dynamic Case Study View (`/case-studies/[slug]`)

Product-detail-style content view:

- Cover, content type label, title, short descriptor (if appropriate),
  price in BDT, "Buy Case Study" CTA.
- Product info: industry, page count, publication date, format (PDF).
- **Product Description** — longer explanation of the business situation,
  what the case investigates, what the reader can expect to understand.
  Do not reveal paid conclusions unnecessarily.
- **Related Topics** — from the shared tag system.

**Explicitly out of scope for V1:** reviews, ratings, quantity pricing,
multiple languages, team purchasing, copyright licensing workflows,
related-product recommendation engines, PDF previews.

---

## 7. V1 Purchase Model

No automated payment gateway, no conventional paywall in V1. Pilot uses
**manual bKash payment and manual PDF fulfilment.**

"Buy Case Study" launches a manual purchase flow collecting:

- Customer Name
- Email Address
- bKash Number
- bKash Transaction Number

The system automatically associates: Case Study, Case Study ID, price at
time of purchase, submission timestamp, unique order ID.

Order statuses: **Pending, Fulfilled, Invalid.**

**Critical invariant:** the price is snapshotted into the order at
submission time. Historical orders must remain intact even if the Case
Study's price later changes or the Case Study is later deleted.

The purchase workflow itself is not implemented until a dedicated task;
only foundational schema/type preparation happens early.

---

## 8. Admin / CMS

We are building our own lightweight CMS. **Do not** integrate Sanity,
WordPress, Contentful, Strapi, or any other external CMS.

Admin route: `/admin`. Deliberately small — no WYSIWYG page builder, no
complex editorial workflows, no multiple permission levels, no analytics
dashboards, no newsletter systems, no media-library product, no revision
comparison, no scheduled publishing.

Primary Admin areas: **Dashboard, Analysis, Case Studies, Tags, Orders.**

### Authentication
- Supabase Auth. V1: single Admin role. **Never** a hard-coded admin
  password.
- Authorization enforced **server-side** and via database/storage
  security (RLS) — never merely by hiding UI.

### Analysis Content Model
Fields: Title, Slug (auto-generated from title, editable, unique),
Publication Date, Tags, LinkedIn URL (optional), Carousel Slides (ordered,
multi-image upload, drag-and-drop ordering in Admin), Status
(Draft/Published).

Actions: Create, Edit, Preview, Publish, Unpublish, Delete. No scheduled
publishing. Editing published content updates immediately. Unpublish
returns to Draft. Delete is permanent after explicit confirmation.

### Case Study Content Model
Fields: Title, Slug, Cover Image, Short Description, Product Description,
Price (BDT), Industry, Tags, Page Count, Publication Date, Format (PDF for
V1), Status (Draft/Published).

**Do not** upload/store the paid PDF in the public CMS in V1 — fulfilment
is manual.

Actions: Create, Edit, Preview, Publish, Unpublish, Delete. Deleting a
Case Study must **never** delete or corrupt historical Orders.

### Tags
One centralized, reusable tag reservoir shared between Analysis and Case
Studies. Editors can view, create, rename, and select existing tags (with
autocomplete/suggestions) while editing content. Guard against accidental
duplicate variants (e.g. "F&B" vs "F & B" vs "Food&B"). Prevent deleting a
tag that's actively attached to content unless the relationship is handled
first.

### Orders
Admin can eventually view Orders and their statuses. Order data: unique
Order ID, Customer Name, Email Address, bKash Number, bKash Transaction
Number, Case Study ID (where available), snapshotted Case Study Title,
snapshotted Price, submission timestamp, Status (Pending/Fulfilled/
Invalid). Orders contain customer/payment info and must **never** be
publicly queryable.

---

## 9. Technical Architecture

- **Next.js** (App Router), **TypeScript**, **Supabase**, Vercel-compatible
  architecture.
- Supabase responsibilities: Postgres database, Authentication, file/image
  storage, Row Level Security.
- Next.js responsibilities: public frontend, admin frontend, server-side
  operations where appropriate, SEO, routing, application logic.
- Avoid unnecessary infrastructure and dependencies. Before adding a major
  dependency, consider whether native platform capabilities or a
  lightweight implementation solve the requirement.

### Current codebase layout

```
app/
  layout.tsx              Root layout: html/body, Figtree font
  globals.css              Design tokens (Tailwind v4 @theme) + base styles
  (public)/                Route group for the public site (no URL segment)
    layout.tsx              Public shell: SiteHeader + SiteFooter
    page.tsx                 Home                        /
    analysis/
      page.tsx                Analysis listing            /analysis
      [slug]/page.tsx          Analysis viewer             /analysis/[slug]
    case-studies/
      page.tsx                Case Studies catalogue      /case-studies
      [slug]/page.tsx          Case Study product page     /case-studies/[slug]
  admin/
    login/
      page.tsx                 Login form                  /admin/login
      actions.ts                signInWithPassword Server Action
                                (unguarded — must not sit behind the
                                (dashboard) layout's admin check)
    (dashboard)/              Route group: every authenticated-admin-only
                              screen, no URL segment added
      layout.tsx               CMS shell: requireAdmin() guard + AdminSidebar
      actions.ts                 signOut Server Action
      loading.tsx / error.tsx    Shared loading and error states
      page.tsx                   Dashboard (live counts)     /admin
      analysis/                  Analysis CMS                /admin/analysis
        page.tsx                   List: search, status filter
        new/page.tsx               Create (details first)     …/new
        [id]/edit/page.tsx         Edit + delete              …/[id]/edit
        [id]/preview/page.tsx      Admin-only carousel preview …/[id]/preview
        actions.ts                 saveAnalysis / deleteAnalysis Server Actions
        analysis-editor.tsx        Client editor form
        slide-manager.tsx          Upload, reorder (drag + Up/Down), remove
      case-studies/              Case Studies CMS            /admin/case-studies
        page.tsx, new/, [id]/edit/, [id]/preview/   (same shape as analysis/)
        actions.ts                 saveCaseStudy / deleteCaseStudy
        case-study-editor.tsx      Client editor form
        cover-uploader.tsx         Single cover upload/replace/remove
      tags/                      Tag management              /admin/tags
        page.tsx                   List with usage counts
        actions.ts                 create/rename/delete Server Actions
        tag-create-form.tsx        Client form (useActionState)
        tag-row.tsx                Client row: inline rename, delete confirm
      orders/                    Orders CMS                   /admin/orders
        page.tsx                   Work queue: search, status filter
        [id]/page.tsx              Read-only order + status   …/[id]
        actions.ts                 updateOrderStatus (the only order mutation)
        status-control.tsx         Explicit "Mark as …" buttons

components/
  layout/
    site-header.tsx          Public header: text wordmark + primary nav (black)
    site-nav.tsx              Client nav with current-page marker
    site-footer.tsx           Lean public footer (black)
  site/
    primitives.tsx            Container, Eyebrow, SectionHeading, ButtonLink,
                              TextLink, Highlight
  admin/
    admin-sidebar.tsx         Admin nav: sidebar (lg+), menu disclosure below
    page-header.tsx            Page title + description + contextual actions
    order-status-badge.tsx     Pending / Fulfilled / Invalid marker
    ui.ts                      Shared button/input class strings
    tag-selector.tsx           Shared tag combobox (typeahead, inline create)
    editor-parts.tsx           Editor action bar, delete confirm, notices,
                               auto-slug + unsaved-changes hooks
    editor-state.ts            Editor action result type + notice texts
    form-field.tsx             Label/hint/error wrapper
    list-filters.tsx           Title search + status filter (GET form)
    status-badge.tsx           Draft / Published marker
    preview-carousel.tsx       Simple slide viewer for admin previews
    upload.ts                  Browser → Storage upload with progress

lib/
  supabase/
    client.ts                Browser Supabase client (anon key)
    server.ts                Server Supabase client (anon key, cookie-based
                              auth, for Server Components/Actions)
    admin.ts                  Privileged server-only client (service-role
                              key) — bypasses RLS, must never reach the
                              browser; not yet called from anywhere (no
                              feature in this stage needs it)
  auth/
    admin.ts                 requireAdmin() — the authoritative server-side
                              admin-role check (React cache()-deduped per
                              request), called by the admin layout, every
                              admin page and every admin Server Action
  tags.ts                    Tag name clean/normalize/validate helpers
                              (mirror tags.normalized_name)
  slug.ts                    slugify/validateSlug (mirror *_slug_format)
  media.ts                   Image type/size rules, Storage path builders
                              and ownership checks, public URLs
  validation.ts              Server-side field parsers (dates, URLs, BDT…)
  format.ts                  Date, Dhaka date-time and BDT formatting
  site.ts                    Public identity: name, tagline, primary nav,
                              LinkedIn URL (null until provided)
  orders.ts                  Order status enum, labels, search columns
  search.ts                  Literal ILIKE helpers (likePattern, ilikeAnyFilter)
  data/
    analysis.ts               getPublishedAnalysisBySlug() — minimal,
                               strongly typed, never exposes drafts
    case-studies.ts            getPublishedCaseStudyBySlug() — same contract
    admin/
      dashboard.ts             getDashboardCounts() — admin-session counts
      tags.ts                  getTagsWithUsage() — tags + usage counts
      content.ts               Analysis/Case Study list + edit reads
      content-mutations.ts     Tag-link sync, Storage list/cleanup, slug
                               conflict lookup (session client only)
      orders.ts                listOrders() / getOrder() (snapshots only)

tests/
  unit/                      node:test unit tests for slug/validation/media/
                              order/search rules (`npm test`, no extra
                              dependencies)
  types/
    content.ts                Shared TS types for Analysis, CaseStudy, Tag,
                               Order, Profile — mirrors the real schema in
                               supabase/migrations/

proxy.ts                     Next.js 16 "proxy" (middleware rename): session
                              refresh + redirects unauthenticated /admin/*
                              visitors to /admin/login. Defense-in-depth
                              only — requireAdmin() is the real gate.

supabase/
  config.toml                 Local Supabase CLI config (from `supabase init`)
  migrations/                  Version-controlled schema — see
                                docs/SUPABASE_SETUP.md for the full list and
                                how to apply them

docs/
  MKTBD_SPEC.md              This document
  SUPABASE_SETUP.md           Supabase project setup, migrations, first-admin
                              provisioning, Storage config, security
                              assumptions
```

All public routes live in the `(public)` route group so the Admin shell
(different layout, no public header/footer) can live alongside them
without affecting the public URL structure. Inside `app/admin/`, a second
route group (`(dashboard)`) separates every authenticated-admin-only screen
from `/admin/login`, which must stay outside the admin-role guard — a
login page behind its own login requirement would be a redirect loop.

None of the admin or public pages are visually finished — they remain
placeholder shells (now auth-protected) per the current implementation
stage (see section 16).

### Notes for Next.js 16 (read before writing new code)

This project pins **Next.js 16.3.5**, which is newer than most models'
training data and has real breaking changes vs. Next.js 14/15 patterns.
Next.js itself writes a reminder of this into `AGENTS.md` on `next dev` —
read the relevant guide under `node_modules/next/dist/docs/` before
assuming an older API. A few specifics that bit this
project during setup / are easy to get wrong from memory:

- **Route params/searchParams are `Promise`s.** `params`/`searchParams` in
  page/layout props must be awaited (see
  `app/(public)/analysis/[slug]/page.tsx` for the pattern). This has been
  true since Next 15 but is a common stale-memory mistake.
- **Middleware is renamed `proxy`.** When session-refresh middleware is
  added for Supabase Auth, create `proxy.ts` (not `middleware.ts`) with an
  exported `proxy()` function, not `middleware()`. The `edge` runtime is
  not supported in `proxy`.
- **`revalidateTag` now requires a second `cacheLife` profile argument**
  (e.g. `revalidateTag('analysis', 'max')`). For "show the admin's own
  write immediately" semantics (e.g. after publishing content), prefer the
  newly-stable `updateTag` from `next/cache` instead.
- **Turbopack is the default** for both `next dev` and `next build` — no
  `--turbopack` flag needed (already reflected in `package.json` scripts).
- **ESLint config is flat-config-native.** `eslint-config-next` exports
  ready-to-spread flat config arrays (`eslint-config-next/core-web-vitals`,
  `eslint-config-next/typescript`) — import and spread them directly in
  `eslint.config.mjs`, don't route them through `FlatCompat`/legacy
  `.eslintrc` bridging, which errors on this version.
- **TypeScript 7 is not yet supported by `typescript-eslint`.** This repo
  intentionally pins `typescript` to `6.0.3` (the last pre-7 stable) rather
  than `latest`. Don't bump it to a 7.x release without first confirming
  `typescript-eslint` supports it.
- Local images with query strings, `images.minimumCacheTTL` (now 4h
  default) and `images.imageSizes` all changed defaults in v16 — check the
  bundled upgrade guide before tuning `next.config.ts` image behavior for
  Supabase Storage-served images.

---

## 10. Security Rules

Admin contains unpublished intellectual property; Orders contain customer
information. Security is a first-class requirement, not an afterthought.

- Design for Supabase Row Level Security, server-side authorization,
  protected admin routes, secure mutation paths, safe environment variable
  handling, secure Storage policies, input validation, safe image uploads.
- Public users may read **only** published public content. Public users
  must **not** be able to: read drafts, modify content, access Orders,
  enumerate customer data, upload arbitrary files, or access Admin
  mutations.
- Admin users may perform authorized CMS operations, enforced server-side.
- **Never** expose the Supabase service-role key to the browser
  (`lib/supabase/admin.ts` is guarded with the `server-only` package).
- Never rely solely on client-side checks for authorization.

---

## 11. Design System

The public site should feel: editorial, minimal, bold, intellectual,
contemporary, spacious. It should **not** feel like: SaaS, a fintech
dashboard, a generic Tailwind template, a startup landing page, a
corporate consultancy site, or a traditional newspaper portal.

### Typography
**Figtree**, throughout (loaded via `next/font/google` in
`app/layout.tsx`, exposed as the `--font-figtree` CSS variable and wired
as the default `font-sans` in `app/globals.css`).

| Role | Weight |
|---|---|
| Display | ExtraBold / 800 |
| Major headings | Bold / 700 |
| Body | Regular / 400 |
| Navigation / labels / metadata | Medium / 500 |

Brand name is always lowercase: **mktbd**.

### Color System
Core UI is monochrome. Tokens live in `app/globals.css` under `@theme`
(Tailwind v4 turns each into a utility, e.g. `--color-accent-yellow` →
`bg-accent-yellow` / `text-accent-yellow`).

| Token | Value | Tailwind var |
|---|---|---|
| Primary Black | `#000000` | `--color-black` |
| Near Black | `#111111` | `--color-near-black` |
| White | `#FFFFFF` | `--color-white` |
| Off White | `#F5F5F3` | `--color-off-white` |
| Light Grey | `#E7E7E5` | `--color-light-grey` |
| Muted Text | `#6B6B6B` | `--color-muted` |

**mktbd Yellow** — bright editorial highlight against black, currently
`#FFF200` (`--color-accent-yellow`), centralized as a single token so it
can be adjusted later. It is an **editorial accent, not a UI theme
color**: use it selectively for important words/phrases, editorial
emphasis, occasional active/highlight states. Do not apply it to buttons,
borders, icons, or hover effects everywhere — its scarcity is intentional.

### Geometry
Sharp or very subtly rounded. Radius tokens (`--radius-none: 0px`,
`--radius-sm: 2px`, `--radius-DEFAULT: 4px`) cap at 4px — no bubbly
12–24px SaaS-style cards. Hierarchy comes from alignment, spacing, thin
structural borders, typography and imagery.

### Layout
Content max width ~1280px (`--content-max-width` in `app/globals.css`) —
spacious but not endlessly stretched on ultrawide screens.

### Motion
Restrained: subtle image scale on hover, small link/arrow movement,
lightbox fade, smooth filter opening, natural scrolling. Avoid
scroll-jacking, parallax, flying text, large entrance animations,
decorative animation, complex page transitions.

---

## 12. Responsive Philosophy

Mobile-first/responsive, but respecting the approved desktop wireframe
logic in sections 3–6.

- Desktop: spacious editorial layout, ~1200–1300px sensible max content
  width.
- Tablet: 3-column grids may become 2 columns.
- Mobile: minimal header; hero adapts intentionally rather than just
  shrinking; Analysis grid generally 2 columns; Latest Analysis on Home is
  a horizontal swipeable row (9:16 covers preserved, scroll-snap, next
  card partially visible); Case Study catalogue is single-column; Analysis
  viewer is near-full-screen, swipe-first, preserving source slide aspect
  ratio.

---

## 13. Admin Design

Admin prioritizes usability over editorial presentation: Figtree, clean
monochrome UI, clear tables/forms, simple navigation, good spacing. Yellow
may be used sparingly for active states/important actions/status
emphasis. Do not spend effort making Admin resemble the public editorial
site — it is a functional tool.

---

## 14. Content / Asset Philosophy

Home and hero imagery may be hard-coded in V1 — no CMS controls for every
image or piece of homepage copy. The CMS's scope is deliberately limited
to: **Analysis, Case Studies, Tags, Orders.** Do not expand its scope
without instruction.

The mktbd logo asset will be provided separately and should eventually
back the Home navigation control.

---

## 15. Non-Goals (V1)

Explicitly out of scope until approved otherwise:

- Additional primary pages (About, Contact, Services, Blog, Authors,
  Categories, Pricing, Newsletter, etc.)
- Automated payment gateway / conventional paywall
- Reviews, ratings, quantity pricing, multiple languages, team purchasing,
  licensing workflows, recommendation engines, PDF previews on Case Study
  pages
- External CMS integration (Sanity, WordPress, Contentful, Strapi, etc.)
- WYSIWYG page building, multi-role permissions, analytics dashboards,
  newsletter systems, media-library products, revision comparison,
  scheduled publishing in Admin
- Generic CMS controls for homepage imagery/copy

---

## 16. Implementation Stage Log

Track what has actually been built, so future sessions know where the
project stands without re-deriving it from the diff.

### Stage 1 — Foundation (this task)
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 project
  initialized.
- Design tokens established in `app/globals.css` (color, yellow accent,
  radius, content width) + Figtree wired globally.
- Base folder structure for public site, dynamic content routes, Admin,
  shared components, Supabase integration, and shared content types.
- Minimal placeholder route shells for all approved routes (no visual
  design work).
- Supabase browser/server/admin client utilities added — no credentials,
  no database schema, no authentication, no purchase workflow yet.
- `.env.example` added with placeholder Supabase variable names.

Not yet done (future stages): visual design of Home/Analysis/Case
Studies/Admin, Supabase schema + RLS policies, Supabase Auth wiring,
Analysis carousel viewer, search/filter, Case Study purchase flow, Admin
CRUD screens, image/file storage policies.

### Stage 2 — Data, Storage, Security, Admin Auth (this task)
- Full Postgres schema as version-controlled migrations
  (`supabase/migrations/`): `profiles` (admin authorization), `tags`
  (normalized, deduped), `analyses` + `analysis_slides`, `case_studies`,
  `analysis_tags` + `case_study_tags` (join tables), `orders`
  (price/title-snapshotted, `ON DELETE SET NULL` to `case_studies`).
- Row Level Security enabled on every table; public/anon can read only
  published content (and only tags/slides/join-rows that trace back to
  published content — drafts can't leak through a join); all writes are
  admin-only; Orders have no public INSERT policy at all (deferred to the
  future purchase-flow task's server-side boundary).
- `editorial-media` Storage bucket (public read, 5 MB limit, image MIME
  types only, admin-only write) for Analysis slides and Case Study covers.
  No PDF storage — paid fulfilment stays manual.
- Supabase Auth wired up: `/admin/login` (email+password), logout, session
  refresh via `proxy.ts`. Authoritative admin-role check in
  `lib/auth/admin.ts` (`requireAdmin()`), backed by the same `is_admin()`
  check enforced in RLS — a bypass of the app-level check still couldn't
  perform any admin-only database operation.
- `lib/types/content.ts` updated to match the real schema (field-name
  corrections only, e.g. `Tag` no longer has an invented `slug`).
- Two minimal public data-access functions
  (`getPublishedAnalysisBySlug`/`getPublishedCaseStudyBySlug`) — no
  listing/search/admin-CRUD functions yet.
- `docs/SUPABASE_SETUP.md` added: project setup, migration workflow,
  first-admin provisioning, Storage config, type-gen workflow, security
  assumptions.
- Verified: the full migration set applies cleanly and a 27-assertion RLS
  test matrix (anon/non-admin/admin × read/write/storage/tag-dedup/FK-
  restrict) passes against a local Postgres instance standing in for
  Supabase's platform schema. See docs/SUPABASE_SETUP.md and the Prompt 02
  completion report for exactly what that does and doesn't cover.

Not yet done (future stages): visual design of any page, Admin CRUD
interfaces (Analysis/Case Study/Tag editors, slide upload + drag-reorder),
Analysis carousel viewer, search/filter UI, the public order-submission
boundary + manual purchase form, Order management UI, a live Supabase
project (no credentials exist yet — see the Prompt 02 completion report for
what that blocks).

### Stage 3A — CMS Foundation (this task)
- Authenticated CMS shell under `/admin`: black left sidebar from the `lg`
  breakpoint (lowercase mktbd, the five approved destinations, signed-in
  email, sign-out), a top bar with a disclosure menu on smaller screens,
  skip link, visible keyboard focus. Yellow is used only for the active
  nav marker and the pending-orders status marker.
- Dashboard (`/admin`): live counts (Analysis total/published/draft, Case
  Studies total/published/draft, total Tags, pending Orders) read with the
  admin's own session under RLS, plus New Analysis / New Case Study quick
  actions pointing at the 03B routes (placeholder pages for now).
- Tags (`/admin/tags`): alphabetical list with Analysis / Case Studies /
  total usage counts; create, inline rename, delete with confirmation.
  Duplicate detection is the database's `tags_normalized_name_key`; the UI
  reports the existing tag by name and never merges. In-use tags cannot be
  deleted (UI, Server Action check, and the existing `ON DELETE RESTRICT`
  foreign keys).
- Every admin page and Server Action calls `requireAdmin()`; all reads and
  writes use the session client under RLS. The service-role client is
  still unused.
- Analysis, Case Studies and Orders are protected placeholder modules.
- No schema, migration, RLS, Storage or auth-flow changes.

Known issue (pre-existing, not changed here): `proxy.ts` answers an
unauthenticated Server Action POST (e.g. a session that expired on an open
admin page) with a 307 to `/admin/login`, which the Next.js client cannot
follow for an action, so the page shows the error boundary instead of
returning to login. Nothing is written. A fix would be for the proxy to let
requests carrying the `Next-Action` header through, leaving the redirect to
`requireAdmin()` inside the action.
(Resolved in Stage 3B -- see below.)

Not yet done: Analysis and Case Study editors (03B), Orders management
(03C), public pages.

### Stage 3B — Analysis + Case Studies CMS (this task)
- `/admin/analysis` and `/admin/case-studies` replace their placeholders:
  lists (title search, All/Published/Draft filter, empty states), create
  (`…/new`), edit + delete (`…/[id]/edit`) and an admin-only preview
  (`…/[id]/preview`). No schema change was needed; migrations 1–9 are
  unchanged.
- Explicit status actions: Save draft / Publish (drafts), Update /
  Unpublish (published). Publishing validates server-side: Analysis needs
  title, slug, date and at least one slide; Case Study additionally needs
  cover, short and product descriptions, price > 0, industry and page
  count. A published record can't be saved into an unpublishable state.
- Slugs auto-follow the title on create until edited by hand, never change
  on their own when editing, are normalised server-side to the database
  format, and a uniqueness conflict names the record that owns the slug.
- Tags: one shared combobox (typeahead, keyboard, inline create) over the
  single reservoir; inline creation uses the same code path and
  normalisation as `/admin/tags`, and a normalised duplicate is reported,
  never merged.
- Images: uploaded from the browser straight to the `editorial-media`
  bucket under the admin session (Storage RLS), with client-side type/size
  checks, per-file progress, thumbnails and uncropped display. Paths are
  UUID-named (`analysis/{id}/{uuid}.ext`, `case-studies/{id}/cover-{uuid}.ext`)
  and Server Actions accept only paths inside the record's own folder that
  exist in Storage. Image upload is available once a draft has been saved,
  so abandoned new records can't leave files behind.
- Slide order: drag-and-drop plus accessible Up/Down buttons; saved as one
  upsert of the full ordered list (single statement, so the deferred
  `analysis_slides_unique_position` constraint is checked once at commit).
- Write ordering (PostgREST has no multi-request transaction): unpublish
  first, then fields, slides, tags, publish last; Storage objects are
  deleted only after the database write that stops referencing them
  succeeds, and each save/delete also sweeps unreferenced objects in that
  record's folder (replaced covers, removed slides, abandoned uploads). A
  failed step reports exactly what was not saved.
- Deleting an Analysis cascades to slides and tag links (existing FKs) and
  empties its Storage folder. Deleting a Case Study keeps its orders
  (`case_study_id` → NULL via the existing FK) with their title/price
  snapshots untouched; the confirmation shows how many orders reference it.
- Price: `case_studies.price_bdt` is `NOT NULL DEFAULT 0`, so a blank
  draft price is stored as 0 and treated as "not set"; publishing requires
  a price above 0.
- Every page and Server Action calls `requireAdmin()`; all reads/writes use
  the session client under RLS (service-role client still unused).
- Testing: `npm test` (11 unit tests); plus a 95-check browser suite run
  against a local Supabase stack (real Auth/PostgREST/Storage with
  migrations 1–9 applied), covering the workflows, Storage cleanup and
  anonymous/non-admin rejection. Production was only read, never written.

- Session-expiry fix (the Stage 3A known issue): `proxy.ts` no longer
  redirects Server Action calls (POST with the `Next-Action` header, the
  same test Next.js uses). It still refreshes the session for them; the
  action's own `requireAdmin()` then redirects an expired, signed-out or
  forged session to `/admin/login` as a client navigation, instead of the
  page falling into the error boundary. Page requests (any method without
  that header, and GETs even with it) are still redirected by the proxy,
  and the `(dashboard)` layout re-checks every render.

Still open: Orders management (03C), public pages.

### Stage 3C — Orders CMS + final Admin CMS validation (this task)
- `/admin/orders` replaces the placeholder: an internal verification and
  fulfilment queue for the V1 manual bKash flow (customer pays manually,
  submits name / email / bKash number / transaction number, admin verifies,
  emails the PDF by hand, records the outcome). No "New Order": orders will
  only come from the future public purchase form, which is still
  intentionally unbuilt (no checkout, bKash instructions, submission form,
  confirmation page, emails or PDF delivery).
- List: newest first; order number, title and price snapshots, customer
  name and email, Dhaka-time submission, status (transaction number too on
  wide screens); Pending rows carry the yellow marker and a black edge.
  Search (order number, name, email, transaction; case-insensitive and
  literal -- `%`, `_`, quotes and commas can't act as wildcards or alter
  the PostgREST filter) plus an All/Pending/Fulfilled/Invalid filter via
  URL params, as for Analysis/Case Studies. Capped at the newest 200
  rows; older orders are reached by search.
- Detail (`/admin/orders/[id]`): Order / Customer / Purchase groups, all
  read-only (identifiers selectable for copying). Title and price always
  come from the order's snapshot columns. While the Case Study exists it is
  linked ("View Case Study", noting a later title change); once deleted the
  page says so quietly and shows no link.
- Status: the existing `order_status` enum only (pending, fulfilled,
  invalid), changed by explicit "Mark as …" buttons. `updateOrderStatus`
  calls `requireAdmin()`, validates the enum, writes only `status`, and is
  conditional on the status the admin was looking at, so a double submit or
  a change made in another tab is reported instead of overwritten.
- No order deletion anywhere: no UI and no Server Action, and RLS has no
  DELETE (or INSERT) policy for orders -- verified that even the admin's
  token can't delete through the API. A bad order is marked Invalid.
- Customer, payment and snapshot fields are immutable through the CMS
  (only `status` is ever sent). Note: the database's `orders_update_admin`
  policy itself allows an admin to update any column, so this immutability
  is enforced by the application, not the schema; a trigger or column
  grants would be needed to enforce it in the database.
- Case Study deletion keeps orders: verified locally that the order
  survives, `case_study_id` becomes NULL, every other field is unchanged
  and the detail page renders normally.
- Dashboard: the existing Pending Orders count now links to the pending
  queue. Sidebar: all five modules are live (the "Soon" markers and the
  unused placeholder component were removed).
- No schema change; migrations 1–9 untouched. Production was only read.
- Testing: `npm test` (15 unit tests); a 74-check Orders browser suite and
  the 03A (49) and 03B (112) suites, all against the local Supabase stack,
  covering status changes, stale submissions, field-injection attempts,
  anonymous / non-admin / expired / forged / signed-out sessions, REST
  read/update/insert/delete attempts, search and filters, Case Study
  deletion, mobile layout and keyboard use.

Still open: public pages and the public purchase flow (later prompts).

### Stage 4A — Public design system + global shell (this task)
- Shell: `app/(public)/layout.tsx` wraps every public route (`/`,
  `/analysis`, `/case-studies` and their `[slug]` pages) in a `.site`
  wrapper with skip link, header, `<main id="main">` and footer; it sets
  the public title template (`%s | mktbd`) and a black theme-color. `/admin`
  keeps its own layout and never renders inside it.
- Typography: Figtree only, via `next/font/google` (downloaded at build
  and self-hosted; no runtime request to Google). Fixed a Prompt 01 defect:
  the font variable was on `<body>`, but Tailwind resolves `--font-sans` at
  `:root`, so Figtree had never actually rendered anywhere (public or
  Admin). The variable now sits on `<html>`; Admin picks up Figtree too,
  with no other Admin change. Fluid type tokens: `text-display` (800,
  44→92px), `text-headline` (32→56px), `text-title` (24→34px), `text-lede`
  (18→21px); body stays 16px. Uppercase only for small eyebrow labels.
- Palette: unchanged tokens (black, near-black, white, off-white, light
  grey, muted, accent yellow). Yellow is used only for the current-page
  underline, the eyebrow marker and `<Highlight>`; buttons and links are
  black/white.
- Layout: `page-container` utility -- max 1280px, side padding fluid from
  16px (375px wide) to 40px. The four existing placeholder pages only had
  their wrapper switched to it so they align with the header.
- Header: black, not sticky; lowercase text wordmark (no logo asset exists)
  linking home; Analysis and Case Studies on the right, which fit on one row
  even at 375px, so there is no collapsed menu. Current section:
  `aria-current="page"` plus a thin yellow underline.
- Footer: black; wordmark, Analysis, Case Studies, LinkedIn, copyright --
  nothing else. LinkedIn renders only when `SITE.linkedinUrl` is set; no
  verified URL exists yet, so it is currently hidden (the previous footer
  linked to the generic linkedin.com homepage).
- Primitives (`components/site/primitives.tsx`): Container, Eyebrow,
  SectionHeading, ButtonLink (primary / secondary / inverse), TextLink
  (optional arrow), Highlight. Links stay links; targets are at least 44px
  in header and footer.
- Base styles scoped to `.site`: visible focus ring (black, white on black
  surfaces), yellow text selection, and prefers-reduced-motion collapsing
  transitions/animations.
- Metadata: site name, description (the positioning line), Open Graph and
  Twitter basics, `en_BD`; public title template. No favicon, logo or OG
  image assets exist, so none were added or invented; `metadataBase` waits
  for the production domain.
- `/` is a clearly temporary review page (to be replaced in Prompt 04B).
- Testing: lint, typecheck, `npm test` (15), production build; browser QA
  at 375 / 768 / 1280 / 1440 on every public route (overflow, one-row
  header, alignment, landmarks, single h1, touch targets, current-page
  marker, Figtree in use, layout shift, keyboard order, focus ring, skip
  link, reduced motion, metadata, /admin isolation, console) -- 179 checks;
  Admin regression via the 03A (49), 03B (112) and 03C (74) suites.

Open: mktbd's LinkedIn URL, a logo/favicon asset, and the production
domain for `metadataBase` are still to be provided.

