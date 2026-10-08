import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/**
 * The public page frame: skip link, header, <main>, footer. Used by the
 * (public) layout and by the site-wide 404 (app/not-found.tsx), which
 * renders outside that layout. <main> carries the off-white page ground so
 * short pages (404s, unavailable states) never show a white band above the
 * footer. `markCurrent={false}` keeps the header from marking a section as
 * current (the site-wide 404).
 */
export function PublicShell({ children, markCurrent = true }: { children: React.ReactNode; markCurrent?: boolean }) {
  return (
    <div className="site flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 bg-white px-3 py-2 text-sm font-medium text-black focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <SiteHeader markCurrent={markCurrent} />
      <main id="main" tabIndex={-1} className="flex-1 bg-off-white outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
