import { Container, Eyebrow } from "@/components/site/primitives";

export const ARTICLES_DESCRIPTION =
  "In-depth analysis of the strategies, decisions and market dynamics shaping businesses in Bangladesh.";

/** Compact black masthead for /articles -- the same language as /analysis and /case-studies. */
export function ArticlesHero() {
  return (
    <section aria-labelledby="articles-heading" className="on-dark bg-black text-white">
      <Container className="pt-12 pb-12 sm:pt-16 sm:pb-14 lg:pt-20 lg:pb-16">
        <Eyebrow marker className="text-white/60">
          Articles
        </Eyebrow>
        <h1 id="articles-heading" className="mt-5 text-headline font-extrabold">
          {/* Two phrases, each kept whole where it fits: "The Business Behind" /
              "the Headlines." -- never a stranded word on narrow screens. */}
          <span className="inline-block">The Business Behind</span> <span className="inline-block">the Headlines.</span>
        </h1>
        <p className="mt-5 max-w-[52ch] text-lede text-white/75">{ARTICLES_DESCRIPTION}</p>
      </Container>
    </section>
  );
}
