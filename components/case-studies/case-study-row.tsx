import Link from "next/link";
import { formatBdt, formatMonthYear } from "@/lib/format";
import type { CaseStudyListItem } from "@/lib/case-study-archive";
import { CaseStudyCover } from "./case-study-cover";

const COVER_SIZES = "(min-width: 1024px) 176px, (min-width: 640px) 144px, 72px";

/**
 * One catalogue entry: an editorial index row, not a product card. Cover
 * on the left as a supporting visual; on the right a quiet topic line, the
 * title, the short description, then publication month, price and "Dive In".
 * "Dive In" is the row's single link (its accessible name includes the
 * title) and stretches over the whole row, so the entire entry is
 * clickable with one tab stop. Rows are separated by hairline rules.
 *
 * Phones: a small cover with the topic line beside it, then the title,
 * description and meta line each running the full row width -- so long
 * titles are never squeezed into a narrow column. Still a list, never a grid.
 */
export function CaseStudyRow({ caseStudy, preload = false }: { caseStudy: CaseStudyListItem; preload?: boolean }) {
  const topics = caseStudy.topics.slice(0, 2);
  const moreTopics = caseStudy.topics.length - topics.length;
  return (
    <article className="group relative grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 py-7 sm:grid-cols-[9rem_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-7 sm:gap-y-3 sm:py-9 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-x-10">
      <div className="sm:row-span-2">
        <CaseStudyCover src={caseStudy.coverUrl} title={caseStudy.title} sizes={COVER_SIZES} preload={preload} />
      </div>
      {/* Phones: this wrapper dissolves (display: contents) so the topic line
          sits beside the small cover and the title runs the full row width
          beneath them. From sm it is the right-hand column's first cell. */}
      <div className="contents sm:block sm:min-w-0 sm:self-start">
        {topics.length ? (
          <p className="line-clamp-3 min-w-0 self-end text-xs leading-normal font-medium tracking-[0.14em] text-muted uppercase sm:line-clamp-2">
            {topics.join(" · ")}
            {moreTopics > 0 ? <span className="tracking-normal normal-case"> +{moreTopics}</span> : null}
          </p>
        ) : null}
        <h3 className="col-span-2 text-xl leading-tight font-bold text-pretty break-words sm:text-balance group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:mt-2 sm:text-2xl lg:text-[1.75rem]">
          {caseStudy.title}
        </h3>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
        {caseStudy.shortDescription ? (
          <p className="line-clamp-3 max-w-[62ch] leading-relaxed text-muted">{caseStudy.shortDescription}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 sm:mt-5">
          <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="text-base font-semibold tabular-nums">{formatBdt(caseStudy.priceBdt)}</span>
            <span className="text-sm text-muted">
              <span className="sr-only">Published </span>
              {formatMonthYear(caseStudy.publicationDate)}
            </span>
          </p>
          <Link
            href={`/case-studies/${caseStudy.slug}`}
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1.5 font-medium after:absolute after:inset-0 after:content-['']"
          >
            <span className="underline decoration-1 underline-offset-[0.25em] group-hover:decoration-2">Dive In</span>
            <span className="sr-only">: {caseStudy.title}</span>
            <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}
