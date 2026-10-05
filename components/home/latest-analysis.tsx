import Link from "next/link";
import { Container, SectionHeading, TextLink } from "@/components/site/primitives";
import type { LatestAnalysis as LatestAnalysisItem } from "@/lib/data/home";
import { AnalysisCover } from "./analysis-cover";
import { CoverRow } from "./cover-row";

const COVER_SIZES = "(min-width: 1024px) 352px, (min-width: 640px) 44vw, 78vw";

/**
 * Latest three published Analyses, each shown by its first slide in a tall
 * 9:16 frame with the title over a dark gradient.
 *
 * Layout: below lg a native horizontal scroller (scroll-snap, one card in
 * view with the next peeking in, full-bleed to the screen edges); from lg a
 * three-column row inside the page container, each cover capped at 22rem
 * wide so the row doesn't dominate the page; any spare width goes into the
 * gaps, keeping the outer covers flush with the container. No carousel library;
 * the only script brings a keyboard-focused card fully into view.
 */
export function LatestAnalysis({ analyses }: { analyses: LatestAnalysisItem[] }) {
  return (
    <section aria-labelledby="latest-heading" className="bg-off-white py-16 sm:py-20 lg:py-24">
      <Container>
        <SectionHeading
          id="latest-heading"
          eyebrow="Latest Analysis"
          title="Fresh Breakdowns."
          action={
            <TextLink href="/analysis" arrow>
              View All
            </TextLink>
          }
        />
      </Container>

      {analyses.length === 0 ? (
        <Container>
          <p className="mt-10 max-w-[40ch] text-lede text-muted">New analysis is on the way.</p>
        </Container>
      ) : (
        <CoverRow
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[var(--page-gutter)] px-[var(--page-gutter)] pb-2 [scrollbar-width:none] sm:gap-5 lg:page-container lg:mt-10 lg:grid lg:snap-none lg:grid-cols-[repeat(3,minmax(0,22rem))] lg:justify-between lg:gap-6 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {analyses.map((analysis, index) => (
            <li key={analysis.id} className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
              <Link
                href={`/analysis/${analysis.slug}`}
                className="group relative block aspect-[9/16] overflow-hidden bg-near-black"
              >
                <AnalysisCover src={analysis.coverUrl} title={analysis.title} sizes={COVER_SIZES} preload={index === 0} />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
                />
                <h3 className="absolute inset-x-0 bottom-0 p-5 text-xl leading-tight font-bold text-balance text-white group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-2xl">
                  {analysis.title}
                </h3>
              </Link>
            </li>
          ))}
        </CoverRow>
      )}
    </section>
  );
}
