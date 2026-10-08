import Link from "next/link";
import { Container } from "@/components/site/primitives";
import { SITE } from "@/lib/site";
import { SiteNav } from "./site-nav";

/**
 * Public header: lowercase text wordmark (no logo asset exists yet) linking
 * home, and the two primary destinations. Black, so it runs straight into
 * the black editorial heroes of Home / Analysis / Case Studies. Not sticky:
 * pages are reading-first and there are only two destinations.
 */
export function SiteHeader({ markCurrent = true }: { markCurrent?: boolean }) {
  return (
    <header className="on-dark bg-black text-white">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="-ml-1 inline-flex min-h-11 items-center px-1 text-[1.375rem] leading-none font-extrabold tracking-[-0.03em] sm:text-2xl"
        >
          {SITE.name}
          <span className="sr-only"> — home</span>
        </Link>
        <SiteNav markCurrent={markCurrent} />
      </Container>
    </header>
  );
}
