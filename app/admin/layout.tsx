import type { Metadata } from "next";

/**
 * Every /admin page (login included) is private: never indexed or followed
 * by search engines. Access itself is enforced by requireAdmin() and RLS,
 * not by this; next.config.ts also sends X-Robots-Tag for /admin.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
