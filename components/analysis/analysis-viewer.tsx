"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type UIEvent } from "react";

/**
 * What the viewer shows: the ordered slides once loaded, or a state while
 * they're on their way / couldn't be fetched / the Analysis isn't
 * available (e.g. unpublished since the archive was loaded).
 */
export type ViewerContent = {
  state: "ready" | "loading" | "missing" | "error";
  title: string;
  slides: string[];
  /**
   * The linked Article ("Read Article"), present only when the server
   * returned a visible link (toggle on, both published -- enforced by RLS).
   */
  article: { slug: string; title: string } | null;
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Near-fullscreen carousel for one Analysis, shown as a native modal
 * <dialog>: the browser makes the archive inert, contains focus and turns
 * Escape into a cancel request, which closes it through onClose (so the URL
 * goes back to /analysis).
 *
 * The slides sit in a horizontal scroll-snap track: touch swiping is the
 * browser's own (a vertical gesture can't change slide), arrows/buttons
 * scroll it one slide at a time, and the current slide is read back from
 * the scroll position. Each slide is the upload served through the image
 * optimizer, drawn whole (object-contain) in the space left by the
 * controls, never cropped.
 * Slides arrive with `content` -- possibly a moment after the viewer opens.
 */
export function AnalysisViewer({ content, onClose }: { content: ViewerContent; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  // Slide a button/arrow press is heading to while the track is still
  // scrolling, so quick repeated presses each advance one more slide.
  const pendingRef = useRef<number | null>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const message =
    content.state === "loading"
      ? "Loading slides…"
      : content.state === "missing"
        ? "This analysis isn’t available."
        : content.state === "error"
          ? "This analysis couldn’t be loaded. Please try again."
          : "This analysis has no slides yet.";
  const slides = content.state === "ready" ? content.slides : [];
  const readArticle = content.state === "ready" ? content.article : null;
  const total = slides.length;

  // Open as a modal; lock the page behind it without shifting the layout.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    const previous = {
      overflow: html.style.overflow,
      paddingRight: html.style.paddingRight,
    };
    html.style.overflow = "hidden";
    if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
    return () => {
      html.style.overflow = previous.overflow;
      html.style.paddingRight = previous.paddingRight;
      if (dialog.open) dialog.close();
    };
  }, []);

  const step = useCallback(
    (delta: number) => {
      const track = trackRef.current;
      if (!track) return;
      const from = pendingRef.current ?? indexRef.current;
      const target = Math.max(0, Math.min(total - 1, from + delta));
      if (target === from) return;
      pendingRef.current = target;
      track.scrollTo({
        left: target * track.clientWidth,
        behavior: reducedMotion() ? "auto" : "smooth",
      });
    },
    [total],
  );

  // Keep the current slide in place when the viewport (and so each slide)
  // changes width -- e.g. rotating a phone.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let width = track.clientWidth;
    const observer = new ResizeObserver(() => {
      if (track.clientWidth === width) return;
      width = track.clientWidth;
      track.scrollTo({ left: indexRef.current * width, behavior: "auto" });
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [total]);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const track = event.currentTarget;
    if (track.clientWidth === 0) return;
    const current = Math.max(0, Math.min(total - 1, Math.round(track.scrollLeft / track.clientWidth)));
    // Settled on the pending slide -- or scrolling went idle elsewhere (a
    // swipe took over): stop tracking it.
    if (pendingRef.current !== null && Math.abs(track.scrollLeft - pendingRef.current * track.clientWidth) < 2)
      pendingRef.current = null;
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      pendingRef.current = null;
    }, 250);
    if (current !== index) setIndex(current);
  }

  // Arrow keys work wherever focus sits while the viewer is open.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        step(event.key === "ArrowRight" ? 1 : -1);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [step]);

  // Reaching the first/last slide disables the arrow that may hold focus,
  // which would drop focus out of the dialog: hand it to the other arrow
  // (or Close) instead.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.contains(document.activeElement)) return;
    const fallback =
      dialog.querySelector<HTMLButtonElement>("button[data-nav]:not(:disabled)") ??
      dialog.querySelector<HTMLButtonElement>("button[data-close]");
    fallback?.focus();
  }, [index]);

  // Close on a click anywhere that isn't a control or the artwork itself --
  // including the letterboxed space around a slide drawn with object-contain.
  function onBackdropClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, a")) return;
    if (target instanceof HTMLImageElement && target.naturalWidth > 0) {
      const box = target.getBoundingClientRect();
      const scale = Math.min(box.width / target.naturalWidth, box.height / target.naturalHeight);
      const w = target.naturalWidth * scale;
      const h = target.naturalHeight * scale;
      const left = box.left + (box.width - w) / 2;
      const top = box.top + (box.height - h) / 2;
      if (event.clientX >= left && event.clientX <= left + w && event.clientY >= top && event.clientY <= top + h)
        return;
    }
    if (target.closest("[data-slide-message]")) return;
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={content.title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={onBackdropClick}
      className="on-dark fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-black/95 p-0 text-white backdrop:bg-black/60 motion-safe:transition-opacity motion-safe:duration-150 motion-safe:starting:opacity-0"
    >
      {/* Top bar: counter and close on one line, clear of the notch/status
          bar; on phones the counter lines up with the slide's left edge. */}
      <div className="absolute inset-x-0 top-0 z-10 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between pt-[env(safe-area-inset-top)] pr-[max(var(--page-gutter),env(safe-area-inset-right))] pl-[max(var(--page-gutter),env(safe-area-inset-left))]">
        <p className="text-sm font-medium tabular-nums text-white/70" aria-hidden="true">
          {total > 1 ? `${index + 1} / ${total}` : null}
        </p>
        <button
          type="button"
          onClick={onClose}
          data-close
          aria-label="Close"
          className="-mr-2.5 inline-flex size-11 items-center justify-center text-white/85 hover:text-white"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {total > 0 ? `Slide ${index + 1} of ${total}` : message}
      </p>

      {/* Stage: the space the slides may use, never under a control. Phones:
          nearly full-bleed (the gutter is applied per slide, so swiping still
          spans the screen); larger screens: deliberate margins all round so
          the slide sits in the viewport rather than filling it. */}
      <div
        className={`absolute inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] md:inset-x-24 md:top-[3.75rem] lg:inset-x-28 ${
          readArticle
            ? "bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-14"
            : "bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:bottom-4"
        }`}
      >
        {content.state === "loading" ? (
          <p data-slide-message aria-busy="true" className="flex h-full items-center justify-center px-6 text-center text-sm text-white/50">
            Loading…
          </p>
        ) : total === 0 ? (
          <p data-slide-message className="flex h-full items-center justify-center px-6 text-center text-white/60">
            {message}
          </p>
        ) : (
          <div
            ref={trackRef}
            // Focusable scroll region (keyboard users can reach it; ←/→ step
            // slides), announced as a carousel; each slide is a labelled group.
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label={`${content.title}, slides`}
            onScroll={onScroll}
            className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [touch-action:pan-x_pinch-zoom] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((src, i) => (
              <div
                key={src + i}
                className="relative h-full w-full shrink-0 snap-center snap-always"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${total}`}
                aria-hidden={i !== index}
              >
                {failed[i] ? (
                  <p
                    data-slide-message
                    className="flex h-full items-center justify-center px-6 text-center text-white/60"
                  >
                    This slide couldn’t be loaded.
                  </p>
                ) : (
                  <div className="absolute inset-y-0 right-[max(var(--page-gutter),env(safe-area-inset-right))] left-[max(var(--page-gutter),env(safe-area-inset-left))] md:inset-x-0">
                    <Image
                      src={src}
                      alt={`Slide ${i + 1} of ${total} — “${content.title}”`}
                      fill
                      // Served through the image optimizer as WebP at quality 90 (allowlisted in
                      // next.config.ts), sized to the stage: the full slide stays sharp while a
                      // multi-MB PNG upload is no longer sent as-is to every phone.
                      quality={90}
                      // Width hint: on desktop a slide is at most as wide as the stage is tall
                      // (square slides); 4:5 portrait slides use less.
                      sizes="(min-width: 768px) 100vh, 100vw"
                      // The current slide is preloaded (it is the page's main image); its
                      // neighbours load straight away, the rest lazily.
                      preload={i === index}
                      loading={i === index ? undefined : Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                      draggable={false}
                      onError={() => setFailed((state) => ({ ...state, [i]: true }))}
                      className="object-contain select-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read Article: a quiet secondary link under the slides, only when
          the linked Article may be shown. */}
      {readArticle ? (
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-start justify-center pt-3 pb-[env(safe-area-inset-bottom)] md:h-14 md:items-center md:pt-0">
          <Link
            href={`/articles/${readArticle.slug}`}
            className="group inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            <span className="underline decoration-white/30 decoration-1 underline-offset-[0.25em] group-hover:decoration-white">
              Read Article
            </span>
            <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      ) : null}

      {/* Previous / next: desktop and tablet only; touch uses swipe. */}
      {total > 1 ? (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            data-nav
            disabled={index === 0}
            aria-label="Previous slide"
            className="absolute top-1/2 left-4 z-10 hidden size-12 -translate-y-1/2 items-center justify-center border border-white/25 text-white/85 hover:border-white/60 hover:text-white disabled:invisible md:inline-flex"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            data-nav
            disabled={index === total - 1}
            aria-label="Next slide"
            className="absolute top-1/2 right-4 z-10 hidden size-12 -translate-y-1/2 items-center justify-center border border-white/25 text-white/85 hover:border-white/60 hover:text-white disabled:invisible md:inline-flex"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      ) : null}
    </dialog>
  );
}
