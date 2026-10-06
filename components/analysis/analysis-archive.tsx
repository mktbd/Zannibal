"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Container } from "@/components/site/primitives";
import { DiscoveryControls } from "@/components/archive/discovery-controls";
import { LoadMore, NoResults, ResultsError } from "@/components/archive/results-states";
import { useArchiveFeed } from "@/components/archive/use-archive-feed";
import { viewerSlugFromPath, type ArchiveCard, type ArchivePage, type ArchiveTag } from "@/lib/analysis-archive";
import { AnalysisCard } from "./analysis-card";
import { AnalysisViewer, type ViewerContent } from "./analysis-viewer";

const COVER_SIZES = "(min-width: 1024px) 352px, (min-width: 600px) 46vw, 92vw";
/** history.state marker: this entry was pushed by opening a card here. */
const OPENED_HERE = "mktbdViewer";

type ViewerData = { slug: string; title: string; slides: string[] };

/**
 * The /analysis archive: search, topics, cover grid with Load More, and
 * the viewer.
 *
 * The page arrives with the first batch only (ARCHIVE_PAGE_SIZE cards, see
 * lib/analysis-archive.ts). Search and topics query the whole published
 * archive through /api/analysis and Load More appends the next batch --
 * the race-safe feed state lives in useArchiveFeed (shared with Case
 * Studies).
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

  const feed = useArchiveFeed<ArchiveCard>({ endpoint: "/api/analysis", initialPage, itemLinkSelector: "[data-slug] a" });
  const { results } = feed;
  const activeTag = tags.find((tag) => tag.id === feed.tagId) ?? null;

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
          <DiscoveryControls
            searchLabel="Search analysis"
            placeholder="Title or topic"
            query={feed.query}
            onQueryChange={feed.setQuery}
            tags={tags}
            tagId={feed.tagId}
            onTagChange={feed.setTagId}
          />

          <h2 id="analysis-results-heading" tabIndex={-1} className="sr-only">
            Analyses
          </h2>
          {/* Announces result changes; shown as a quiet count only while filtering. */}
          <p aria-live="polite" className={feed.filtering && results.status === "ready" && results.total > 0 ? "mt-5 text-sm text-muted" : "sr-only"}>
            {results.status === "loading"
              ? ""
              : results.status === "error"
                ? "Results couldn’t be loaded."
                : results.total === 0
                  ? "No analyses match."
                  : `${results.total} ${results.total === 1 ? "analysis" : "analyses"}${feed.filtering ? "" : " published"}`}
          </p>

          {results.status === "error" ? (
            <ResultsError onRetry={feed.retry} />
          ) : results.status === "ready" && results.items.length === 0 ? (
            <NoResults noun="analyses" query={feed.searchQuery} topic={activeTag?.name ?? null} onClear={feed.clearFilters} />
          ) : (
            <>
              <div className="@container mt-6 sm:mt-8">
                {/* One cover per row on phones; two from 600px, where two-column titles
                    stay at about two lines (narrower, most need three or four);
                    three from 1024px, capped like the homepage. While a new search
                    is on its way the previous results stay, quietly dimmed. */}
                <ul
                  aria-busy={results.status === "loading" || feed.loadingMore}
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

              {feed.hasMore || feed.loadingMore ? (
                <LoadMore
                  shown={results.items.length}
                  total={results.total}
                  singular="analysis"
                  plural="analyses"
                  label="Load More Analysis"
                  loading={feed.loadingMore}
                  failed={feed.moreFailed}
                  failedMessage="More analyses couldn’t be loaded. Please try again."
                  onLoadMore={feed.loadMore}
                  buttonRef={feed.loadMoreRef}
                />
              ) : null}
            </>
          )}
        </Container>
      </section>

      {viewerContent && openSlug ? <AnalysisViewer key={openSlug} content={viewerContent} onClose={close} /> : null}
    </>
  );
}
