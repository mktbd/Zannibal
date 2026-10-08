import Link from "next/link";
import { Container } from "@/components/site/primitives";
import { PRIMARY_NAV, SITE, SOCIAL_LINKS } from "@/lib/site";

const footerLink = "inline-flex min-h-11 items-center text-white/70 transition-colors hover:text-white";

/**
 * Lean footer: wordmark, the two destinations, the official social
 * channels as plain text links (Facebook · LinkedIn · Instagram, from
 * SOCIAL_LINKS), copyright -- nothing else (spec section 3). Social links
 * open in a new tab and say so to screen readers.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="on-dark bg-black text-white">
      <Container className="py-10 sm:py-12">
        <div className="flex flex-col gap-6 border-b border-white/15 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex min-h-11 w-fit items-center text-xl font-extrabold tracking-[-0.03em]">
            {SITE.name}
            <span className="sr-only"> — home</span>
          </Link>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={footerLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
          <p className="text-xs text-white/60">© {year} mktbd</p>
          <ul aria-label="mktbd on social media" className="flex flex-wrap items-center gap-x-3 text-sm">
            {SOCIAL_LINKS.map((social, index) => (
              <li key={social.href} className="flex items-center gap-x-3">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-white/35">
                    ·
                  </span>
                ) : null}
                <a href={social.href} target="_blank" rel="noopener noreferrer" className={footerLink}>
                  {social.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
