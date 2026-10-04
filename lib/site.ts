/**
 * Site-wide public identity. One place for values the header, footer and
 * metadata share, so later pages don't hard-code them.
 */
export const SITE = {
  name: "mktbd",
  tagline: "mktbd breaks down how businesses grow in Bangladesh.",
  /**
   * mktbd's LinkedIn page. Not yet provided -- deliberately null rather
   * than a guessed URL. The footer shows the LinkedIn link only once this
   * is set (e.g. "https://www.linkedin.com/company/<handle>/").
   */
  linkedinUrl: null as string | null,
} as const;

/** The only two primary public destinations (no "Home" item; the wordmark links home). */
export const PRIMARY_NAV = [
  { href: "/analysis", label: "Analysis" },
  { href: "/case-studies", label: "Case Studies" },
] as const;
