"use client";

import { Container } from "@/components/site/primitives";
import { DiscoveryControls } from "@/components/archive/discovery-controls";
import { LoadMore, NoResults, ResultsError } from "@/components/archive/results-states";
import { useArchiveFeed } from "@/components/archive/use-archive-feed";
import type { ArchiveTag } from "@/lib/archive-core";
import type { CaseStudyListItem, CaseStudyPage } from "@/lib/case-study-archive";
import { CaseStudyRow } from "./case-study-row";

/**
 * The /case-studies catalogue: search, Topics, an editorial list of Case
 * Studies and Load More. The page arrives with the first 12; search (title,
 * short description, topics) and topics query the whole published catalogue
 * through /api/case-studies, and Load More appends the next 12 -- using the
 * same race-safe feed state as the Analysis archive (useArchiveFeed).
 */
export function CaseStudyCatalogue({
  initialPage,
  tags,
  loadError,
}: {
  initialPage: CaseStudyPage;
  tags: ArchiveTag[];
  loadError: boolean;
}) {
  const feed = useArchiveFeed<CaseStudyListItem>({
    endpoint: "/api/case-studies",
    initialPage,
    itemLinkSelector: "[data-case-study] a",
  });
  const { results } = feed;
  const activeTag = tags.find((tag) => tag.id === feed.tagId) ?? null;
  const count = (n: number) => `${n} ${n === 1 ? "case study" : "case studies"}`;

  if (loadError || initialPage.total === 0) {
    return (
      <section aria-label="Case studies" className="bg-off-white py-16 sm:py-20">
        <Container>
          <p className="max-w-[44ch] text-lede text-muted">
            {loadError
              ? "The case study catalogue couldn’t be loaded right now. Please try again in a moment."
              : "New case studies are in preparation."}
          </p>
        </Container>
      </section>
    );
  }

  return (
    <section aria-labelledby="case-studies-results-heading" className="bg-off-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pb-24">
      <Container>
        <DiscoveryControls
          searchLabel="Search case studies"
          placeholder="Title, subject or topic"
          query={feed.query}
          onQueryChange={feed.setQuery}
          tags={tags}
          tagId={feed.tagId}
          onTagChange={feed.setTagId}
        />

        <h2 id="case-studies-results-heading" tabIndex={-1} className="sr-only">
          Case studies
        </h2>
        {/* Announces result changes; shown as a quiet count only while filtering. */}
        <p aria-live="polite" className={feed.filtering && results.status === "ready" && results.total > 0 ? "mt-5 text-sm text-muted" : "sr-only"}>
          {results.status === "loading"
            ? ""
            : results.status === "error"
              ? "Results couldn’t be loaded."
              : results.total === 0
                ? "No case studies match."
                : `${count(results.total)}${feed.filtering ? "" : " published"}`}
        </p>

        {results.status === "error" ? (
          <ResultsError onRetry={feed.retry} />
        ) : results.status === "ready" && results.items.length === 0 ? (
          <NoResults noun="case studies" query={feed.searchQuery} topic={activeTag?.name ?? null} onClear={feed.clearFilters} />
        ) : (
          <>
            {/* While a new search is on its way the previous results stay, quietly dimmed. */}
            <ul
              aria-busy={results.status === "loading" || feed.loadingMore}
              className={`mt-2 divide-y divide-black/15 border-b border-black/15 transition-opacity sm:mt-4 ${results.status === "loading" ? "opacity-50" : ""}`}
            >
              {results.items.map((caseStudy, index) => (
                <li key={caseStudy.id} data-case-study={caseStudy.slug}>
                  <CaseStudyRow caseStudy={caseStudy} preload={index === 0} />
                </li>
              ))}
            </ul>

            {feed.hasMore || feed.loadingMore ? (
              <LoadMore
                shown={results.items.length}
                total={results.total}
                singular="case study"
                plural="case studies"
                label="Load More Case Studies"
                loading={feed.loadingMore}
                failed={feed.moreFailed}
                failedMessage="More case studies couldn’t be loaded. Please try again."
                onLoadMore={feed.loadMore}
                buttonRef={feed.loadMoreRef}
              />
            ) : null}
          </>
        )}
      </Container>
    </section>
  );
}
