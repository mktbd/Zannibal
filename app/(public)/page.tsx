import { Container, Eyebrow } from "@/components/site/primitives";

/**
 * TEMPORARY (Prompt 04A): a neutral page for reviewing the public shell.
 * Replaced by the real Homepage (hero, Latest Analysis, Premium Case
 * Studies, Co-Build Your Story) in Prompt 04B.
 */
export default function HomePage() {
  return (
    <Container className="py-20 sm:py-28">
      <Eyebrow marker className="text-muted">
        Temporary preview
      </Eyebrow>
      <h1 className="mt-5 max-w-[16ch] text-display font-extrabold">Public site foundation</h1>
      <p className="mt-6 max-w-[56ch] text-lede text-muted">
        A temporary page for reviewing the shared header, footer and type scale. The homepage replaces it in the
        next stage.
      </p>
    </Container>
  );
}
