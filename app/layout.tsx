import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { SITE } from "@/lib/site";
import { INDEXABLE, SITE_ORIGIN } from "@/lib/seo-config";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  // Every relative canonical / Open Graph URL resolves against the
  // canonical origin (SITE_URL, default https://mktbd.co) -- never the
  // host a page happened to be requested on.
  metadataBase: new URL(SITE_ORIGIN),
  // Non-production deployments (Vercel previews): noindex everywhere.
  // Pages that set their own robots (admin, 404s, purchase) are noindex
  // already; public pages set none and inherit this.
  ...(INDEXABLE ? {} : { robots: { index: false, follow: false } }),
  title: "mktbd",
  description: SITE.tagline,
  applicationName: SITE.name,
  openGraph: {
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.tagline,
    type: "website",
    locale: "en_BD",
  },
  twitter: {
    card: "summary",
    title: SITE.name,
    description: SITE.tagline,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variable must be on <html>: Tailwind resolves --font-sans at
    // :root, so a variable defined only on <body> would never reach it and
    // every page would silently fall back to the system font stack.
    <html lang="en" className={figtree.variable}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
