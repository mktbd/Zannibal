"use client";

import { getImageProps } from "next/image";

/**
 * An inline Article image: served through the Next.js image optimizer
 * (WebP, responsive srcset sized to the ≈44rem reading column) instead of
 * the original upload, lazily loaded. The stored dimensions are unknown, so
 * it is laid out at its natural ratio by CSS (.article-body figure img);
 * getImageProps' "fill" positioning style is dropped.
 *
 * A Client Component (still server-rendered into the HTML) because on the
 * Cloudflare Worker build next/image is vinext's "use client" module, so
 * getImageProps() can't be called from a Server Component there. vinext
 * serves remote images at their original URL (as it does the covers).
 */
export function ArticleImage({ src, alt }: { src: string; alt: string }) {
  const { props } = getImageProps({
    src,
    alt,
    fill: true,
    sizes: "(min-width: 768px) 704px, calc(100vw - 32px)",
  });
  const { style: _fillStyle, ...rest } = props;
  void _fillStyle;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- optimized responsive <img> (getImageProps) at its natural ratio; alt is in the props
  return <img {...rest} loading="lazy" decoding="async" />;
}
