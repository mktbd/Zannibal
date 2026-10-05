"use client";

import type { FocusEvent, ReactNode } from "react";

/**
 * The Latest Analysis scroller. Browsers leave a partially visible element
 * where it is when it receives focus, so a keyboard user tabbing to the
 * peeking card would land on a half-hidden card; bring it fully into view.
 * Only keyboard focus (:focus-visible) moves the row -- a pointer press is
 * already a navigation.
 */
export function CoverRow({ className, children }: { className: string; children: ReactNode }) {
  function revealFocused(event: FocusEvent<HTMLUListElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <ul aria-label="Latest analysis" className={className} onFocus={revealFocused}>
      {children}
    </ul>
  );
}
