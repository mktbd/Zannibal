import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Public pages set their own titles later; they render as "<title> | mktbd".
export const metadata: Metadata = {
  title: { default: "mktbd", template: "%s | mktbd" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

/**
 * Shell for every public route (/, /analysis, /case-studies and their
 * [slug] pages). /admin has its own layout and never renders inside this.
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="site flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 bg-white px-3 py-2 text-sm font-medium text-black focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
