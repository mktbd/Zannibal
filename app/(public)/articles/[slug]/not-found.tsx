import { Container, Eyebrow, TextLink } from "@/components/site/primitives";

/** Public 404 for an /articles/[slug] that doesn't exist or isn't published. */
export default function ArticleNotFound() {
  return (
    <section className="bg-off-white py-20 sm:py-24">
      <Container>
        <Eyebrow marker className="text-muted">
          Articles
        </Eyebrow>
        <h1 className="mt-5 max-w-[22ch] text-headline font-extrabold text-balance">This article isn’t available.</h1>
        <p className="mt-5 max-w-[48ch] text-lede text-muted">The link may be mistyped or out of date.</p>
        <p className="mt-8">
          <TextLink href="/articles" arrow>
            Browse all articles
          </TextLink>
        </p>
      </Container>
    </section>
  );
}
