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

**Articles (approved in Stage 5A, public pages built in Stage 5B)** are a
third content format but **not** a primary destination: they are linked
from the **footer only** (never the header), and reached from an Analysis
via its "Read Article" link. Planned routes: `/articles` (library) and
`/articles/[slug]` (reading page). See section 8, "Articles".

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
mega-footer. *(As built from Stage 4F: wordmark + Analysis / Case Studies,
then the official Facebook · LinkedIn · Instagram text links beside the
copyright -- see "As built — Stage 4F" below.)*

### As built (Stage 4B)
Copy and behaviour as implemented in `app/(public)/page.tsx` and
`components/home/*`; where this differs from the brief above, this wins.

- **Hero** (black): H1 "We Break Down How / Bangladeshi Businesses Grow."
  with only "Bangladeshi Businesses" highlighted. The highlighted phrase
  always starts and ends its own line: "We Break Down How / Bangladeshi
  Businesses / Grow." from 768px; on phones "We Break / Down How /
  Bangladeshi / Businesses / Grow." (leading 1.05 below lg, 0.95 from lg).
  The yellow is a band fitted to Figtree's letterforms (`Highlight`), so
  wrapped lines never paint over each other's descenders; lede "mktbd breaks down the
  strategies, decisions and market dynamics shaping businesses in
  Bangladesh."; text link "Explore Analysis →" to `/analysis`. Image slot
  on the right (44% wide from lg, fading leftwards into black; below lg it
  sits under the copy, fading upwards). **Hero image pending:** no approved
  photograph exists. `HERO_IMAGE` (`lib/site.ts`) points at a temporary,
  replacement-ready placeholder, `public/images/hero-placeholder.jpg`: a
  procedurally rendered, out-of-focus market street at dusk (not a real
  photo, not stock, not AI-generated), there only to judge crop, balance,
  fade and contrast. It is captioned "Placeholder image" and its alt text
  starts "Placeholder image:". To replace it, add the approved file to
  `public/images/`, set `HERO_IMAGE = { src, alt }` (no `placeholder`
  flag) and delete the placeholder; `null` falls back to a plain hatched
  panel.
- **Latest Analysis** (off-white): eyebrow "Latest Analysis", heading
  "Fresh Breakdowns.", "View All →" to `/analysis` in the heading row.
  - Query (`lib/data/home.ts`, `getLatestAnalyses(3)`): cookie-less
    anon client (`lib/supabase/public.ts`), so RLS applies exactly as for
    any visitor and the page can be static; `status = 'published'`
    (explicit, in addition to RLS -- a signed-in admin never sees drafts
    here either); ordered `publication_date desc, created_at desc`;
    limit 3. Slides are embedded ordered by `position asc`, limit 1, so the
    cover is the lowest-position slide (`lib/analysis-cover.ts`). On query
    error the section falls back to the empty state (error logged
    server-side).
  - Freshness: `revalidate = 300`, plus the CMS's existing
    `revalidatePath("/")` on every Analysis create/edit/publish/unpublish/
    delete, so changes appear immediately.
  - Card: 9:16 frame, the first slide drawn uncropped (`object-contain` on
    near-black), title over a bottom black gradient; the whole card links
    to `/analysis/[slug]`. No date, tags or excerpt.
  - Missing cover: an Analysis with no slides, or whose image fails to
    load, shows the same frame as a near-black typographic card with its
    title -- no broken-image icon, no layout change.
  - Empty state: "New analysis is on the way."
  - Desktop (lg+): three covers in one row inside the page container,
    each capped at 22rem (352px) wide so the row doesn't dominate; spare
    width goes into the gaps, so the outer covers stay flush with the
    container edges.
  - Mobile/tablet (below lg): native horizontal scroll with
    `scroll-snap-type: x mandatory`, full-bleed, one card (~78% wide; 44%
    from 640px) with the next peeking in. No library, no autoplay, no
    arrows. The only script (`cover-row.tsx`) brings a keyboard-focused
    card fully into view, since browsers leave a partly visible card where
    it is on focus.
- **Premium Case Studies** (black): eyebrow "Premium Case Studies",
  headline "Dive Deeper with Our Premium Case Studies." ("Premium"
  highlighted), copy "Go beyond the carousel with deeper research into the
  strategies, economics and decisions behind businesses in Bangladesh.",
  "Explore Case Studies →" to `/case-studies`. No prices, cards or image.
  Headline left, copy and link right behind a thin divider (stacked below
  lg).
- **Co-Build Your Story** (off-white): eyebrow "Work with mktbd" (the brand
  stays lowercase inside the uppercase label), headline "Have a Story
  Worth Breaking Down?", copy "If your business is building something
  worth understanding, we'd like to hear the story behind it." CTA: the
  text link "Collaborate with us →" to exactly `mailto:collaborate@mktbd.co`
  (`SITE.contactEmail`, the intended production address; the mailbox
  need not be live yet). Same layout, padding and spacing as Premium Case
  Studies, so the two read as equally weighted propositions (same height
  on desktop; content decides height on mobile).
- Metadata: title "mktbd — How Bangladeshi Businesses Grow" (absolute),
  description = the hero lede, matching Open Graph/Twitter title and
  description. No domain, OG image, favicon or social handle.

---

### As built — Stage 4F (public site completion)
A conservative completion pass over the whole public site at
320/375/430/768/1024/1280/1440. The approved 04B–04E page layouts were
audited and kept; only global/shared pieces changed.

- **Audit result**: no horizontal overflow on any public route at any
  tested width (only the intended horizontal scrollers -- the homepage
  Latest Analysis row and the Analysis viewer track -- extend past the
  viewport); one H1 per page; header 64px everywhere; content edges align
  with the header on every page; Analysis routes keep "Analysis" current,
  Case Study detail and purchase routes keep "Case Studies" current.
- **Footer**: wordmark + Analysis / Case Studies, then the official social
  channels as restrained text links -- Facebook · LinkedIn · Instagram --
  beside the copyright (stacked above it on phones). URLs live in
  `SOCIAL_LINKS` in `lib/site.ts`; they open in a new tab with
  `rel="noopener noreferrer"` and an sr-only "(opens in a new tab)". No
  other platforms, no icons, no raw URLs. (`SITE.linkedinUrl` is replaced
  by `SOCIAL_LINKS`.)
- **Site-wide 404** (`app/not-found.tsx`): unmatched URLs previously got
  Next's unstyled default page with no header or footer; they now get the
  public frame with "Page not found" / "This page isn't available." and
  links to Analysis and Case Studies (noindex). Unknown Analysis / Case
  Study slugs keep their own section 404s. Admin `notFound()` cases (e.g.
  an unknown order id) also show this page instead of Next's default; the
  Admin layout itself is unchanged.
- **Public error state** (`app/(public)/error.tsx`): a page whose data
  can't be loaded (e.g. the database is unreachable) previously showed
  Next's default error screen; it now shows "Something went wrong" / "This
  page couldn't be loaded." with Try again and a link home, inside the
  public header/footer -- never a false "not found", never error details.
- **Short pages**: `<main>` now carries the off-white page ground
  (`components/layout/public-shell.tsx`), so 404s and other short pages no
  longer show a white band between the content and the footer.
- **Links**: the shared `TextLink` (Explore Analysis →, View All →,
  Browse … →, Collaborate with us →) now underlines its text only, not the
  arrow -- the treatment "Dive In →" and "Browse Case Studies →" already had.
- **Kept as is (checked)**: header (text wordmark, two links, yellow
  current-page underline, white focus rings), homepage structure and
  mobile Latest Analysis swipe row, Premium intro banner, Co-Build CTA,
  Analysis grid/viewer, Case Studies list/product page, purchase layouts,
  section 404s, empty/no-results/load-failure states.
- **Final 4F refinements**:
  - *Mobile hero*: the copy block's bottom padding is 24px on phones (40px
    on tablets; desktop unchanged) and the image's upward fade is short
    (black -> 10% by 35% of its height), so the image starts right under
    "Explore Analysis" instead of after a band of black. Headline, copy
    and stacking order unchanged.
  - *Latest Analysis on phones*: each card is the row width minus 4rem (at
    most 21rem), so a constant ~64px of the next cover shows at 320-430
    (previously 78%, i.e. 63-89px) -- the swipe cue, still with no arrows,
    dots or library; 9:16 covers, native scroll and snap unchanged.
  - *Analysis viewer (md+)*: the slide area runs from 60px (just below the
    56px counter/close bar) to 16px above the bottom -- a 9:16 slide is
    824px tall at 900px viewport height (was 772px). Slides stay
    `object-contain` (checked with 9:16, 4:5 and 1:1 fixtures); phones keep
    their approved insets.
  - *Site-wide 404*: marks no navigation section current (an unmatched URL
    like `/case-studies/x/y` belongs to no section); the section 404s
    (`/analysis/[slug]`, `/case-studies/[slug]`) keep their section.
- **Pre-launch brand/content TODOs** (accepted; not blocking):
  1. **FINAL MKTBD LOGO ASSET REQUIRED** -- the header/footer keep the
     temporary text wordmark. The supplied logo files were fully opaque
     (a checkerboard painted into the image, not transparency) and were not
     modified or used. Once a genuine transparent PNG/SVG is supplied this
     is a small asset swap in `site-header.tsx` / `site-footer.tsx`.
  2. **FINAL HOMEPAGE HERO IMAGE REQUIRED** -- the hero keeps the temporary
     `public/images/hero-placeholder.jpg`; no layout problems were found
     around it at the tested widths.

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

### As built — Stage 4C
Implemented in `app/(public)/analysis/*`, `components/analysis/*`,
`app/api/analysis/*`, `lib/analysis-archive.ts` and `getArchiveIndex()` /
`getPublishedAnalysisViewer()` in `lib/data/analysis.ts`. Where this differs from the brief above, this wins.

- **Archive (`/analysis`)**: a compact black masthead (eyebrow "Analysis",
  H1 "How Businesses Grow in Bangladesh.", the positioning lede; no image,
  no highlight -- deviation from the brief's image hero, per the 04C
  prompt). The H1 is two phrase groups ("How Businesses" / "Grow in
  Bangladesh.") so narrow screens never strand a word. Below it, on
  off-white: search, topics, then the grid.
- **Grid**: the homepage's cover card (`AnalysisCard`, shared with Latest
  Analysis): first slide uncropped in a 9:16 frame, title over the dark
  gradient, whole card a link, no date/tags/excerpt. 1 column below 600px
  (phones), 2 columns from 600px, 3 from 1024px (each cover capped at
  22rem like the homepage, uniform gaps, flush with the page container).
  600px was chosen from rendered comparisons at 430-600px: below it, two
  columns leave ~190-250px covers whose titles run to 3-4 lines; from 600px
  (~270px covers) titles sit at about two lines. Titles: 20px with a 20px
  inset in one column, 18px/16px at 600-767px, 20px from 768px, 22px from
  1280px; line-height 1.25.
  Order: `publication_date desc, created_at desc, id`.
- **Search**: one labelled search field ("Title or topic"), styled as an
  editorial rule rather than a form box: hairline underline, regular
  weight, magnifier glyph, held to ~36rem; focus turns the rule solid
  black and 2px (no box ring). No submit; filters as you type. Case-, accent- and whitespace-insensitive partial
  matching on title and tag names; every word must match somewhere ("bkash
  mobile" finds the bKash analysis tagged Mobile Money).
- **Topics** (`components/analysis/topic-menu.tsx`): one editorial
  dropdown built to scale with the taxonomy. Closed: the small uppercase
  "TOPICS" label and a text trigger naming the selection ("All topics ↓",
  or e.g. "Mobile Money ↓"; long names truncate) -- no box, pill, fill or
  native `<select>`. Open: a white, square, hairline-bordered panel listing
  "All topics" first, then every topic used by a published Analysis, A-Z;
  the current one has a check mark and semibold weight; one column on
  phones, two from 640px and three from 1024px once the list is long; it
  scrolls inside itself when tall and, on phones, the page scrolls just
  enough to show it whole. Selecting closes it and refreshes the results
  (first batch of 18 of the whole archive); "All topics" clears the
  filter; no Apply step. ARIA select-only combobox: the trigger has
  `aria-haspopup="listbox"`/`aria-expanded`; the listbox (labelled
  "Topics") takes focus and tracks the highlighted option with
  `aria-activedescendant`; ↑/↓, Home/End, type-ahead, Enter/Space select,
  Escape (focus back to the trigger), Tab or a click outside close.
  Combined with search. Tags used only by drafts never appear. No results:
  "No analyses match “…” in <topic>." plus "Clear search and filter".
  Search and topics query the **whole published archive** on the server
  (`/api/analysis`), not just the cards already loaded; typing is
  debounced (250ms). Search/topic state is in-page only (not in the URL)
  and survives opening and closing the viewer.
- **Load More (progressive pagination)**: the page renders the first 18
  analyses (newest first). Below the grid, "Showing 18 of N analyses" and a
  text control "Load More Analysis ↓" fetch and append the next 18 of the
  current results (unfiltered, searched or topic-filtered) in place -- no
  navigation, no numbered pages, never triggered by scrolling (the footer
  stays reachable). When everything is shown the control disappears; if it
  had keyboard focus, focus moves to the first card of the final batch.
  While loading it reads "Loading…" and ignores further clicks; a failed
  batch keeps the cards and offers the control again. 18 suits the 1/2/3-
  column grid (whole rows).
- **Race safety**: each search/topic request carries a generation number
  and an AbortController; a newer search, topic or "All" aborts older
  requests and any response that no longer matches the filters on screen
  is dropped. Load More is bound to the generation it started in (a topic
  change mid-load discards the stale batch) and batches are de-duplicated
  by id, so fast typing, topic switching and repeated clicks can't produce
  stale, duplicated or reordered cards. A new search keeps the previous
  cards visible, dimmed, until its results arrive.
- **Viewer**: a native modal `<dialog>` over the archive (archive kept in
  place, page scroll locked without layout shift), near-black backdrop.
  Slides are the original uploads (`next/image` unoptimized) drawn whole
  with `object-fit: contain` in the space left by the controls; no caption
  or metadata. Framing: on desktop the slide sits within deliberate margins
  (80px above, 48px below, side gutters holding the arrows -- ~86% of the
  viewport height); on phones it spans the width minus the page gutter,
  with the counter and × aligned to its edges. Top bar: "3 / 8" counter and × close (44px). From 768px,
  previous/next arrows in the side gutters (never over the artwork),
  hidden and disabled at the first/last slide -- not infinite. Keys:
  ←/→ anywhere while open, Escape closes. A click outside the artwork
  (backdrop or the letterbox beside a contained slide) closes; clicks on
  the slide or controls don't. Focus moves into the dialog, Tab stays in
  it, and on close returns to the card that opened it. A missing slide
  shows "This slide couldn’t be loaded."; an Analysis without slides says
  it has none. Neighbouring slides load eagerly, the rest lazily.
- **Mobile**: slides sit in a full-width horizontal CSS scroll-snap track
  (the gutter is applied inside each slide), so swiping
  is the browser's own (momentum, one slide per snap); vertical gestures
  can't change slide (`touch-action: pan-x pinch-zoom`); no arrows below
  768px; full-width slides below the top bar, respecting safe-area insets
  and the dynamic viewport height.
- **URL / history**: a card click calls `history.pushState` to
  `/analysis/[slug]` (Next syncs `usePathname`; no navigation, fetch or
  reload) and the viewer follows the path. Close after opening from the
  archive = `history.back()`, so Back closes and Forward reopens. A
  direct visit/refresh/shared link renders `/analysis/[slug]` on the
  server -- the archive's first batch with that viewer open and its slides
  already loaded (it works for an Analysis far beyond the first batch);
  closing it `replaceState`s to `/analysis` and focus goes to the results
  (or to its card if that card is loaded). Ctrl/Cmd/middle-click still opens the
  slug page in a new tab. Unknown or unpublished slugs: a public 404
  ("This analysis isn’t available.") inside the site shell; nothing about
  drafts is rendered or put in metadata.
- **Data / payload architecture** (all reads with the cookie-less anon
  client, `lib/supabase/public.ts`: RLS returns only published analyses,
  their slides and their tags, plus an explicit `status = 'published'`
  filter; no service role, no client-side Supabase query, no secret in
  the browser):
  - *Archive index* (`getArchiveIndex()`, server only): one query for
    every published Analysis with title, slug, tags and **only its first
    slide** (`limit 1` on the embedded slides, lowest position). Never sent
    to the browser as a whole; read fresh per request (no cross-request
    cache, so search and paging always match the CMS).
  - *Page payload*: the first 18 cards (id, title, slug, cover URL) plus
    the topic list. No tags per card, no slide lists, nothing beyond the
    first batch (≈75 KB HTML with 43 published analyses).
  - *`GET /api/analysis?q=&topic=&offset=`*: filters the index on the
    server with the same normalization as before (case/accent/whitespace-
    insensitive, every word in title or tag names) and returns one batch
    of cards plus the total match count. Parameters are validated (query
    capped at 100 chars, topic must be a UUID, offset bounded); responses
    are `no-store`.
  - *`GET /api/analysis/[slug]`*: one published Analysis's ordered slide
    URLs, fetched when its viewer is first opened from the archive and
    kept for reopening. Slug validated against the slug format before
    querying; unknown and unpublished are the same 404; a database error
    is a 503, never a false 404.
  - Viewer loading is unchanged once slides arrive: current slide and
    neighbours eager, the rest lazy; covers are resized by next/image.
    Archive cards don't prefetch their slug routes.
  - Why search runs in Node rather than SQL: matching accent-insensitively
    across title *and* tag names in PostgREST would need the `unaccent`
    extension (a migration); filtering the lightweight index on the server
    keeps the exact normalization with no schema change. Revisit with a
    search index if the archive reaches many thousands of analyses.
- **Rendering / freshness**: `/analysis` is static, `/analysis/[slug]` is
  ISR on first request (`generateStaticParams` returns `[]`); both
  revalidate every 5 minutes and immediately through the existing CMS
  actions (`revalidatePath("/analysis")` and `("/analysis/[slug]",
  "page")`). Tag renames in the Tags screen don't revalidate public pages
  (that CMS action only refreshes Admin paths), so they appear within 5
  minutes.
- **States**: no published analyses -> "New analysis is on the way." (no
  search UI); index failure -> "The analysis archive couldn’t be loaded
  right now…"; search/topic request failure -> "Results couldn’t be loaded
  right now." + Try again; Load More failure -> inline message, control
  stays; viewer slide-fetch failure or an Analysis unpublished meanwhile ->
  a message inside the open viewer; missing/no-slide covers -> the
  near-black typographic card.
- **Metadata**: `/analysis` -> "Analysis | mktbd" + the lede as
  description. `/analysis/[slug]` -> "<title> | mktbd", the same lede as
  description (the schema has no per-Analysis description), and the first
  slide as Open Graph/Twitter image (`summary_large_image`; `summary` when
  there are no slides). No author, dates, canonical or invented domain.
  Unknown slugs get "Analysis not found" + noindex.
- **Accessibility**: labelled search, `role="search"`, topic group with
  `aria-pressed`, live result count, one H1, cards are links (Enter
  opens), modal dialog labelled with the Analysis title, named controls,
  slide alt "Slide 3 of 8 — “<title>”", live "Slide n of m", white focus
  rings in the viewer, reduced motion = no fade and instant slide changes,
  topic buttons >= 44px.

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

### As built — Stage 4D
Implemented in `app/(public)/case-studies/*`, `components/case-studies/*`,
`app/api/case-studies/route.ts`, `lib/case-study-archive.ts` and
`getCaseStudyIndex()` / `getPublishedCaseStudy()` in
`lib/data/case-studies.ts`, on the archive building blocks shared with
Analysis (`components/archive/*`, `lib/archive-core.ts`). Where this
differs from sections 5 and 6 above, this wins.

- **Role**: a premium research catalogue, not a store -- editorial
  restraint, typography and hairline rules; no cards, shadows, badges,
  ratings, carts, author, sales figures or yellow buy buttons.
- **Archive hero (`/case-studies`)**: compact black masthead like
  `/analysis`: eyebrow "Case Studies", H1 "Go Deeper Into How / Businesses
  Grow." (two phrase groups, never a stranded word), lede "Research-led
  case studies examining the strategies, economics and decisions behind
  businesses in Bangladesh." No image, price, CTA, stats or testimonials
  (supersedes the "Deep Dive into Our Case Studies" working copy).
- **Discovery**: the 04C search + Topics dropdown, unchanged in look and
  behaviour (`DiscoveryControls`, `TopicMenu`). Search label "Search case
  studies", placeholder "Title, subject or topic"; case-, accent- and
  whitespace-insensitive partial matching on title, short description and
  tag names (every word must match somewhere); `%` and `_` are literal
  (plain substring matching, no SQL patterns); debounced (250ms), no
  submit; combines with the topic. Topics = tags attached to at least one
  published Case Study, "All topics" first, then A-Z.
- **List** (`ul` of `article` rows, hairline separators -- never a grid):
  cover left (144px tablet / 176px desktop), then a quiet uppercase topic
  line (first two topics A-Z, "+N" for more; wraps to two lines at most), the title (H3), the short description (clamped to 3
  lines, ~62ch), and a meta line: price ("BDT 999", "BDT 1,250.50"),
  publication month ("September 2026") and "Dive In →". "Dive In" is the
  row's single link (accessible name "Dive In: <title>") stretched over the
  whole row, so the entire entry is clickable with one tab stop. Phones
  (below 640px): a small 72px cover with the topic line beside it (up to
  three lines), then the title, description and meta line each at the full
  row width -- long titles are never squeezed into the column beside the
  cover (the Chattogram fixture: 5 lines at 375px instead of 8). Phone
  titles use `text-wrap: pretty` (fills the width, no orphans); balanced
  wrapping from 640px. Tablet/desktop composition unchanged.
- **Covers**: portrait 3:4 frame (the CMS format), drawn whole
  (`object-contain`; other shapes sit on a light-grey mat), fixed frame so
  no layout shift, alt "Cover of “<title>”". Missing or failing covers
  (no path, dead path, load error) become a near-black editorial panel
  with a "Case Study" label and the title -- never a broken-image icon.
- **Progressive loading**: the page renders the first 12 (newest first:
  `publication_date desc, created_at desc, id`); "Load More Case Studies ↓"
  with "Showing 12 of 31 case studies" appends the next 12 from
  `/api/case-studies`; the control disappears once everything is shown;
  no infinite scroll, no page numbers. Search and topics query the whole
  published catalogue on the server and restart at the first 12. Same
  race-safety as Analysis (`useArchiveFeed`): abort + generation counter
  drop stale responses, Load More ignores repeat clicks while loading,
  batches are de-duplicated by id and keep server order; when the last
  batch removes a focused Load More, focus moves to the first new row.
- **States**: no published Case Studies -> "New case studies are in
  preparation."; catalogue read failure -> a calm error message; no
  matches -> "No case studies match “…” in <topic>." + "Clear search and
  filter"; search/topic request failure -> message + "Try again"; Load
  More failure -> inline message, button stays.
- **Product page (`/case-studies/[slug]`)**: "← Case Studies" back link;
  desktop: cover left (26-28rem column), right: eyebrow "Case Study", H1
  title (fluid size that steps down for unusually long titles: up to 60
  characters 30-48px; 61-100 characters 28-40px; over 100 characters
  26-34px -- normal titles keep the full scale, very long ones stay strong
  without dominating the column), the short description as descriptor, price, "Buy Case Study"
  CTA, then metadata (Industry, Pages, Publication Date as "September
  2026", Format "PDF"; Industry/Pages omitted if ever empty -- nothing
  invented: no reading time, language or author). Below, aligned with the
  text column: **Product Description** and **Related Topics**. Phones
  stack in reading order: cover, Case Study, title, descriptor, price,
  CTA, metadata, description, related topics. Metadata stays a 2x2 grid
  (Industry | Pages / Publication Date | Format) at every width, down to
  320px; labels and values wrap within their cell.
- **Buy CTA (non-transactional until Stage 4E)**: a visually final black
  button "Buy Case Study" with no visible "coming soon" copy
  (`aria-disabled="true"`, stays focusable, `aria-describedby` a visually
  hidden "Not available yet." so assistive tech announces the state).
  It has no handler, sits in no form and makes no request: no order, no
  checkout, no bKash instructions, no navigation. **Stage 4E connects it
  to the manual bKash purchase flow (section 7).**
- **Product Description**: stored plain text rendered as React text
  (never HTML); blank lines separate paragraphs (CRLF normalised), single
  line breaks are kept; ~65ch measure, 17px / 1.7.
- **Related Topics**: the Case Study's tags A-Z as plain, non-linked
  metadata. Decision: the catalogue's topic filter lives in page state
  with no URL parameter, so there is no clean link target; linking would
  have meant adding URL-driven filter state to the shared 04C archive.
  Revisit if the archive ever gains `?topic=`.
- **Never on the product page**: reviews, ratings, quantity, cart,
  previews, related products, downloads.
- **Direct links / 404**: rendered on first request and cached (ISR,
  `revalidate = 300`; CMS actions already revalidate "/case-studies",
  "/case-studies/[slug]" and "/"). Unknown, malformed, draft and deleted
  slugs all get the same public 404 ("This case study isn’t available." +
  "Browse all case studies →", noindex) -- the query filters
  `status = 'published'` with the public client, so nothing about a draft
  is ever read. A database error is an error page, not a false 404.
- **Metadata**: `/case-studies` -> "Case Studies | mktbd" + the lede.
  `/case-studies/[slug]` -> "<title> | mktbd", the short description (lede
  as fallback) and the cover as Open Graph/Twitter image
  (`summary_large_image`; `summary` without a cover). No canonical,
  domain or invented OG image; unknown slugs "Case study not found" +
  noindex.
- **Data & security**: cookie-less anon client (`createPublicClient`),
  RLS-governed -- published Case Studies and only the tags attached to
  them; orders never queried; no service role; explicit
  `status = 'published'` filters as defence in depth. The catalogue index
  selects list fields only (no product description, industry or page
  count); list rows sent to the browser carry no tag ids. The feed API is
  GET-only, `no-store`, validates `q` (<= 100 chars), `topic` (UUID) and
  `offset`. No public mutation anywhere.
- **Performance**: `/case-studies` is static (ISR) with the first batch in
  the HTML -- no client fetch on load; `getPublishedCaseStudy` is React
  `cache()`-shared by `generateMetadata` and the page (one read); only
  the first cover is preloaded, the rest lazy; covers sized per
  breakpoint; "Dive In" links don't prefetch.
- **Accessibility**: one H1 per page, logical H2/H3, `role="search"` with
  a labelled field, the 04C listbox Topics dropdown, live result count,
  semantic list, visible focus rings, Dive In accessible names, alt text,
  readable `dl` metadata, touch targets >= 44px, reduced motion honoured.

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

### As built — Stage 4E
Implemented in `app/(public)/case-studies/[slug]/buy/page.tsx`,
`components/case-studies/purchase-flow.tsx`, `app/api/orders/route.ts`,
`lib/order-input.ts`, `lib/payment.ts` and `lib/data/orders.ts`, on the
existing `orders` schema (migration 7) -- no migration, RLS or policy
change. Where this differs from the text above, this wins; it supersedes
the 4D note that the Buy CTA is non-transactional.

- **Model**: a manual bKash pilot. No payment gateway, automatic
  verification, automatic fulfilment, PDF download, email automation,
  customer account, cart, coupon or invoice. The customer sends money with
  bKash, submits the payment details and gets an order number; an admin
  verifies the payment, marks the order Fulfilled or Invalid, and emails
  the PDF outside the website.
- **Route**: "Buy Case Study" on `/case-studies/[slug]` is a link to
  `/case-studies/[slug]/buy` (directly linkable, predictable refresh/back,
  no modal). The purchase page is rendered per request (`force-dynamic`)
  so the price and payment number are always current, is `noindex`, and
  404s exactly like the product page for unknown, draft or deleted slugs.
- **Purchase page**: "← Case Study" back link; the product (cover, "Case
  Study", title as H1, trusted price) -- compact above the steps on
  phones/tablets, a sticky left column on desktop; then **1 Pay with
  bKash** (four short steps: Send Money, send exactly <price> to the
  number, keep the Transaction ID, submit below; plus "Never share your
  bKash PIN or OTP. mktbd will never ask for them") and **2 Submit Your
  Details** (the form; CTA "Submit Payment Details" / "Submitting…",
  with "Your payment will be manually verified before the Case Study is
  sent to your email." beneath it). Editorial: Figtree, monochrome, hairline rules,
  one yellow marker; no cart summary, quantity, badges, logos or timers.
- **Payment number**: server-only `BKASH_PAYMENT_NUMBER` (in
  `.env.example` without a value), validated with the same Bangladesh
  mobile rule as the form and shown as "01XXX XXXXXX". It is public
  information on the page, but rendered server-side rather than
  `NEXT_PUBLIC_`, so it can change without a rebuild and the page and
  endpoint always agree. Unset/invalid -> the page says "Online ordering
  is paused at the moment" (no form) and the endpoint answers 503.
- **Form** (labels always visible, hints, all four required): Full name
  (`autocomplete=name`), Email (`type=email`), bKash number (`type=tel`),
  bKash Transaction ID (`autocomplete=off`, no autocorrect). Nothing else
  -- never PIN, OTP, password, address, NID or card details. Validation
  (`lib/order-input.ts`, shared by the form and the server): name trimmed,
  inner whitespace collapsed, at least two letters, <= 120 chars; email a
  plain `name@domain.tld` shape, <= 254; bKash number accepts
  `01712345678`, `01712-345678`, `+880 1712 345678`, `8801...` and Bangla
  digits, normalised to `01XXXXXXXXX` with an 013-019 prefix (not proof
  of a bKash account); Transaction ID trimmed, letters/digits 6-30,
  stored as entered (not checked against bKash). Inline errors on blur
  and submit, associated with fields (`aria-describedby`,
  `aria-invalid`), focus moves to the first invalid field.
- **Trust boundary (`POST /api/orders`)**: same-origin JSON only (403 for
  a foreign `Origin`, 415 for other content types, 413 over 4 KB, 400 for
  malformed JSON); the body must be exactly `{slug, expectedPriceBdt,
  customerName, email, bkashNumber, transactionNumber}` -- any other key
  (status, price, title, order number, ids) is rejected. The server
  validates the fields, re-reads the Case Study with the anon client (RLS
  -> published only), and creates the order with the service-role client:
  `case_study_id`, `case_study_title_snapshot` and `price_bdt_snapshot`
  from that read, the normalised customer fields, `status = 'pending'`;
  `order_number` (`MKT-YYYY-NNNNNN`, sequence), `submitted_at` and
  `updated_at` come from the database. `expectedPriceBdt` is only
  compared: if the trusted price changed since the page loaded, nothing is
  created and the customer is told the new price (409), so the amount
  paid always matches the order. Draft/deleted/unknown -> 404, nothing
  created (a deletion racing the insert is caught by the foreign key).
  The response is only `{orderNumber, caseStudyTitle, priceBdt, status}`.
- **Snapshots**: renaming, repricing, unpublishing or deleting a Case
  Study never changes an existing order; deletion sets `case_study_id` to
  NULL (existing `ON DELETE SET NULL`) and the snapshot stays (tested).
- **Duplicates**: the form ignores repeat submits while a request is in
  flight; identical requests arriving together share one insert in the
  server instance; the same Transaction ID on a still-**Pending** order for
  the same Case Study and email returns that order (a resubmission, e.g.
  after a network drop), while every other reuse -- a different Case Study
  or email, or an order already Fulfilled or Invalid -- is rejected on the
  field with the duplicate-Transaction-ID message, revealing nothing about
  the existing order (`lib/order-reuse.ts`). Separate purchases with the same email or
  bKash number are allowed.
- **Transaction ID review (04E refinement + final correction)**:
  - *Current rule*: the application treats a bKash Transaction ID as
    globally unique, compared case-insensitively, across orders of every
    status (Pending, Fulfilled and Invalid). Reusing it for a different
    Case Study, a different email or a different customer is rejected;
    only an exact repeat (same Transaction ID + same Case Study + same
    email) of an order that is **still Pending** is treated as a
    resubmission and returns the original order. Once an order is
    Fulfilled or Invalid, even an exact repeat is rejected (409
    `{"error":"duplicate_transaction"}` only -- no order number, status,
    Case Study or customer data).
  - *Enforcement*: application code only (`lib/data/orders.ts`: lookup,
    then insert). The database has no unique constraint or index on
    `bkash_transaction_number` (migration 7).
  - *Remaining race*: the lookup and the insert are separate steps, so
    two requests carrying the same Transaction ID that both pass the
    lookup before either inserts can create two orders. The in-memory
    guard only merges identical requests (same Case Study, Transaction
    ID and email) inside one server instance; it does not cover
    different server instances, or a different email/Case Study with the
    same Transaction ID even on one instance.
  - *Is global uniqueness right for V1?* Yes. Each bKash payment has one
    system-generated Transaction ID, and V1 is one Case Study per order
    paid with one Send Money of exactly its price, so one Transaction ID
    should verify at most one order. Accepting the same ID twice would
    let one payment unlock two orders. Edge cases are handled manually:
    a customer who paid once for two Case Studies, or whose ID was
    mistakenly claimed by someone else's submission, contacts mktbd, and
    the admin resolves it.
  - **PRE-PRODUCTION HARDENING / LAUNCH BLOCKER (needs an explicitly
    approved future migration; not created)**: a migration adding a unique index such as
    `create unique index orders_bkash_transaction_number_key on
    public.orders (upper(btrim(bkash_transaction_number)));` (production
    has no orders, so no existing data conflicts), with the endpoint
    mapping a unique violation (23505) to the same resubmission /
    duplicate handling.
  - *Fixed in the final 04E correction*: a repeat that matched an order
    already Fulfilled or Invalid used to return that order with a
    "Pending verification" confirmation; it is now rejected like any
    other reuse.
- **Confirmation**: replaces the steps in place: "Order Received", "Thank
  you. Your order details have been received.", order number, Case Study,
  amount, "Pending verification", and "We've received your order details.
  Your payment will be manually verified before the Case Study is sent to
  your email." -- never "payment successful"; no turnaround promise; no
  email, bKash number or Transaction ID echoed. Focus moves to the heading.
  There is **no public order lookup**: the confirmation (order number,
  title, amount only) is kept in this tab's `sessionStorage` for 2 hours,
  so a reload or Back/Forward shows it again instead of an empty form.
  Its only exit is "Browse Case Studies →" (no "submit another payment"
  action); within those 2 hours the same tab shows the confirmation for
  that Case Study's purchase page, while a new tab shows the form. Other
  tabs/devices can't see it, and no URL carries order data.
- **Errors**: field messages never echo input; price changed (reload
  link), Case Study no longer available (no order, link to Case Studies,
  contact address), ordering unavailable, server failure ("couldn't be
  submitted"), network failure ("sending the same details again won't
  create a second order"). No database, table, SQL or credential details
  reach the browser; server logs record only error codes, never submitted
  values.
- **Admin**: unchanged from Stage 3C -- the Orders queue/detail already
  show order number, Dhaka timestamp, title/price snapshots, name, email,
  bKash number, Transaction ID and status, and the only mutation is the
  admin-only conditional status change (Pending -> Fulfilled/Invalid);
  no delete. Verified end to end with orders created through the new flow.
- **Security**: public users cannot list, fetch, update or delete orders
  or choose status/price/title (RLS has no anon policies on `orders`; the
  endpoint is POST-only and creates Pending orders only). The service-role
  key is used only in `lib/data/orders.ts` (server-only), never in client
  bundles (checked).
- **Rate limiting**: none in V1. A per-instance in-memory limiter would
  be weak on serverless hosting and real limiting needs shared state
  (e.g. Vercel WAF/rate-limit rules or a KV store). **Launch TODO:**
  configure platform rate limiting for `POST /api/orders`. No CAPTCHA.
- **Responsive / accessibility**: tested at 320-1440; one H1, h2 steps,
  ordered instructions read in order, visible labels and hints, 48px
  inputs and button, live "Submitting..." status, `aria-busy`, focus
  management, no colour-only errors, reduced motion honoured.
- **Deferred**: payment gateway, automatic verification, emails
  (confirmation or fulfilment), PDF delivery, customer accounts, order
  lookup, refunds, rate limiting (above).

---

## 8. Admin / CMS

We are building our own lightweight CMS. **Do not** integrate Sanity,
WordPress, Contentful, Strapi, or any other external CMS.

Admin route: `/admin`. Deliberately small — no WYSIWYG page builder, no
complex editorial workflows, no multiple permission levels, no analytics
dashboards, no newsletter systems, no media-library product, no revision
comparison, no scheduled publishing.

Primary Admin areas: **Dashboard, Analysis, Articles, Case Studies, Tags,
Orders.**

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

**Linked Article (Stage 5A):** a "Read Article" toggle plus an Article
selector (shown when the toggle is on; drafts can be selected). See
"Articles" below for the rules.

### Case Study Content Model
Fields: Title, Slug, Cover Image, Short Description, Product Description,
Price (BDT), Industry, Tags, Page Count, Publication Date, Format (PDF for
V1), Status (Draft/Published).

**Do not** upload/store the paid PDF in the public CMS in V1 — fulfilment
is manual.

Actions: Create, Edit, Preview, Publish, Unpublish, Delete. Deleting a
Case Study must **never** delete or corrupt historical Orders.

### Tags
One centralized, reusable tag reservoir shared between Analysis, Articles
and Case Studies. Editors can view, create, rename, and select existing tags (with
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

### Articles (Stage 5A — database + CMS; public pages in 5B)

Articles are **free, written business analysis**: the long-form companion
to a visual Analysis, or a standalone piece. Same lifecycle as the other
content (Draft/Published, Create, Edit, Preview, Publish, Unpublish, Delete
with confirmation).

**Content model** (`public.articles`, migration
`20261008000010_articles.sql`, applied to production 2026-10-08):

| Field | Column | Rules |
|---|---|---|
| Title | `title` | required, ≤ 200 |
| Slug | `slug` | auto from title, editable, unique among Articles (`articles_slug_key`), URL-safe (`articles_slug_format`); an Article may reuse an Analysis/Case Study slug (separate URL space) |
| Short Description | `short_description` | optional, ≤ 300 (listings, search/meta description) |
| Cover | `cover_image_path` | optional, landscape (about 16:9), `editorial-media` |
| Body | `body` (`jsonb`) | rich text as a structured ProseMirror/Tiptap JSON document — **never HTML** |
| Publication Date | `publication_date` | required, defaults to today (Dhaka) |
| Status | `status` (`content_status`) | Draft/Published |
| Tags | `article_tags` | shared reservoir, same selector + inline creation as Analysis |
| — | `created_at`, `updated_at` | timestamps (`set_updated_at` trigger) |

Publishing requires title, slug, date and body text (a cover is optional).
A published Article can't be emptied — unpublish it first.

**Rich text** — editor: Tiptap 3 (headless ProseMirror), pinned
`@tiptap/{pm,react,starter-kit}@3.31.4`. Allowed, and only allowed:
paragraphs, H2, H3, bold, italic, bulleted and numbered lists, block
quotes, links (citations are links), line breaks, and inline images with
alt text and an optional caption. No H1 (the page title is the H1), no
code, tables, colours, fonts, alignment, embeds or raw HTML — it's a
writing tool, not a page builder. Pasting from Word/Google Docs/the web is
supported: the paste is parsed through the same schema, so formatting
outside the allow-list is dropped and its text kept (H1/H4 become
paragraphs, scripts/iframes/foreign images/styles disappear, unsafe links
lose the link but keep the text). Links: toolbar link box (accepts
`https://…`, a bare domain, or an email address → `mailto:`), opened in a
new tab with `rel="noopener noreferrer"` when rendered.

**Validation and rendering** (`lib/article-body.ts`,
`components/articles/article-body.tsx`): every save rebuilds the body
server-side from an allow-list (node types, marks, attributes); anything
else — an unknown node/mark, a `javascript:`/`data:`/relative link, an
image path that isn't one of this Article's uploads, > 900 KB, > 100
images, > 16 levels deep — rejects the save with a message (never silently
"fixed"). The renderer maps each node to a fixed React element and never
uses `dangerouslySetInnerHTML`; stored bodies are re-validated before
rendering, so even a row written directly through the API renders safely
(invalid → empty). Reading typography is shared by the editor and the
renderer (`.article-body` in `app/globals.css`).

**Analysis ↔ Article relationship (one-to-one, edited on the Analysis):**
- Stored **once**, as one row in `analysis_article_links`
  (`analysis_id` primary key → `analyses`, `article_id` `UNIQUE` →
  `articles`, both `ON DELETE CASCADE`, plus `read_article_enabled`, the
  toggle). There are no link columns on `analyses` or `articles`; each side
  finds the other through that row (PostgREST embeds
  `analysis_article_links(article_id, …)` /
  `analysis_article_links(…, analyses(…))`), so the two sides can never
  disagree.
- **Why a separate table:** a column on `analyses` would be readable
  wherever the Analysis is public, exposing a draft Article's id or a link
  the editor switched off. On its own table, RLS decides per link: the
  public sees a link row **only** when `read_article_enabled` is true and
  the Analysis and the Article are both published; admins see all rows.
  Nothing is filtered in the browser.
- Primary key = an Analysis has at most one Article; `UNIQUE (article_id)`
  = an Article belongs to at most one Analysis (V1). The Analysis
  editor disables Articles already linked elsewhere and the server refuses
  them (pre-check + constraint).
- The selected Article may be a draft. Toggle **off** keeps the
  association but hides the links.
- **Public links** ("Read Article" on the Analysis viewer, "See Visual
  Story →" on the Article page) show only when the toggle is on, an Article
  is linked, **and both records are published** (`isArticleLinkVisible`,
  `lib/article-links.ts`) — the same rule the link table's RLS policy
  enforces for public reads.
- **Unpublish** either side → the link row becomes invisible to the
  public (nothing is changed or deleted). **Delete an Article** → its tag
  links and its link row cascade, its Storage folder is emptied, and the
  Analysis stays, now without a linked Article. **Delete an Analysis** →
  its link row cascades; the Article is untouched.
- The Article editor shows the linked Analysis read-only; the link is
  edited only on the Analysis.

**Media:** existing `editorial-media` bucket (public read by URL,
admin-only writes and listing, 5 MB, JPEG/PNG/WebP — no PDFs) under
`articles/{article_id}/cover-{uuid}.ext` and
`articles/{article_id}/image-{uuid}.ext`. Cover and images are added after
the first save (they need the Article's id). Cleanup rules
(`lib/media-cleanup.ts`, `saveArticle`/`deleteArticle`):
- objects are deleted only **after** the database write succeeded; any
  failed step returns before cleanup, so a failed save deletes nothing;
- the keep-set is what this save wrote **plus** what the row references
  when re-read after the write; if that re-read fails, cleanup is skipped;
- a cover/image this save replaced or removed is deleted at once; an
  upload that was never saved is kept for an hour (it may belong to
  another tab or session) and swept by a later save;
- only `articles/{this id}/cover-…`/`image-…` names are ever deleted.
  Bodies and covers can only reference their own Article's folder
  (validated on save), and Analysis/Case Study media live under other
  prefixes, so media used by another record can't be reached;
- a failed Storage delete leaves the saved Article intact; the editor shows
  "could not be deleted from storage" and a later save retries.

**CMS:** `/admin/articles` (search + status filter, linked Analysis shown),
`/admin/articles/new`, `/admin/articles/[id]/edit` (Save draft · Publish /
Update · Unpublish, Preview, Delete with confirmation), and
`/admin/articles/[id]/preview` — admin-only (`requireAdmin()` + RLS),
`noindex`, laid out like the planned public reading page. Dashboard shows
Article counts; the Tags screen counts Article usage and refuses to delete
a tag an Article uses.

#### Public Articles — as built (Stage 5B)

- **Routes:** `/articles` (archive, static + ISR 5 min) and
  `/articles/[slug]` (reading page, ISR on first request). Published
  Articles only; unknown, draft and malformed slugs get the public 404
  ("This article isn’t available."). Reads use the cookie-less anonymous
  client (`lib/data/articles.ts`), so RLS decides what is visible.
- **Navigation:** "Articles" in the **footer** (`FOOTER_NAV`); the header
  is unchanged (logo · Analysis · Case Studies).
- **Archive:** compact black masthead (same language as /analysis and
  /case-studies; heading "The Business Behind the Headlines.", description
  "In-depth analysis of the strategies, decisions and market dynamics
  shaping businesses in Bangladesh."), then the newest
  Article **featured** in a wide frame — 16:10 cover on phones/tablets,
  3:2 beside the text on desktop; eyebrow "Latest Article", headline,
  optional short description, date and "Read Article →", the whole
  feature one link, type on paper (no overlay). Below, "More Articles": the
  rest in a grid of **2 columns on phones, 3 on tablets (≥768px), 4 on
  desktop (≥1024px)**; each card a **4:3** landscape cover (cropped
  `object-cover`; a near-black panel with a small "Article" mark when there
  is no cover), then title and date below the image. The featured Article
  is never repeated. Order: `publication_date desc, created_at desc, id`.
  Cards never carry the body. Empty state: "The first articles are being
  written. Check back soon." No search or topic filter in V1 (the archive
  is small and the brief asked for none unless justified; tags show on the
  reading page).
- **Reading page:** "← Articles" back link, topics (tags), title (the only
  H1, ~30px on phones up to ~52px), optional standfirst, date, optional
  16:9 cover (wider than the text column), then the body via
  `ArticleBody` in a ≈44rem column (17px → 19px type, 1.75 leading).
  Inline images fit the column at their natural ratio, capped at ~80% of
  the viewport height and centred; captions smaller and muted. External
  links open in a new tab (`rel="noopener noreferrer"`) and carry a small
  ↗ marker plus a screen-reader note; mailto links don't. Then **"See
  Visual Story →"** (only when the link is switched on and both are
  published) and "Back to all articles".
- **Analysis viewer:** **"Read Article →"** — small, muted white-on-black
  link centred under the slides, only when the server returned a visible
  link (`getPublishedAnalysisViewer` embeds
  `analysis_article_links(read_article_enabled, articles(slug, title,
  status))`; RLS returns the row only when it may be shown). Never on the
  Analysis archive cards. It disappears as soon as the Article is
  unpublished or deleted or the toggle is turned off (the viewer API is
  uncached; the CMS revalidates the ISR pages).
- **Revalidation:** Article saves/deletes revalidate `/articles`,
  `/articles/[slug]` and `/analysis/[slug]`; Analysis saves also revalidate
  `/articles/[slug]` (its "See Visual Story" link).
- **Metadata:** title, description (short description, else the archive
  description), Open Graph `article` with published/modified time, tags
  and the cover. Canonical URLs, JSON-LD and the sitemap were added in
  Stage 5C — see section 9, "SEO and AI-search discoverability".

- **Canonical / SEO / AEO:** built in Stage 5C as specified here, with
  two refinements: the Article JSON-LD is `Article` (analysis, not news,
  so not `NewsArticle`), and the Analysis cross-reference uses `relatedLink`
  on the page node. Full description in section 9, "SEO and AI-search
  discoverability".

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
  not-found.tsx            Site-wide 404 for unmatched URLs (public frame)
  (public)/                Route group for the public site (no URL segment)
    layout.tsx              Public shell (PublicShell: header, main, footer)
    error.tsx               Public error state (data couldn't be loaded)
    page.tsx                 Home                        /
    analysis/
      page.tsx                Analysis archive            /analysis
      [slug]/page.tsx          Archive + open viewer       /analysis/[slug]
      [slug]/not-found.tsx     Public 404 for unknown/unpublished slugs
    case-studies/
      page.tsx                Case Studies catalogue      /case-studies
      [slug]/page.tsx          Case Study product page     /case-studies/[slug]
      [slug]/not-found.tsx     Public 404 for unknown/unpublished slugs
      [slug]/buy/page.tsx      Manual bKash purchase page  /case-studies/[slug]/buy
    articles/
      page.tsx                Articles archive            /articles
      [slug]/page.tsx          Article reading page        /articles/[slug]
      [slug]/not-found.tsx     Public 404 for unknown/unpublished slugs
  api/
    analysis/route.ts          Archive feed: search/topic/offset -> 18 cards
    analysis/[slug]/route.ts   One published Analysis's ordered slides
    case-studies/route.ts      Catalogue feed: search/topic/offset -> 12 rows
    orders/route.ts            POST only: record a Pending order (Stage 4E)
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
      articles/                  Articles CMS (Stage 5A)     /admin/articles
        page.tsx, new/, [id]/edit/, [id]/preview/   (same shape as analysis/)
        actions.ts                 saveArticle / deleteArticle
        article-editor.tsx         Client editor form (+ read-only Linked Analysis)
        body-editor.tsx            Tiptap rich-text body + toolbar, link box, image upload
        figure-node.tsx            Inline image node (path, alt, caption)
      case-studies/              Case Studies CMS            /admin/case-studies
        page.tsx, new/, [id]/edit/, [id]/preview/   (same shape as analysis/)
        actions.ts                 saveCaseStudy / deleteCaseStudy
        case-study-editor.tsx      Client editor form
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
    site-footer.tsx           Lean public footer (black): wordmark, nav,
                              Facebook · LinkedIn · Instagram, copyright
    public-shell.tsx          Skip link + header + <main> + footer frame
  site/
    primitives.tsx            Container, Eyebrow, SectionHeading, ButtonLink,
                              TextLink, Highlight
  home/                      Homepage sections (Stage 4B)
    hero.tsx                  Brand hero + image slot / placeholder
    latest-analysis.tsx        Latest three published Analyses
    cover-row.tsx              Client scroller: keyboard focus reveal
    premium-case-studies.tsx   Case Studies introduction
    co-build.tsx               Co-Build invitation (mailto when email set)
  analysis/                  Public Analysis (Stage 4C; card/cover shared
                              with the homepage)
    analysis-card.tsx          Cover card (first slide, title, link)
    analysis-cover.tsx         Client cover image with typographic fallback
    analysis-hero.tsx          /analysis masthead + description constant
    analysis-archive.tsx       Client: search, topics, grid, URL-driven viewer
    analysis-viewer.tsx        Client: modal carousel (dialog, scroll-snap)
  archive/                   Shared by the Analysis and Case Studies
                              archives (Stage 4D refactor of 04C code)
    use-archive-feed.ts        Client hook: debounced search, topic, Load
                                More, race-safe feed state
    discovery-controls.tsx     Search field + Topics row
    topic-menu.tsx             Client: Topics dropdown (single-select listbox)
    results-states.tsx         Error / no-results / Load More blocks
  case-studies/              Public Case Studies (Stage 4D)
    case-study-hero.tsx        /case-studies masthead + description constant
    case-study-catalogue.tsx   Client: search, topics, list, Load More
    case-study-row.tsx         One catalogue row (cover, topics, title,
                                description, price, date, Dive In)
    case-study-cover.tsx       Client 3:4 cover with editorial fallback
    case-study-product.tsx     Product page body (cover, CTA, metadata,
                                description, related topics)
    purchase-flow.tsx          Client: purchase form, submission, errors,
                                confirmation (Stage 4E)
  articles/
    article-body.tsx           Validated Article JSON -> React elements (no
                                HTML injection); admin preview + public page
    articles-hero.tsx          /articles masthead + description constant
    featured-article.tsx       Latest Article in the wide featured frame
    article-card.tsx           Library card: 4:3 cover, title, date
    article-cover.tsx          Client landscape cover with editorial fallback
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
    cover-uploader.tsx         Single cover upload/replace/remove (portrait
                                Case Study / landscape Article frame)

lib/
  supabase/
    client.ts                Browser Supabase client (anon key)
    server.ts                Server Supabase client (anon key, cookie-based
                              auth, for Server Components/Actions)
    admin.ts                  Privileged server-only client (service-role
                              key) — bypasses RLS, must never reach the
                              browser; used only by lib/data/orders.ts to
                              record Pending orders (Stage 4E)
    public.ts                 Cookie-less anon client for public reads
                              (RLS-scoped; lets public pages stay static)
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
  article-body.ts            Article body allow-list validator (Tiptap JSON),
                              link/image rules, size limits (Stage 5A)
  article-archive.ts         Public Articles helpers: cards, featured split,
                              visible Analysis <-> Article link (Stage 5B)
  article-links.ts           isArticleLinkVisible: Read Article / See Visual
                              Story rule (toggle + linked + both published)
  format.ts                  Date, month-year, Dhaka date-time and BDT
                              formatting
  site.ts                    Public identity: name, tagline, primary nav,
                              official SOCIAL_LINKS, contact email,
                              HERO_IMAGE (temporary placeholder)
  analysis-cover.ts          coverSlidePath(): lowest-position slide
  archive-core.ts            Shared pure archive helpers: normalisation,
                              word matching, topic list, paging, de-dup,
                              feed-parameter and slug validation
  analysis-archive.ts        Analysis archive helpers on archive-core:
                              row mapping, filtering, paging (18)
  case-study-archive.ts      Case Study catalogue helpers on archive-core:
                              row mapping, filtering (title, description,
                              tags), paging (12), description paragraphs
  orders.ts                  Order status enum, labels, search columns
  order-input.ts             Purchase form limits, normalisation and
                              validation (shared by the form and the API)
  order-reuse.ts             Transaction ID reuse rule (resubmission vs
                              duplicate), pure + unit-tested
  payment.ts                 BKASH_PAYMENT_NUMBER (server-only config)
  search.ts                  Literal ILIKE helpers (likePattern, ilikeAnyFilter)
  data/
    analysis.ts               getArchiveIndex() — server-only index of
                               published analyses (card fields, tags, first
                               slide only); getPublishedAnalysisViewer()
                               — one Analysis's ordered slides;
                               getPublishedAnalysisBySlug() — minimal,
                               strongly typed, never exposes drafts
    case-studies.ts            getCaseStudyIndex() — server-only catalogue
                               index (list fields + tags);
                               getPublishedCaseStudy() — one published Case
                               Study for its product page;
                               getPublishedCaseStudyBySlug() — same contract
    home.ts                    getLatestAnalyses() — homepage cards
    orders.ts                  getOrderableCaseStudy() (anon client) and
                               createPendingOrder() (service role, the only
                               privileged write) — Stage 4E
    admin/
      dashboard.ts             getDashboardCounts() — admin-session counts
      tags.ts                  getTagsWithUsage() — tags + usage counts
      content.ts               Analysis/Case Study list + edit reads
      content-mutations.ts     Tag-link sync, Storage list/cleanup, slug
                               conflict lookup (session client only)
      orders.ts                listOrders() / getOrder() (snapshots only)

public/
  images/
    hero-placeholder.jpg       TEMPORARY hero stand-in (see section 3)

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

### SEO and AI-search discoverability (Stage 5C)

**Configuration.** `SITE_URL` (server-only, optional): the canonical
origin, default `https://mktbd.co`. It must be an absolute `https` origin
with no path or query (`http://localhost` is accepted for local testing);
anything else falls back to the default with a `[seo]` warning
(`lib/seo.ts` `parseSiteUrl`, `lib/seo-config.ts`). It is the root
`metadataBase`, so every canonical tag, `og:url`, JSON-LD id and sitemap URL
uses the production domain regardless of the host that served the page.

**Deployment indexing.** `VERCEL_ENV` (set by Vercel at build and run time)
decides (`isIndexableDeployment`): `production` is indexable; `preview` and
`development` are not, enforced three ways — `robots.txt` disallows
everything (no sitemap line), every page inherits `<meta name="robots"
content="noindex, nofollow">` from the root layout, and every response
(sitemap included) gets `X-Robots-Tag: noindex, nofollow`. Canonicals
still point at `https://mktbd.co`. With no `VERCEL_ENV` (local builds,
other hosts) the site is indexable — another host needs its own preview
protection.

**Canonical URLs.** Self-referencing `alternates.canonical` on `/`,
`/analysis`, `/analysis/[slug]`, `/articles`, `/articles/[slug]`,
`/case-studies` and `/case-studies/[slug]`: the clean path only, so query
strings (utm, fbclid) never appear, and Next.js redirects trailing-slash
variants to the canonical form. An Article and its Analysis are separate
formats and each is canonical to itself. Unknown, draft and malformed
slugs return 404 with `noindex` and no canonical or JSON-LD, so nothing
unpublished ever points at, or leaks into, a published URL. Canonical tags
are not access control.

**Metadata and social previews.** Every public page: title, description,
canonical, Open Graph (`og:url`, `og:site_name`, `og:locale` = `en_BD`, a
shared `OG_BASE` because Next.js replaces rather than merges a parent's
`openGraph`), Twitter card.
- Article: short description (fallback: the approved archive
  description), `og:type` article with `article:published_time`
  (publication date), `article:modified_time` (`updated_at`) and
  `article:tag`; cover image when present, else a `summary` card with no
  image.
- Analysis (no description field): the approved Analysis description,
  prefixed with its stored topics when it has any ("A visual analysis from
  mktbd on Fintech and Mobile Money. …"); first slide as the image;
  `og:type` website.
- Case Study: its short description (fallback: the approved description),
  cover image, `og:type` website.
- No generated images service: existing covers and slides only.

**Structured data** (`lib/seo.ts` builders, `components/seo/json-ld.tsx`;
server-rendered `application/ld+json`, with `<` escaped so CMS text can't
end the script):
- Home: `Organization` (mktbd, url, `sameAs` = the official social
  profiles; no logo until the final asset exists) and `WebSite`.
- Article: `WebPage` + `Article` (headline, description, cover image,
  `datePublished` = publication date, `dateModified` = `updated_at`,
  `keywords` = tags, `isAccessibleForFree: true`, author **and** publisher
  = the mktbd Organization, as no author is stored in the CMS) +
  `BreadcrumbList`; `relatedLink` to the Analysis only when "See Visual
  Story" is shown.
- Analysis: `ImageGallery` (the slides) — deliberately not an Article —
  with dates, topics, publisher, `isAccessibleForFree: true`,
  `BreadcrumbList`, and `relatedLink` to the Article only when "Read
  Article" is shown.
- Case Study: `WebPage` + `Product` (name, short description, cover,
  `category` "Case Study (PDF)", brand mktbd, `releaseDate`) with an `Offer`
  of exactly `price` (the published row's `price_bdt`, the same value the
  page shows, e.g. "BDT 1,500" ↔ `"1500.00"`), `priceCurrency` BDT, `url`
  (the product page) and seller mktbd — nothing else. Why Product/Offer: the
  page sells a downloadable report at a fixed price; an Offer states only
  that. It is never marked free, and it claims no availability/stock,
  delivery time or automated fulfilment (purchase is a manual bKash payment
  verified by hand and delivered by email), and no rating or review;
  nothing from the paid PDF or orders.
- Never invented: authors, staff, reviewers, ratings, reviews, prices,
  dates, credentials. The JSON-LD repeats only what the page shows.

**Sitemap** (`app/sitemap.ts`, `lib/sitemap-entries.ts`,
`lib/data/sitemap.ts`): `/sitemap.xml` lists the homepage, the three
archives and every published Analysis, Article and Case Study (slug,
`updated_at` and one image each; three lean queries through the anonymous
client, so RLS excludes drafts). `lastmod` is only a stored timestamp:
each detail URL's own `updated_at`. The homepage and the archives get none
— no stored value records when an archive page changed (an edit to an
older item, an unpublish or a delete wouldn't show in its newest item's
`updated_at`), so no derived date is published. Never listed: drafts, `/admin`, previews, purchase
pages, APIs, error pages. ISR every 5 minutes and revalidated by every CMS
save, unpublish and delete, so unpublished or deleted content drops out at
once. One file holds 50,000 URLs; switch to `generateSitemaps()` well
before that.

**Robots and indexing exclusions.** `app/robots.ts`: every user agent —
AI crawlers included (mktbd wants to be found and cited) — may crawl the
public site, its images (Supabase Storage) and `/_next` assets;
`Disallow: /admin` and `/api/`; `Sitemap:` line. Purchase pages are not
disallowed so crawlers can read their noindex. Noindex is enforced by
`<meta name="robots">` (all `/admin` pages via `app/admin/layout.tsx`,
the Article preview, purchase pages, 404s) **and** `X-Robots-Tag: noindex,
nofollow` headers (`next.config.ts`) on `/admin`, `/api` and
`/case-studies/*/buy`. None of this is access control: `/admin` is
protected by `requireAdmin()` + RLS.

**AI-search discoverability principles.** Standards only: complete
server-rendered HTML (the full Article body, semantic `h1` → `h2`/`h3`,
`<article>`, `<time datetime>`, `<figure>`/`<figcaption>`, real outbound
source links), accurate dates, clear publisher attribution, descriptive
alt text (an inline image without alt text falls back to its caption),
and ordinary crawlable `<a>` links for "Read Article →" and "See Visual
Story →" (present in the server HTML only when the link is visible). No
hidden AI-only text, fabricated FAQs or keyword stuffing. **llms.txt is not
implemented:** no major search or answer engine documents using it, and
everything it would say is already in the sitemap and the pages.

**Remaining SEO limitations.** No `Organization.logo` (FINAL MKTBD LOGO
ASSET REQUIRED); no Twitter/X handle (`twitter:site`); no author bylines
(no author field in the CMS); Analysis descriptions are generic beyond the
topics prefix (no description field); OG images are the original uploads
(no 1200×630 crops); Google Search Console / Bing Webmaster verification
and sitemap submission happen at launch; Product rich results may want
`availability`, which is not stated because purchase availability depends
on the manual bKash setup (deliberately not stated).

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
- WYSIWYG page building (the Article rich-text editor is a constrained
  writing tool, not a page builder), multi-role permissions, analytics dashboards,
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

### Stage 4B — Public homepage (this task)
- `/` replaced: Hero, Latest Analysis, Premium Case Studies, Co-Build,
  inside the unchanged 4A header/footer. Full structure, copy, query and
  fallback behaviour in section 3, "As built (Stage 4B)".
- Data: public reads go through the new cookie-less anon client
  (`lib/supabase/public.ts`), never the service role; drafts are excluded
  by RLS and by an explicit `status = 'published'` filter. The page is
  static (ISR, 5 min) and revalidated on demand by the existing CMS
  actions. No schema, migration or RLS change.
- `next.config.ts`: `next/image` may load Supabase public Storage objects
  (`*.supabase.co` plus the configured project URL's host);
  `dangerouslyAllowLocalIP` is enabled only when that URL is
  localhost/127.0.0.1 (local Supabase stack), never for a hosted project.
- `app/globals.css`: the page gutter is now a `--page-gutter` variable
  (same values as 4A) so the full-bleed scroller can align with the
  container.
- Final refinements: a temporary photographic-style hero placeholder
  (`public/images/hero-placeholder.jpg`, captioned), the Co-Build CTA
  "Collaborate with us →" to `mailto:collaborate@mktbd.co`, Co-Build
  aligned to Premium Case Studies' layout and spacing, and desktop cover
  width capped at 22rem (mobile scroller unchanged).
- Typography correction: the hero highlight's second line on phones
  painted over the first line's descenders (an inline background fills
  the 1.2em font box, taller than the 0.95 display leading). `Highlight`
  now paints a gradient band from 0.79em above to 0.22em below the
  baseline, one per wrapped line; the hero breaks before and after the
  phrase at every width and uses leading 1.05 below lg. Verified at
  320/375/390/768/1024/1280/1440 for the hero, Latest, Premium and
  Co-Build headings: no glyph overlap, no band covering another line, no
  clipping, no overflow (131 checks).
- Deferred public-site visual TODOs (accepted temporary placeholders at
  the 04B checkpoint; to be resolved in a later visual-polish stage):
  1. **Official mktbd logo.** The public header and footer still use the
     temporary 4A text wordmark ("mktbd" set in Figtree). Replace it with
     the official logo asset -- needed: a vector SVG with a transparent
     background, in a white variant (black header/footer) and a black
     variant -- keeping its natural proportions and accessible text.
     The Admin CMS wordmark is out of scope.
  2. **Final hero photograph.** The homepage hero uses the temporary
     `public/images/hero-placeholder.jpg` (captioned "Placeholder image").
     Replace it with the approved photograph: add the file to
     `public/images/`, point `HERO_IMAGE` in `lib/site.ts` at it with real
     alt text and no `placeholder` flag, and delete the placeholder.
- Testing: `npm test` (17), lint, typecheck, production build; homepage QA
  against the local Supabase stack at 375 / 768 / 1024 / 1280 / 1440 with
  fixtures (4 published Analyses with different dates, a newer draft,
  multi-slide ordering, an invalid cover, no-slides and empty cases):
  ordering, draft exclusion, first-slide cover, fallbacks, links,
  scroll-snap and peek, keyboard focus, one h1, alt text, reduced motion,
  metadata, CMS unpublish/republish revalidation, console, mailto target,
  hero placeholder, Premium/Co-Build height parity, desktop-only card cap
  -- 118 checks;
  Admin regression 03A (49), 03B (112), 03C (74).

### Stage 4C — Public Analysis archive + carousel viewer (this task)
- `/analysis` and `/analysis/[slug]` built; full behaviour in section 4,
  "As built — Stage 4C".
- Refactor: the homepage cover card markup moved into the shared
  `components/analysis/analysis-card.tsx` (and `analysis-cover.tsx` moved
  from `components/home/`), rendering identically on the homepage.
- No schema, migration, RLS, Storage policy or CMS change.
- Topics: the inline topic row was replaced by a scalable editorial
  dropdown (single-select listbox), tested with 28 topics incl. long names.
- Progressive Load More (18 per batch) with server-side search/topics over
  the whole archive (`/api/analysis`) and on-demand viewer slides
  (`/api/analysis/[slug]`); the page no longer ships every Analysis or any
  slide list beyond first-batch covers.
- Testing: `npm test` (28: index mapping, cover, slide order, topics,
  search/filter, paging, de-dup, parameter and slug validation, URL
  parsing); against the local Supabase stack with 43 published analyses +
  3 drafts (draft-only and late-only topics, a 34-match topic, out-of-order
  slides, missing/absent covers, a date tie): archive/viewer QA at
  320/375/390/430/480/600/768/1024/1280/1440 -- 208 checks; paging QA
  (payload contents, Load More incl. rapid clicks/focus/footer, search
  and topics beyond the first batch, delayed-response races, failures,
  direct links far down the list, API hardening) -- 52 checks; Topics
  dropdown QA with 28 topics at 320-1440 (semantics, keyboard incl.
  type-ahead, Escape/outside/Tab, long names, containment, search +
  topic, topic after Load More, zero results) -- 82 checks; homepage
  04B (118) and typography (131) suites; Admin regression 03A (49), 03B
  (112), 03C (74).
- Deferred public-site visual TODOs carried over from 4B (unchanged): the
  official mktbd logo and the final homepage hero photograph.

### Stage 4D — Public Case Studies catalogue + product page (this task)
- `/case-studies` and `/case-studies/[slug]` built; full behaviour in
  section 6, "As built — Stage 4D".
- Refactor (no visible change to Analysis): the 04C archive internals were
  generalised into `components/archive/` (feed hook, search/topics
  controls, Topics dropdown moved from `components/analysis/`, result
  states) and `lib/archive-core.ts`; Analysis and Case Studies both build
  on them. `tsconfig.json` gains `allowImportingTsExtensions` so the pure
  helper modules can import each other with explicit `.ts` paths that
  `node:test` resolves (`noEmit` was already set).
- No schema, migration, RLS, Storage policy or CMS change; no migration 10.
- The Buy CTA is deliberately non-transactional; Stage 4E connects it to
  the manual bKash purchase flow.
- Related Topics are plain metadata, not filter links (see section 6).
- Empty-catalogue copy: "New case studies are in preparation."
- Review refinements (04D round 2): phone rows put the title at the full
  row width below a small cover + topic line; the product H1 steps down
  fluidly for long titles; the visible "Online ordering opens soon." note
  was removed (CTA still non-transactional, unavailable state kept for
  assistive tech); product metadata stays 2x2 down to 320px.
- Testing: `npm test` (38, incl. 10 new: row mapping, list payload,
  search on title/description/tags, literal `%`/`_`, topic + search,
  12/12/7 paging, topic list, description paragraphs, month-year);
  against the local Supabase stack with 31 published Case Studies + 3
  drafts (one newer than every published one, one with a draft-only
  topic), 23 published topics, long titles/descriptions, varied prices
  and industries, a missing cover, a dead cover path, a 16:9 cover, a
  date tie and matches beyond the first 12: catalogue + product QA at
  320/375/390/430/600/768/1024/1280/1440 -- 103 checks (published-only
  HTML/API, ordering, 12/24/31 batches, Load More removal and focus,
  double clicks, delayed-response races, search incl. `%`/`_`, topics,
  combined filters, resets, no results, covers/fallbacks, links, product
  fields, non-transactional CTA with no request/order, plain-text
  description, draft/invalid/deleted 404s without leaks, metadata, layout
  and touch targets, phone-row title width on every row, 2x2 metadata
  without collision, normal vs long H1 sizes at 320-1440); Analysis 04C archive/viewer (207), paging (52) and
  Topics (105) suites; homepage 04B (118; its old placeholder-route check
  now expects the 404) and typography (131); Admin regression 03A (49),
  03B (112), 03C (74).
- Deferred public-site visual TODOs carried over (unchanged, not addressed
  in 4D): the official mktbd logo (temporary text wordmark), the final
  homepage hero photograph (temporary placeholder), and the footer social
  links/icons (LinkedIn still renders only once `SITE.linkedinUrl` is set;
  no icons yet).

### Stage 4E — Manual Case Study purchase + order flow (this task)
- `/case-studies/[slug]/buy` and `POST /api/orders` built; the Buy Case
  Study CTA is live. Full behaviour in section 7, "As built — Stage 4E".
- No schema, migration, RLS, Storage or Admin change (Admin Orders from
  3C already covers the lifecycle). First use of the service-role client,
  narrowly, for order creation.
- New configuration: `BKASH_PAYMENT_NUMBER` (server-only);
  `SUPABASE_SERVICE_ROLE_KEY` is now required in production for orders.
- Final refinement: the confirmation's only exit is "Browse Case
  Studies →"; the form CTA reads "Submit Payment Details"; the line under
  it reads "Your payment will be manually verified before the Case Study
  is sent to your email."; Transaction-ID uniqueness reviewed and
  documented (section 7) with a database unique index proposed for
  approval, not created (pre-production hardening / launch blocker).
- Final logic correction: a Transaction ID resubmission returns the
  existing order only while that order is Pending (same Case Study and
  email); a Fulfilled or Invalid order's Transaction ID is always rejected
  (`lib/order-reuse.ts`, unit-tested).
- Testing: `npm test` (57, incl. 8 for the purchase input rules and 11
  for the Transaction ID reuse rule);
  against the local Supabase stack with the 04D fixtures, a fake payment
  number and the local service-role key: purchase QA (CTA, page content,
  validation, normalisation, double submit, confirmation, reload/back,
  replay, duplicate Transaction ID, price change, unpublish and deletion
  between load and submit, snapshots after rename/reprice/delete, API
  hardening, anon RLS on orders, simulated DB failure and missing number,
  network failure, bundle and log checks, Admin Pending -> Fulfilled /
  Invalid, the Transaction ID reuse matrix, 9 widths) -- 133 checks; the 04D suite (its CTA checks updated
  to the live link); 04C, 04B, typography and Admin 03A/03B/03C
  regressions.
- Deferred public-site visual TODOs carried over (unchanged): the official
  mktbd logo, the final homepage hero photograph and the footer social
  links/icons.

### Stage 4F — Public site completion & global polish (this task)
- Full public-site audit at 320/375/430/768/1024/1280/1440 (home,
  Analysis archive and viewer, Case Studies archive, product pages incl.
  the long-title fixture, purchase page, confirmation, all 404s). Findings
  and changes in section 3, "As built — Stage 4F".
- Changed: footer social links (`SOCIAL_LINKS`), site-wide 404, public
  error state, off-white `<main>` ground via `PublicShell`, `TextLink`
  underline on text only. No change to Analysis, Case Studies or purchase
  behaviour, the CMS, the database, RLS, Storage or migrations.
- Social URLs (official, supplied by mktbd): Facebook, LinkedIn,
  Instagram. The social-links TODO is resolved.
- Remaining pre-launch brand/content TODOs: FINAL MKTBD LOGO ASSET
  REQUIRED; FINAL HOMEPAGE HERO IMAGE REQUIRED.
- Pre-production hardening still open (unchanged, not addressed in 4F):
  database-level Transaction ID uniqueness (launch blocker), platform rate
  limiting for `POST /api/orders`, production environment variables, full
  SEO pass, performance hardening.

### Stage 5A — Articles database + CMS (this task)
- Migration `supabase/migrations/20261008000010_articles.sql`:
  `articles`, `article_tags`, tag-visibility policy extended to published
  Articles, and `analysis_article_links` (one-to-one Analysis ↔ Article
  link with the Read Article toggle; public rows only when switched on and
  both published). **Applied to production on 2026-10-08** through the
  manual "Supabase migrate" workflow (dry run #7, apply run #8); the
  workflow now expects migrations 1–10. Post-apply read-only checks
  confirmed the three tables, RLS, policies and one-to-one constraints,
  with existing tables and data unchanged.
- CMS: Articles list/new/edit/preview, rich-text body editor (Tiptap 3,
  pinned), landscape cover + inline images with captions, shared tags,
  Analysis "Linked Article" section, sidebar item, dashboard counts, Tags
  usage column. Details in section 8, "Articles".
- Shared `CoverUploader` moved to `components/admin/cover-uploader.tsx`
  (path factory + portrait/landscape frame); Case Study behaviour
  unchanged.
- No public `/articles` pages, no change to the public design, Analysis
  viewer, Case Studies or order flow (public-page requirements recorded in
  section 8).
- Pre-production hardening items from 4E/4F remain open and unchanged.

### Stage 5B — Public Articles (this task)
- `/articles` archive (featured Latest Article + 2/3/4-column library),
  `/articles/[slug]` reading page, footer link, "Read Article →" in the
  Analysis viewer and "See Visual Story →" on Articles. Details in
  section 8, "Public Articles — as built (Stage 5B)".
- No migration, CMS, payment or order changes. The only shared-code
  changes: the Analysis viewer data now includes the visible linked
  Article; the body renderer marks external links with ↗; reading
  typography scales up slightly on wide screens and tall inline images are
  height-capped.
- Canonical URLs, JSON-LD and the sitemap followed in Stage 5C.

### Stage 5C — Technical SEO & AI-search optimisation (this task)
- Canonical origin `SITE_URL` (default `https://mktbd.co`), self-referencing
  canonicals and `og:url` on every public page, shared Open Graph base,
  topic-derived Analysis descriptions, JSON-LD for home, Articles, Analysis
  and Case Studies, `/sitemap.xml`, `/robots.txt`, noindex for `/admin`
  (layout) plus `X-Robots-Tag` on `/admin`, `/api` and purchase pages,
  caption fallback for empty inline-image alt text. Details in section 9,
  "SEO and AI-search discoverability".
- No migration, layout, typography or content-architecture change.
