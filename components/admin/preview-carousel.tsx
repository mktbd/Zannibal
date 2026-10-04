"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Simple stand-in for the future public carousel viewer: original slides,
 * uncropped, one at a time, with prev/next, arrow keys, swipe and a
 * position indicator. Editorial preview only -- not the public lightbox.
 */
export function PreviewCarousel({ slides, title }: { slides: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const count = slides.length;

  const go = (next: number) => setIndex(Math.max(0, Math.min(count - 1, next)));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (event.key === "ArrowRight") setIndex((i) => Math.min(count - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  if (count === 0) {
    return (
      <div className="flex h-64 items-center justify-center bg-near-black text-sm text-white/70">
        No slides yet.
      </div>
    );
  }

  return (
    <section aria-roledescription="carousel" aria-label={`${title} slides`} className="bg-near-black px-3 py-4 sm:px-6">
      <div
        className="relative flex items-center justify-center"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const delta = event.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
          touchStart.current = null;
        }}
      >
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous slide"
          className="absolute left-0 z-10 hidden h-10 w-10 items-center justify-center rounded-sm bg-white/10 text-xl text-white hover:bg-white/20 disabled:opacity-30 sm:flex"
        >
          ‹
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- original uploaded slide, shown uncropped at its own aspect ratio */}
        <img
          key={slides[index]}
          src={slides[index]}
          alt={`Slide ${index + 1} of ${count}`}
          className="max-h-[75vh] max-w-full object-contain sm:max-w-[calc(100%-6rem)]"
        />
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === count - 1}
          aria-label="Next slide"
          className="absolute right-0 z-10 hidden h-10 w-10 items-center justify-center rounded-sm bg-white/10 text-xl text-white hover:bg-white/20 disabled:opacity-30 sm:flex"
        >
          ›
        </button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-sm text-white">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="rounded-sm px-2 py-1 disabled:opacity-30 sm:hidden"
        >
          ‹ Prev
        </button>
        <span aria-live="polite" className="tabular-nums">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === count - 1}
          className="rounded-sm px-2 py-1 disabled:opacity-30 sm:hidden"
        >
          Next ›
        </button>
      </div>
    </section>
  );
}
