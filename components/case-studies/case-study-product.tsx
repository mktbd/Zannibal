import Link from "next/link";
import { Container, Eyebrow } from "@/components/site/primitives";
import { formatBdt, formatMonthYear } from "@/lib/format";
import { descriptionParagraphs } from "@/lib/case-study-archive";
import type { CaseStudyDetail } from "@/lib/data/case-studies";
import { CaseStudyCover } from "./case-study-cover";

const COVER_SIZES = "(min-width: 1280px) 448px, (min-width: 1024px) 416px, (min-width: 640px) 384px, 320px";

/**
 * Title size on a fluid scale that steps down for unusually long titles,
 * so a 120-character title stays strong without taking over the product
 * column. Titles up to 60 characters (the norm) keep the full scale.
 */
function titleSize(title: string): string {
  if (title.length > 100) return "text-[clamp(1.625rem,1.4rem+0.9vw,2.125rem)]";
  if (title.length > 60) return "text-[clamp(1.75rem,1.45rem+1.3vw,2.5rem)]";
  return "text-[clamp(1.875rem,1.45rem+1.9vw,3rem)]";
}

/** Two-column editorial frame shared by the opening section and the sections below it. */
const columns = "lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] xl:gap-x-24";

/**
 * A Case Study's public product page: cover on the left; on the right the
 * eyebrow, title, short description, price, the Buy CTA and the product
 * metadata; then the Product Description and Related Topics, aligned with
 * the text column. Phones stack it in reading order: cover, title, price,
 * CTA, metadata (two columns at every width), description, topics.
 *
 * Everything is plain text from the CMS rendered as React text nodes --
 * nothing is interpreted as HTML.
 */
export function CaseStudyProduct({ caseStudy }: { caseStudy: CaseStudyDetail }) {
  const paragraphs = descriptionParagraphs(caseStudy.productDescription);
  const details: [string, string][] = [];
  if (caseStudy.industry) details.push(["Industry", caseStudy.industry]);
  if (caseStudy.pageCount) details.push(["Pages", String(caseStudy.pageCount)]);
  details.push(["Publication Date", formatMonthYear(caseStudy.publicationDate)]);
  details.push(["Format", caseStudy.format]);

  return (
    <article aria-labelledby="case-study-title" className="bg-off-white">
      <Container className="pt-6 pb-14 sm:pt-8 sm:pb-20 lg:pb-24">
        <p>
          <Link
            href="/case-studies"
            className="group -ml-0.5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-black"
          >
            <span aria-hidden="true" className="inline-block transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            <span className="underline decoration-1 underline-offset-[0.25em] group-hover:decoration-2">Case Studies</span>
          </Link>
        </p>

        <div className={`mt-4 sm:mt-6 ${columns}`}>
          <div className="w-full max-w-[20rem] sm:max-w-[24rem] lg:max-w-none">
            <CaseStudyCover src={caseStudy.coverUrl} title={caseStudy.title} sizes={COVER_SIZES} preload />
          </div>

          <div className="mt-9 min-w-0 lg:mt-0 lg:pt-2">
            <Eyebrow marker className="text-muted">
              Case Study
            </Eyebrow>
            <h1
              id="case-study-title"
              className={`mt-4 max-w-[24ch] leading-[1.06] font-extrabold tracking-[-0.02em] text-balance break-words ${titleSize(caseStudy.title)}`}
            >
              {caseStudy.title}
            </h1>
            {caseStudy.shortDescription ? (
              <p className="mt-5 max-w-[56ch] text-lede text-muted">{caseStudy.shortDescription}</p>
            ) : null}

            <div className="mt-8 border-t border-black/15 pt-7">
              <p className="text-2xl font-semibold tabular-nums sm:text-[1.75rem]">
                <span className="sr-only">Price: </span>
                {formatBdt(caseStudy.priceBdt)}
              </p>
              {/* Purchasing is connected in Stage 4E. Until then the CTA is final
                  in appearance but does nothing: no handler, no form, no order,
                  no request. aria-disabled keeps it focusable and announced as
                  unavailable; the visually hidden note says so in words. */}
              <button
                type="button"
                aria-disabled="true"
                aria-describedby="buy-case-study-note"
                className="mt-5 inline-flex min-h-12 w-full cursor-default items-center justify-center rounded-sm bg-black px-8 text-sm font-semibold tracking-[0.12em] text-white uppercase sm:w-auto sm:min-w-64"
              >
                Buy Case Study
              </button>
              <span id="buy-case-study-note" className="sr-only">
                Not available yet.
              </span>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-black/15 pt-7 sm:gap-x-10">
              {details.map(([term, value]) => (
                <div key={term} className="min-w-0">
                  <dt className="text-xs font-medium tracking-[0.14em] break-words text-muted uppercase">{term}</dt>
                  <dd className="mt-1.5 font-medium break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {paragraphs.length ? (
          <section aria-labelledby="product-description-heading" className={`mt-14 border-t border-black/15 pt-8 sm:mt-20 sm:pt-10 ${columns}`}>
            <h2 id="product-description-heading" className="text-xs font-semibold tracking-[0.14em] uppercase">
              Product Description
            </h2>
            <div className="mt-5 max-w-[65ch] space-y-5 text-[1.0625rem] leading-[1.7] break-words whitespace-pre-line lg:mt-0">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        ) : null}

        {caseStudy.tags.length ? (
          <section aria-labelledby="related-topics-heading" className={`mt-12 border-t border-black/15 pt-8 sm:mt-16 sm:pt-10 ${columns}`}>
            <h2 id="related-topics-heading" className="text-xs font-semibold tracking-[0.14em] uppercase">
              Related Topics
            </h2>
            {/* Plain metadata, not links: the catalogue's topic filter lives in
                page state (no URL parameter), so there is no clean target. */}
            <ul className="mt-5 flex max-w-[65ch] flex-wrap gap-x-3 gap-y-2 lg:mt-0">
              {caseStudy.tags.map((tag, index) => (
                <li key={tag.id} className="font-medium">
                  {tag.name}
                  {index < caseStudy.tags.length - 1 ? (
                    <span aria-hidden="true" className="ml-3 text-muted">
                      ·
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </article>
  );
}
