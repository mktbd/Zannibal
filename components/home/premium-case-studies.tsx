import { Container, Eyebrow, Highlight, TextLink } from "@/components/site/primitives";

/**
 * Editorial intermission introducing the paid Case Studies product. Not a
 * listing: no prices, products or purchase UI (spec section 3).
 */
export function PremiumCaseStudies() {
  return (
    <section aria-labelledby="premium-heading" className="on-dark bg-black py-20 text-white sm:py-24 lg:py-32">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
        <div>
          <Eyebrow marker className="text-white/60">
            Premium Case Studies
          </Eyebrow>
          <h2 id="premium-heading" className="mt-5 text-headline font-extrabold text-balance">
            Dive Deeper with Our <Highlight>Premium</Highlight> Case Studies.
          </h2>
        </div>
        <div className="border-t border-white/20 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <p className="max-w-[44ch] text-lede text-white/75">
            Go beyond the carousel with deeper research into the strategies, economics and decisions behind businesses
            in Bangladesh.
          </p>
          <p className="mt-6">
            <TextLink href="/case-studies" arrow className="text-white">
              Explore Case Studies
            </TextLink>
          </p>
        </div>
      </Container>
    </section>
  );
}
