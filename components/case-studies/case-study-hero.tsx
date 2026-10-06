import { Container, Eyebrow } from "@/components/site/primitives";

export const CASE_STUDIES_DESCRIPTION =
  "Research-led case studies examining the strategies, economics and decisions behind businesses in Bangladesh.";

/** Compact black masthead for /case-studies -- the same language as /analysis, no image, price or purchase copy. */
export function CaseStudyHero() {
  return (
    <section aria-labelledby="case-studies-heading" className="on-dark bg-black text-white">
      <Container className="pt-12 pb-12 sm:pt-16 sm:pb-14 lg:pt-20 lg:pb-16">
        <Eyebrow marker className="text-white/60">
          Case Studies
        </Eyebrow>
        {/* Two phrases, each kept whole where it fits: "Go Deeper Into How" /
            "Businesses Grow." -- never a stranded word on narrow screens. */}
        <h1 id="case-studies-heading" className="mt-5 text-headline font-extrabold">
          <span className="inline-block">Go Deeper Into How</span> <span className="inline-block">Businesses Grow.</span>
        </h1>
        <p className="mt-5 max-w-[52ch] text-lede text-white/75">{CASE_STUDIES_DESCRIPTION}</p>
      </Container>
    </section>
  );
}
