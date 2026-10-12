# Upload-time image optimization (design, Stage 05E-B2B)

Status: **design only, not implemented.** Implementation is a separate stage
that needs its own approval, and so does backfilling existing images.
Cloudflare Images is not used.

## Why this is needed

Stage 05D serves Storage images through Next's image optimizer (`next/image`
with `remotePatterns`, qualities 75/90, responsive `sizes`). On Vercel the
optimizer resizes each image to the requested width and converts it to
AVIF/WebP.

vinext on Cloudflare Workers has no optimizer unless one is configured. The
only built-in one is the Cloudflare Images binding, which is a paid,
separately approved service. Without an optimizer, `next/image` serves the
original upload as-is. In the local staging run that meant 0.3–2.8 MB of
images per page (2400 px JPEG covers, 1080×1350 PNG slides), where 05D
delivered right-sized WebP/AVIF. So without this work, moving to Workers
would undo the 05D image gains.

## Design

**1. Generate variants in the admin's browser at upload.**
- The admin uploader (`components/admin/cover-uploader.tsx`, the slide
  uploader and the article inline-image uploader) already uploads straight
  from the browser to Supabase Storage under the admin session. The
  `editorial-media` INSERT policy is admin-only.
- Before uploading, the browser decodes the file (`createImageBitmap`), draws
  it at each target width on an `OffscreenCanvas` (or `<canvas>`), and encodes
  it with `convertToBlob({ type: "image/webp", quality })`.
- Each variant uploads with the same `uploadMedia()` call, with
  `cache-control: max-age=31536000, immutable`. Paths are fresh UUIDs and
  never overwritten.
- This costs no Worker CPU, needs no new service, and needs no new
  credential.

**2. Mark the variant set in the stored path, with no database migration.**
- Original: `case-studies/<id>/cover-<uuid>.v1.jpg`. The `.v1` marker means
  "variants exist".
- Variants: `case-studies/<id>/cover-<uuid>.v1.w640.webp`,
  `….w960.webp`, `….w1280.webp`, `….w1920.webp`.
- The `lib/media.ts` path validators accept the optional `.v1` marker (one
  regex change). Paths without it are the existing images and the fallback
  case, and are served as before.

**3. Widths and quality (matching 05D's `sizes` and qualities).**

| Image | Variant widths | WebP quality |
|---|---|---|
| Case Study / Article covers, hero-style cards | 384, 640, 960, 1280, 1920 (none wider than the original) | 75 |
| Analysis slides (text and charts; viewer) | 540, 1080 (original 1080×1350) | 90 |
| Article inline figures | 640, 960, 1280, 1920 | 80 |

The original is kept as uploaded: for downloads, future re-encoding and
browsers that can't decode WebP. Per image, storage grows by roughly 40–60%
of the original.

**4. Serving: a per-component `loader`.**
- vinext ignores `images.loaderFile` but honours the `loader` prop.
- A `supabaseVariantLoader({ src, width, quality })` in `lib/image-loader.ts`:
  - for `.v1` paths, returns the public URL of the smallest variant at least
    `width` wide, or the largest one;
  - for anything else, returns the original URL.
- It is set on the four Storage-backed `next/image` uses (`article-cover`,
  `analysis-cover`, `analysis-viewer`, `case-study-cover`; the hero uses a
  static file, see point 6). `srcset`/`sizes`, `priority`/`fetchPriority`,
  lazy loading and explicit dimensions all stay exactly as in 05D, so LCP
  and CLS behaviour is unchanged.
- Images load straight from Supabase Storage's CDN, so they cost **no Worker
  requests or CPU**.

**5. Fallback and safety.**
- If the browser can't encode WebP (`convertToBlob` returns a non-WebP type),
  the uploader stores the original without the `.v1` marker. The site then
  serves the original, which is today's behaviour, and the editor shows a
  notice.
- A variant upload failure discards the whole set (`discardUnsavedMedia`
  for each path), so a `.v1` path never lacks variants.
- `lib/media-cleanup.ts` deletes variants together with their original
  (derived paths) when a cover, slide or figure is replaced or removed, and
  only after the save succeeds, as it does now.
- Validation is unchanged: types JPEG/PNG/WebP, 5 MB maximum per original.
  Decoding is capped at 8000 px per side.

**6. The static hero image.**
`components/home/hero.tsx` uses a file from `public/`. Generate its WebP
widths once, offline, commit them, and point the same loader at them.

**7. Backfilling existing images (separate approval).**
- A manual GitHub Actions mode, run per environment (staging first), would:
  - read each referenced original with the target's service key;
  - generate the variants with `sharp` (already in the dependency tree);
  - upload them under the `.v1` naming;
  - update the referencing column (`cover_image_path`, slide `storage_path`,
    figure `attrs.path`) in one transaction per row.
- It is idempotent, and the originals stay in place.
- On production this is a data change, so it needs its own preflight,
  dry-run and apply approvals, like migration 11.

## Verification when implemented

- Unit tests: loader width selection, path validators, cleanup of derived
  paths.
- Staging browser round: image bytes per page (already reported). Target:
  each page's images at or below the 05D Vercel figures, and no image
  request to the Worker.
- Lighthouse on staging: LCP and CLS no worse than the 05D baseline.
