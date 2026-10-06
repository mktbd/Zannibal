"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * First-slide cover inside a fixed 9:16 frame. object-contain so a slide is
 * never cropped (4:5 slides sit on near-black). If there is no slide, or
 * the image fails to load, the frame stays as a plain near-black cover and
 * the overlaid title carries the card.
 */
export function AnalysisCover({ src, title, sizes, preload = false }: { src: string | null; title: string; sizes: string; preload?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div aria-hidden="true" className="absolute inset-0 bg-near-black" />;
  }
  return (
    <Image
      src={src}
      alt={`First slide of “${title}”`}
      fill
      sizes={sizes}
      preload={preload}
      onError={() => setFailed(true)}
      className="object-contain transition-[filter] duration-200 group-hover:brightness-90"
    />
  );
}
