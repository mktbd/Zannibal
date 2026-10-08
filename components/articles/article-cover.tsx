"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * A landscape Article cover in a fixed frame (4:3 cards, wider for the
 * featured Article and the reading page), cropped to fill (object-cover):
 * covers are landscape by design, so cropping trims edges, never the
 * subject's shape. With no cover -- or one that fails to load -- the frame
 * becomes a neutral editorial placeholder (see CoverPlaceholder); the
 * title is always printed beside or below, never inside. The frame never
 * changes size.
 */
export function ArticleCover({
  src,
  title,
  sizes,
  ratio,
  preload = false,
  decorative = false,
  className = "",
}: {
  src: string | null;
  title: string;
  sizes: string;
  /** Tailwind aspect class, e.g. "aspect-[4/3]". */
  ratio: string;
  preload?: boolean;
  /** The title is right next to it (cards): empty alt avoids reading it twice. */
  decorative?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div className={`@container relative w-full overflow-hidden bg-light-grey ${ratio} ${className}`}>
      {showImage ? (
        <Image
          src={src}
          alt={decorative ? "" : `Cover image for “${title}”`}
          fill
          sizes={sizes}
          preload={preload}
          onError={() => setFailed(true)}
          className="object-cover transition-[filter] duration-200 group-hover:brightness-95"
        />
      ) : (
        <CoverPlaceholder />
      )}
    </div>
  );
}

/**
 * The no-cover placeholder: light grey paper, one large circle outline
 * clipped by the top-right corner, a short hairline rule, and the mktbd
 * wordmark with the yellow editorial square bottom-left. Everything is
 * sized in container units, so the same design reads in a small library
 * card and in the wide featured frame. Pure CSS -- no image assets.
 */
function CoverPlaceholder() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute -top-[30cqw] -right-[16cqw] size-[68cqw] rounded-full border-[max(1px,0.25cqw)] border-black/10" />
      <div className="absolute -top-[14cqw] -right-[2cqw] size-[36cqw] rounded-full border-[max(1px,0.25cqw)] border-black/[0.06]" />
      <div className="absolute top-[9cqw] left-[6cqw] h-px w-[10cqw] bg-black/25" />
      <div className="absolute bottom-[6cqw] left-[6cqw] flex items-center gap-[max(0.25rem,1.4cqw)]">
        <span className="inline-block size-[max(0.375rem,1.6cqw)] bg-accent-yellow ring-1 ring-black/10" />
        <span className="text-[max(0.6875rem,3.6cqw)] leading-none font-extrabold tracking-[-0.03em] text-black/70">mktbd</span>
      </div>
    </div>
  );
}
