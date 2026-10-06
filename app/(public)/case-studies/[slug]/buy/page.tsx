import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Eyebrow } from "@/components/site/primitives";
import { CaseStudyCover } from "@/components/case-studies/case-study-cover";
import { PurchaseFlow } from "@/components/case-studies/purchase-flow";
import { getPublishedCaseStudy } from "@/lib/data/case-studies";
import { getBkashPaymentNumber } from "@/lib/payment";
import { formatMobileNumber } from "@/lib/order-input";
import { formatBdt } from "@/lib/format";
import { SITE } from "@/lib/site";

// Rendered per request: the price and the receiving bKash number shown here
// must always be the current ones (POST /api/orders re-checks the price).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = await getPublishedCaseStudy(slug);
  if (!caseStudy) return { title: "Case study not found", robots: { index: false } };
  // A purchase step, not content: kept out of search results.
  return { title: `Buy “${caseStudy.title}”`, robots: { index: false, follow: false } };
}

function titleSize(title: string): string {
  if (title.length > 100) return "text-[clamp(1.375rem,1.3rem+0.3vw,1.5rem)]";
  if (title.length > 60) return "text-[clamp(1.5rem,1.4rem+0.4vw,1.75rem)]";
  return "text-[clamp(1.625rem,1.45rem+0.6vw,2rem)]";
}

/**
 * /case-studies/[slug]/buy -- the manual bKash purchase page for one
 * published Case Study: what is being bought (cover, title, trusted
 * price), how to pay, and the form that records the payment as a Pending
 * order. Unknown, draft and deleted slugs get the Case Study 404.
 */
export default async function BuyCaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const caseStudy = await getPublishedCaseStudy(slug);
  if (!caseStudy) notFound();
  const paymentNumber = getBkashPaymentNumber();
  const price = formatBdt(caseStudy.priceBdt);

  const instructions = (
    <section aria-labelledby="pay-with-bkash-heading">
      <div>
        <h2 id="pay-with-bkash-heading" className="text-xs font-semibold tracking-[0.14em] uppercase">
          <span className="mr-2 text-muted tabular-nums">1</span>Pay with bKash
        </h2>
        <div className="mt-5">
          {paymentNumber ? (
            <>
              <ol className="space-y-4">
                <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
                  <span aria-hidden="true" className="text-muted tabular-nums">1.</span>
                  <span>
                    Open bKash and choose <strong className="font-semibold">Send Money</strong>.
                  </span>
                </li>
                <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
                  <span aria-hidden="true" className="text-muted tabular-nums">2.</span>
                  <span>
                    Send exactly <strong className="font-semibold whitespace-nowrap tabular-nums">{price}</strong> to mktbd’s
                    bKash number:
                    <span className="mt-2 block text-2xl font-semibold tracking-wide tabular-nums select-all sm:text-[1.75rem]">
                      {formatMobileNumber(paymentNumber)}
                    </span>
                  </span>
                </li>
                <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
                  <span aria-hidden="true" className="text-muted tabular-nums">3.</span>
                  <span>
                    Keep the <strong className="font-semibold">Transaction ID</strong> from bKash’s confirmation.
                  </span>
                </li>
                <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
                  <span aria-hidden="true" className="text-muted tabular-nums">4.</span>
                  <span>Submit your details below.</span>
                </li>
              </ol>
              <p className="mt-6 flex gap-2.5 border-t border-black/10 pt-5 text-sm leading-relaxed">
                <span aria-hidden="true" className="mt-1.5 inline-block size-2 shrink-0 bg-accent-yellow" />
                <span>
                  <strong className="font-semibold">Never share your bKash PIN or OTP.</strong> mktbd will never ask for
                  them, and this page doesn’t either.
                </span>
              </p>
            </>
          ) : (
            <p className="text-lede text-muted">
              Online ordering is paused at the moment. Please check back soon.
            </p>
          )}
        </div>
      </div>
    </section>
  );

  return (
    <article aria-labelledby="buy-title" className="bg-off-white">
      <Container className="pt-6 pb-16 sm:pt-8 sm:pb-24">
        <p>
          <Link
            href={`/case-studies/${caseStudy.slug}`}
            className="group -ml-0.5 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-black"
          >
            <span aria-hidden="true" className="inline-block transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            <span className="underline decoration-1 underline-offset-[0.25em] group-hover:decoration-2">Case Study</span>
          </Link>
        </p>

        {/* Phones/tablets: a compact product header above the steps. Desktop:
            the product stays in a sticky left column beside the steps. */}
        <div className="mt-4 sm:mt-6 lg:grid lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-x-16 xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:gap-x-24">
          <header className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-8 lg:sticky lg:top-8 lg:block lg:self-start">
            <div className="lg:max-w-[13rem]">
              <CaseStudyCover
                src={caseStudy.coverUrl}
                title={caseStudy.title}
                sizes="(min-width: 1024px) 208px, (min-width: 640px) 112px, 72px"
                preload
              />
            </div>
            <div className="min-w-0 lg:mt-7">
              <Eyebrow marker className="text-muted">
                Case Study
              </Eyebrow>
              <h1
                id="buy-title"
                className={`mt-3 max-w-[30ch] leading-[1.1] font-extrabold tracking-[-0.015em] text-balance break-words ${titleSize(caseStudy.title)}`}
              >
                {caseStudy.title}
              </h1>
              <p className="mt-3 text-xl font-semibold tabular-nums sm:text-2xl">
                <span className="sr-only">Price: </span>
                {price}
              </p>
            </div>
          </header>

          <div className="mt-10 max-w-[36rem] min-w-0 border-t border-black/15 pt-8 sm:mt-12 sm:pt-10 lg:mt-0 lg:border-0 lg:pt-1">
            {paymentNumber ? (
              <PurchaseFlow
                slug={caseStudy.slug}
                priceBdt={caseStudy.priceBdt}
                instructions={instructions}
                contactEmail={SITE.contactEmail}
              />
            ) : (
              instructions
            )}
          </div>
        </div>
      </Container>
    </article>
  );
}
