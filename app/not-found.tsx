import type { Metadata } from "next";
import { PublicShell } from "@/components/layout/public-shell";
import { Container, Eyebrow, TextLink } from "@/components/site/primitives";

// Next marks not-found responses noindex itself; only the title is set here.
export const metadata: Metadata = {
  title: "Page not found | mktbd",
};

/**
 * Site-wide 404 for any URL no route matches (e.g. /no-such-page). It sits
 * outside the (public) layout, so it brings the public frame itself. Unknown
 * Analysis and Case Study slugs keep their own section 404s (with their
 * section current); this page marks no section current -- an unmatched URL
 * like /case-studies/x/y belongs to no section even if it starts like one.
 */
export default function NotFound() {
  return (
    <PublicShell markCurrent={false}>
      <section className="py-20 sm:py-24">
        <Container>
          <Eyebrow marker className="text-muted">
            Page not found
          </Eyebrow>
          <h1 className="mt-5 max-w-[22ch] text-headline font-extrabold text-balance">This page isn’t available.</h1>
          <p className="mt-5 max-w-[48ch] text-lede text-muted">The link may be mistyped or out of date.</p>
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-2">
            <li>
              <TextLink href="/analysis" arrow>
                Browse Analysis
              </TextLink>
            </li>
            <li>
              <TextLink href="/case-studies" arrow>
                Browse Case Studies
              </TextLink>
            </li>
          </ul>
        </Container>
      </section>
    </PublicShell>
  );
}
