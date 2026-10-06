import { Container, Eyebrow, TextLink } from "@/components/site/primitives";

/** Public 404 for a /case-studies/[slug] that doesn't exist or isn't published. */
export default function CaseStudyNotFound() {
  return (
    <section className="bg-off-white py-20 sm:py-24">
      <Container>
        <Eyebrow marker className="text-muted">
          Case Studies
        </Eyebrow>
        <h1 className="mt-5 max-w-[22ch] text-headline font-extrabold text-balance">This case study isn’t available.</h1>
        <p className="mt-5 max-w-[48ch] text-lede text-muted">The link may be mistyped or out of date.</p>
        <p className="mt-8">
          <TextLink href="/case-studies" arrow>
            Browse all case studies
          </TextLink>
        </p>
      </Container>
    </section>
  );
}
