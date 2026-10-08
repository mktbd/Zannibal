/**
 * Site-wide public identity. One place for values the header, footer and
 * metadata share, so later pages don't hard-code them.
 */
export const SITE = {
  name: "mktbd",
  tagline: "mktbd breaks down how businesses grow in Bangladesh.",
  /**
   * Public contact address for "Co-Build Your Story" (homepage mailto).
   * The intended production address; the homepage hides the link if this
   * is ever set back to null.
   */
  contactEmail: "collaborate@mktbd.co" as string | null,
} as const;

/**
 * Homepage hero image. No approved photograph exists yet, so this points at
 * a TEMPORARY placeholder (public/images/hero-placeholder.jpg: a
 * procedurally rendered, out-of-focus night-market scene -- not a real
 * photo, not stock, not AI-generated) used only to judge crop, balance,
 * fade and contrast. `placeholder: true` adds a small "Placeholder image"
 * caption.
 *
 * To swap in the approved image: put it in public/images/ (e.g.
 * home-hero.jpg, ideally >= 1600px wide, subject centre-right), set
 *   { src: "/images/home-hero.jpg", alt: "<what the photo shows>" }
 * and delete hero-placeholder.jpg. Set null to fall back to the plain
 * hatched panel. The fade into the black copy side is applied in CSS by
 * HeroVisual.
 */
export const HERO_IMAGE: { src: string; alt: string; placeholder?: boolean } | null = {
  src: "/images/hero-placeholder.jpg",
  alt: "Placeholder image: an out-of-focus market street at dusk, with lit stalls and passers-by",
  placeholder: true,
};

/**
 * mktbd's official social channels (confirmed by mktbd; Stage 4F), shown as
 * text links in the footer. Add a platform here only once its official URL
 * is provided -- never a guessed one.
 */
export const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61589364071130" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/mktbd/" },
  { label: "Instagram", href: "https://www.instagram.com/mktbd_?stkn=Mzl2NHZxZ3A5bTVz" },
] as const;

/** The only two primary public destinations (no "Home" item; the wordmark links home). */
export const PRIMARY_NAV = [
  { href: "/analysis", label: "Analysis" },
  { href: "/case-studies", label: "Case Studies" },
] as const;

/**
 * Footer destinations: the primary two plus Articles, which is linked from
 * the footer only -- never the header (MKTBD_SPEC.md section 2).
 */
export const FOOTER_NAV = [...PRIMARY_NAV, { href: "/articles", label: "Articles" }] as const;
