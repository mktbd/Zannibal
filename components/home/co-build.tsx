import { Container, Eyebrow, TextLink } from "@/components/site/primitives";
import { SITE } from "@/lib/site";

/**
 * Invitation to businesses to co-build a case study, answered by email
 * (no Contact page, no form -- spec section 3). Laid out and spaced like
 * PremiumCaseStudies so the two read as equally weighted propositions.
 * The mailto link appears only while SITE.contactEmail is set.
 */
export function CoBuild() {
  return (
    <section aria-labelledby="cobuild-heading" className="bg-off-white py-20 sm:py-24 lg:py-32">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
        <div>
          <Eyebrow marker className="text-muted">
            {/* The brand name stays lowercase even inside an uppercase label. */}
            Work with <span className="normal-case tracking-normal">mktbd</span>
          </Eyebrow>
          <h2 id="cobuild-heading" className="mt-5 text-headline font-extrabold text-balance">
            Have a Story Worth Breaking Down?
          </h2>
        </div>
        <div className="border-t border-black/15 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <p className="max-w-[44ch] text-lede text-muted">
            If your business is building something worth understanding, we’d like to hear the story behind it.
          </p>
          {SITE.contactEmail ? (
            <p className="mt-6">
              <TextLink href={`mailto:${SITE.contactEmail}`} arrow>
                Collaborate with us
              </TextLink>
            </p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
