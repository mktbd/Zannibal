"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Container } from "@/components/site/primitives";
import {
  appendUnique,
  normalizeSearchText,
  viewerSlugFromPath,
  type ArchiveCard,
  type ArchivePage,
  type ArchiveTag,
} from "@/lib/analysis-archive";
import { AnalysisCard } from "./analysis-card";
import { AnalysisViewer, type ViewerContent } from "./analysis-viewer";
import { TopicMenu } from "./topic-menu";

const COVER_SIZES = "(min-width: 1024px) 352px, (min-width: 600px) 46vw, 92vw";
/** history.state marker: this entry was pushed by opening a card here. */
const OPENED_HERE = "mktbdViewer";
/** Pause after the last keystroke before searching the archive. */
const SEARCH_DELAY_MS = 250;

type Results = { key: string; items: ArchiveCard[]; total: number; status: "ready" | "loading" | "error" };
type ViewerData = { slug: string; title: string; slides: string[] };

const NO_FILTER = "|";
const filterKey = (query: string, tagId: string | null) => `${normalizeSearchText(query)}|${tagId ?? ""}`;

async function fetchPage(query: string, tagId: string | null, offset: number, signal: AbortSignal): Promise<ArchivePage> {
  const params = new URLSearchParams({ offset: String(offset) });
  if (query.trim()) params.set("q", query.trim());
  if (tagId) params.set("topic", tagId);
  const response = await fetch(`/api/analysis?${params}`, { signal });
  if (!response.ok) throw new Error(`archive feed ${response.status}`);
  return response.json();
}

/**
 * The /analysis archive: search, topics, cover grid with Load More, and
 * the viewer.
 *
 * The page arrives with the first batch only (ARCHIVE_PAGE_SIZE cards, see
 * lib/analysis-archive.ts). Search
 * and topics query the whole published archive through /api/analysis; Load
 * More appends the next batch of the current results. Every request carries
 * a generation number and an abort signal, so a response that no longer
 * matches the search/topic on screen is dropped, and batches are
 * de-duplicated by id -- fast typing, switching topics mid-load or repeated
 * Load More clicks can't produce stale, duplicated or reordered cards.
 *
 * The open viewer follows the URL: a card click pushes /analysis/[slug]
 * with history.pushState (no navigation -- Next syncs usePathname), Back
 * pops it and closes the viewer, Forward reopens it. Slides are fetched
 * from /api/analysis/[slug] when an Analysis is first opened and kept for
 * reopening; a direct visit to /analysis/[slug] arrives with them already.
 */
export function AnalysisArchive({
  initialPage,
  tags,
  loadError,
  initialViewer,
}: {
  initialPage: ArchivePage;
  tags: ArchiveTag[];
  loadError: boolean;
  initialViewer: ViewerData | null;
}) {
  const pathname = usePathname();
  const openSlug = viewerSlugFromPath(pathname);

  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagId, setTagId] = useState<string | null>(null);
  const [results, setResults] = useState<Results>(() => ({
    key: NO_FILTER,
    items: initialPage.items,
    total: initialPage.total,
    status: "ready",
  }));
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const generation = useRef(0);
  const requests = useRef<{ list?: AbortController; more?: AbortController }>({});
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  /** Card index to focus once a final batch has rendered (Load More is gone). */
  const focusCardAt = useRef<number | null>(null);
  const searchId = useId();

  const activeTag = tags.find((tag) => tag.id === tagId) ?? null;
  const filtering = searchQuery.trim() !== "" || tagId !== null;
  const hasMore = results.status === "ready" && results.items.length < results.total;

  // Debounce typing; the search runs on the settled text.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(query), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // A new search or topic replaces the results with the first matching batch.
  const runSearch = useCallback(
    (nextQuery: string, nextTag: string | null) => {
      const key = filterKey(nextQuery, nextTag);
      requests.current.list?.abort();
      requests.current.more?.abort();
      const gen = ++generation.current;
      setLoadingMore(false);
      setMoreFailed(false);
      if (key === NO_FILTER) {
        setResults({ key, items: initialPage.items, total: initialPage.total, status: "ready" });
        return;
      }
      const controller = new AbortController();
      requests.current.list = controller;
      setResults((previous) => ({ ...previous, key, status: "loading" }));
      fetchPage(nextQuery, nextTag, 0, controller.signal).then(
        (page) => {
          if (gen === generation.current) setResults({ key, items: page.items, total: page.total, status: "ready" });
        },
        () => {
          if (gen === generation.current && !controller.signal.aborted) setResults((previous) => ({ ...previous, key, status: "error" }));
        },
      );
    },
    [initialPage],
  );

  const lastKey = useRef(NO_FILTER);
  useEffect(() => {
    const key = filterKey(searchQuery, tagId);
    if (key === lastKey.current) return;
    lastKey.current = key;
    runSearch(searchQuery, tagId);
  }, [searchQuery, tagId, runSearch]);

  useEffect(() => () => {
    requests.current.list?.abort();
    requests.current.more?.abort();
  }, []);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    const gen = generation.current;
    const { key, items } = results;
    const controller = new AbortController();
    requests.current.more = controller;
    setLoadingMore(true);
    setMoreFailed(false);
    fetchPage(searchQuery, tagId, items.length, controller.signal).then(
      (page) => {
        if (gen !== generation.current) return;
        setResults((previous) =>
          previous.key === key ? { ...previous, items: appendUnique(previous.items, page.items), total: page.total } : previous,
        );
        setLoadingMore(false);
        // Keep keyboard focus on Load More; if it disappears (all loaded),
        // move focus to the first card of the new batch.
        if (document.activeElement === loadMoreRef.current && items.length + page.items.length >= page.total)
          focusCardAt.current = items.length;
      },
      () => {
        if (gen !== generation.current || controller.signal.aborted) return;
        setLoadingMore(false);
        setMoreFailed(true);
      },
    );
  }

  useEffect(() => {
    if (focusCardAt.current === null) return;
    document.querySelectorAll<HTMLAnchorElement>("[data-slug] a")[focusCardAt.current]?.focus();
    focusCardAt.current = null;
  }, [results.items]);

  // ---- Viewer -----------------------------------------------------------
  const [viewerCache, setViewerCache] = useState<Record<string, ViewerData | "missing" | "error">>(() =>
    initialViewer ? { [initialViewer.slug]: initialViewer } : {},
  );
  const cached = openSlug ? viewerCache[openSlug] : undefined;

  // Opening an Analysis not yet seen: fetch its ordered slides.
  useEffect(() => {
    if (!openSlug || (cached !== undefined && cached !== "error")) return;
    const controller = new AbortController();
    fetch(`/api/analysis/${encodeURIComponent(openSlug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return "missing" as const;
        if (!response.ok) throw new Error(`viewer ${response.status}`);
        return (await response.json()) as ViewerData;
      })
      .then(
        (data) => setViewerCache((state) => ({ ...state, [openSlug]: data })),
        () => {
          if (!controller.signal.aborted) setViewerCache((state) => ({ ...state, [openSlug]: "error" }));
        },
      );
    return () => controller.abort();
    // "error" is retried on the next open, not in a loop: only openSlug re-triggers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSlug]);

  const knownTitle = openSlug ? results.items.find((item) => item.slug === openSlug)?.title : undefined;
  const viewerContent: ViewerContent | null = openSlug
    ? typeof cached === "object"
      ? { state: "ready", title: cached.title, slides: cached.slides }
      : { state: cached === "missing" ? "missing" : cached === "error" ? "error" : "loading", title: knownTitle ?? "Analysis", slides: [] }
    : null;

  // When the viewer closes (button, Escape, backdrop or Back), return focus
  // to the card it was opened from -- or, if that card isn't loaded (a
  // direct link beyond the first batch), to the results.
  const lastOpen = useRef<string | null>(openSlug);
  useEffect(() => {
    const closed = lastOpen.current;
    lastOpen.current = openSlug;
    if (closed && !openSlug) {
      const card = document.querySelector<HTMLAnchorElement>(`[data-slug="${CSS.escape(closed)}"] a`);
      (card ?? document.getElementById("analysis-results-heading"))?.focus();
    }
  }, [openSlug]);

  function open(event: MouseEvent<HTMLAnchorElement>, slug: string) {
    // Let the browser handle new-tab / new-window clicks.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState({ [OPENED_HERE]: true }, "", `/analysis/${encodeURIComponent(slug)}`);
  }

  function close() {
    if (window.history.state?.[OPENED_HERE]) {
      // Opened from this archive: step back, so Back/Forward stay natural.
      window.history.back();
    } else {
      // Arrived directly on /analysis/[slug]: swap in the archive URL.
      window.history.replaceState(null, "", "/analysis");
    }
  }

  function clearFilters() {
    setQuery("");
    setSearchQuery("");
    setTagId(null);
  }

  if (loadError || initialPage.total === 0) {
    return (
      <section aria-label="Analyses" className="bg-off-white py-16 sm:py-20">
        <Container>
          <p className="max-w-[44ch] text-lede text-muted">
            {loadError
              ? "The analysis archive couldn’t be loaded right now. Please try again in a moment."
              : "New analysis is on the way."}
          </p>
        </Container>
      </section>
    );
  }

  return (
    <>
      <section aria-labelledby="analysis-results-heading" className="bg-off-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pb-24">
        <Container>
          <div role="search" className="border-b border-black/15 pb-6">
            <label htmlFor={searchId} className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
              Search analysis
            </label>
            {/* An editorial search line rather than a form box: hairline rule,
                regular weight, held to a readable width; focus darkens and
                thickens the rule (no layout shift). */}
            <div className="relative mt-2 max-w-xl">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute top-1/2 left-0 size-5 -translate-y-1/2 text-black/45"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <circle cx="10.5" cy="10.5" r="6" />
                <path d="M15 15l5 5" />
              </svg>
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title or topic"
                autoComplete="off"
                spellCheck={false}
                className="w-full appearance-none rounded-none border-0 border-b border-black/30 bg-transparent py-2.5 pr-11 pl-8 text-lg text-black transition-[border-color,box-shadow] placeholder:text-muted hover:border-black/60 focus-visible:border-black focus-visible:shadow-[0_1px_0_0_var(--color-black)] focus-visible:outline-none! sm:text-xl [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 items-center justify-center text-black/60 hover:text-black"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              ) : null}
            </div>

            {tags.length > 0 ? <TopicMenu tags={tags} value={tagId} onChange={setTagId} /> : null}
          </div>

          <h2 id="analysis-results-heading" tabIndex={-1} className="sr-only">
            Analyses
          </h2>
          {/* Announces result changes; shown as a quiet count only while filtering. */}
          <p aria-live="polite" className={filtering && results.status === "ready" && results.total > 0 ? "mt-5 text-sm text-muted" : "sr-only"}>
            {results.status === "loading"
              ? ""
              : results.status === "error"
                ? "Results couldn’t be loaded."
                : results.total === 0
                  ? "No analyses match."
                  : `${results.total} ${results.total === 1 ? "analysis" : "analyses"}${filtering ? "" : " published"}`}
          </p>

          {results.status === "error" ? (
            <div className="py-12">
              <p className="max-w-[44ch] text-lede text-black">Results couldn’t be loaded right now.</p>
              <button
                type="button"
                onClick={() => runSearch(searchQuery, tagId)}
                className="mt-4 inline-flex min-h-11 items-center font-medium underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
              >
                Try again
              </button>
            </div>
          ) : results.status === "ready" && results.items.length === 0 ? (
            <div className="py-12">
              <p className="max-w-[44ch] text-lede text-black">
                No analyses match
                {searchQuery.trim() ? <> “{searchQuery.trim()}”</> : null}
                {activeTag ? <> in {activeTag.name}</> : null}.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex min-h-11 items-center font-medium underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
              >
                Clear search and filter
              </button>
            </div>
          ) : (
            <>
              <div className="@container mt-6 sm:mt-8">
                {/* One cover per row on phones; two from 600px, where two-column titles
                    stay at about two lines (narrower, most need three or four);
                    three from 1024px, capped like the homepage. While a new search
                    is on its way the previous results stay, quietly dimmed. */}
                <ul
                  aria-busy={results.status === "loading" || loadingMore}
                  className={`grid grid-cols-1 gap-5 transition-opacity min-[600px]:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,22rem))] lg:gap-[max(1.5rem,calc((100cqw-66rem)/2))] ${
                    results.status === "loading" ? "opacity-50" : ""
                  }`}
                >
                  {results.items.map((analysis, index) => (
                    <li key={analysis.id} data-slug={analysis.slug}>
                      <AnalysisCard
                        analysis={analysis}
                        sizes={COVER_SIZES}
                        preload={index === 0}
                        compact
                        prefetch={false}
                        onOpen={(event) => open(event, analysis.slug)}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              {/* Load More: an explicit request for the next batch -- never
                  triggered by scrolling, so the footer stays reachable. */}
              {hasMore || loadingMore ? (
                <div className="mt-12 flex flex-col items-center gap-2 text-center sm:mt-14">
                  <p aria-live="polite" className="text-sm text-muted">
                    Showing {results.items.length} of {results.total} {results.total === 1 ? "analysis" : "analyses"}
                  </p>
                  <button
                    ref={loadMoreRef}
                    type="button"
                    onClick={loadMore}
                    aria-disabled={loadingMore}
                    className="group inline-flex min-h-11 items-center gap-2 font-medium aria-disabled:cursor-progress aria-disabled:text-muted"
                  >
                    <span className={loadingMore ? "" : "underline decoration-1 underline-offset-[0.25em] group-hover:decoration-2"}>
                      {loadingMore ? "Loading…" : "Load More Analysis"}
                    </span>
                    {loadingMore ? null : (
                      <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-y-0.5">
                        ↓
                      </span>
                    )}
                  </button>
                  {moreFailed ? (
                    <p role="alert" className="text-sm text-black">
                      More analyses couldn’t be loaded. Please try again.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </Container>
      </section>

      {viewerContent && openSlug ? <AnalysisViewer key={openSlug} content={viewerContent} onClose={close} /> : null}
    </>
  );
}
