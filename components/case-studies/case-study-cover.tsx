"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * A Case Study cover in a portrait 3:4 frame (the CMS cover format), drawn
 * whole (object-contain) so artwork is never cropped; a cover of another
 * shape sits on a quiet light-grey mat. With no cover -- or
 * one that fails to load -- the frame becomes a deliberate near-black
 * editorial panel carrying the title; its type scales with the frame
 * (container units), so it works as a list thumbnail and as the large
 * product cover. Never a broken-image icon; the frame never changes size.
 */
export function CaseStudyCover({
  src,
  title,
  sizes,
  preload = false,
  className = "",
}: {
  src: string | null;
  title: string;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div className={`@container relative aspect-[3/4] w-full overflow-hidden ${showImage ? "bg-light-grey" : "bg-near-black"} ${className}`}>
      {showImage ? (
        <Image
          src={src}
          alt={`Cover of “${title}”`}
          fill
          sizes={sizes}
          preload={preload}
          onError={() => setFailed(true)}
          className="object-contain"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-between p-[8cqw] text-white" role="img" aria-label={`“${title}” (no cover image)`}>
          <span aria-hidden="true" className="text-[max(0.5rem,4.5cqw)] font-medium tracking-[0.14em] text-white/60 uppercase">
            Case Study
          </span>
          <span aria-hidden="true" className="line-clamp-6 text-[max(0.6875rem,9.5cqw)] leading-[1.15] font-bold text-balance">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
