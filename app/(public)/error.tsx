"use client";

import { Container, Eyebrow, TextLink } from "@/components/site/primitives";

/**
 * Public error state: a page's data couldn't be loaded (e.g. the database
 * was unreachable). Deliberately not a 404 -- the content may well exist --
 * and never shows error details. Renders inside the public layout, so the
 * header and footer stay.
 */
export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <Eyebrow marker className="text-muted">
          Something went wrong
        </Eyebrow>
        <h1 className="mt-5 max-w-[22ch] text-headline font-extrabold text-balance">This page couldn’t be loaded.</h1>
        <p className="mt-5 max-w-[48ch] text-lede text-muted">Please try again in a moment.</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center font-medium underline decoration-1 underline-offset-[0.2em] hover:decoration-2"
          >
            Try again
          </button>
          <TextLink href="/" arrow>
            Go to the homepage
          </TextLink>
        </div>
      </Container>
    </section>
  );
}
