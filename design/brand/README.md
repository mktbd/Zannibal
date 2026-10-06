# mktbd brand source

- `mktbd-logo-source.webp` is the original mktbd logo file as supplied
  (1024×1024 WebP, white wordmark on a dark textured background, no
  transparency). It is kept unmodified as the brand source/reference.
- It is **not** used by the application. The public header and footer still
  use the temporary text wordmark (a deferred visual TODO in
  `docs/MKTBD_SPEC.md`).
- Before website integration, a production-ready logo -- vector (SVG) with
  a transparent background, in white and black variants -- should be
  derived from this source or replace it.

This folder is outside `public/`, so nothing in it is served by the site.
