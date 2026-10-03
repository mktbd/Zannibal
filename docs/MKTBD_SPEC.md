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
      layout.tsx               Sidebar nav + requireAdmin() guard + logout
      actions.ts                 signOut Server Action
      page.tsx                   Dashboard                   /admin
      analysis/page.tsx          Analysis management         /admin/analysis
      case-studies/page.tsx      Case Study management        /admin/case-studies
      tags/page.tsx              Tag management                /admin/tags
      orders/page.tsx            Order review                  /admin/orders

components/
  layout/
    site-header.tsx          Public header (logo, Analysis, Case Studies)
    site-footer.tsx           Lean public footer

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
                              admin-role check, used by the protected admin
                              layout
  data/
    analysis.ts               getPublishedAnalysisBySlug() — minimal,
                               strongly typed, never exposes drafts
    case-studies.ts            getPublishedCaseStudyBySlug() — same contract
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
