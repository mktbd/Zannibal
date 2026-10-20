"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * First-slide cover filling its frame (AnalysisCard's 4:5 frame, the slide
 * format, so a 1080x1350 slide fills it exactly). object-contain so a slide
 * of another shape is never cropped; it sits on near-black. If there is no
 * slide, or the image fails to load, the frame stays a plain near-black
 * panel (the card's title is printed beneath it).
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
      // Inline as well as the class: vinext's next/image (Cloudflare build) sets objectFit: "cover"
      // inline on fill images, which beats object-contain and crops the slide.
      style={{ objectFit: "contain" }}
      className="object-contain transition-[filter] duration-200 group-hover:brightness-90"
    />
  );
}
