import { Container, Eyebrow, TextLink } from "@/components/site/primitives";

/** Public 404 for an /analysis/[slug] that doesn't exist or isn't published. */
export default function AnalysisNotFound() {
  return (
    <section className="bg-off-white py-20 sm:py-24">
      <Container>
        <Eyebrow marker className="text-muted">
          Analysis
        </Eyebrow>
        <h1 className="mt-5 max-w-[22ch] text-headline font-extrabold text-balance">This analysis isn’t available.</h1>
        <p className="mt-5 max-w-[48ch] text-lede text-muted">The link may be mistyped or out of date.</p>
        <p className="mt-8">
          <TextLink href="/analysis" arrow>
            Browse all analysis
          </TextLink>
        </p>
      </Container>
    </section>
  );
}
