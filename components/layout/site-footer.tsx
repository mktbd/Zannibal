import Link from "next/link";
import { Container } from "@/components/site/primitives";
import { PRIMARY_NAV, SITE } from "@/lib/site";

const footerLink = "inline-flex min-h-11 items-center text-white/70 transition-colors hover:text-white";

/**
 * Lean footer: wordmark, the two destinations, LinkedIn, copyright --
 * nothing else (spec section 3). LinkedIn appears only once SITE.linkedinUrl
 * is set; no guessed URL is ever rendered.
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
              {SITE.linkedinUrl ? (
                <li>
                  <a href={SITE.linkedinUrl} target="_blank" rel="noopener noreferrer" className={footerLink}>
                    LinkedIn
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>
        <p className="pt-6 text-xs text-white/60">© {year} mktbd</p>
      </Container>
    </footer>
  );
}
