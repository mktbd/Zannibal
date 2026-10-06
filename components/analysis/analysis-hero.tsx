import { Container, Eyebrow } from "@/components/site/primitives";

export const ANALYSIS_DESCRIPTION =
  "Visual breakdowns of the strategies, decisions and market dynamics shaping businesses in Bangladesh.";

/** Compact black masthead for /analysis -- deliberately shorter than the homepage hero, no image. */
export function AnalysisHero() {
  return (
    <section aria-labelledby="analysis-heading" className="on-dark bg-black text-white">
      <Container className="pt-12 pb-12 sm:pt-16 sm:pb-14 lg:pt-20 lg:pb-16">
        <Eyebrow marker className="text-white/60">
          Analysis
        </Eyebrow>
        {/* Two phrases, each kept whole where it fits: "How Businesses" /
            "Grow in Bangladesh." (below ~340px the second wraps inside itself,
            never leaving "Grow" alone on a line). */}
        <h1 id="analysis-heading" className="mt-5 text-headline font-extrabold">
          <span className="inline-block">How Businesses</span> <span className="inline-block">Grow in Bangladesh.</span>
        </h1>
        <p className="mt-5 max-w-[52ch] text-lede text-white/75">{ANALYSIS_DESCRIPTION}</p>
      </Container>
    </section>
  );
}
