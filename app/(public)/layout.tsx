import type { Metadata, Viewport } from "next";
import { PublicShell } from "@/components/layout/public-shell";

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
  return <PublicShell>{children}</PublicShell>;
}
