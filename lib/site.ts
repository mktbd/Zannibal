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
 * Homepage hero image: public/images/home-hero.jpg, the approved photograph
 * (Pexels photo 34114910 by roktim619): a fruit vendor at a lit
 * night-market stall, the vendor a little left of centre. A 2048x1365
 * JPEG (~570 KB, quality 90) resized from the 6000x4000 original, with no
 * other change: same 3:2 frame, colours and lighting. The Cloudflare build
 * serves local images as is (no resizing), so keep it about this size. HeroVisual crops it with object-cover and sets the
 * object-position that keeps the vendor and stall in frame; the fade into
 * the black copy side is applied in CSS there too.
 *
 * To change it: put the new file in public/images/, set
 *   { src: "/images/<file>.jpg", alt: "<what the photo shows>" }
 * and re-check that object-position at desktop and mobile widths.
 * `placeholder: true` captions a temporary stand-in "Placeholder image";
 * null falls back to a plain hatched panel.
 */
export const HERO_IMAGE: { src: string; alt: string; placeholder?: boolean } | null = {
  src: "/images/home-hero.jpg",
  alt: "A fruit vendor sorts bananas at a lit night market stall in Bangladesh, with watermelons, papayas and pomegranates stacked behind him.",
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
