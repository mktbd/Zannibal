import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
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
