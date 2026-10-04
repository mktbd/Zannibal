/**
 * Slug helpers shared by the Analysis and Case Study editors (client) and
 * their Server Actions (server). The database enforces the same format
 * (analyses_slug_format / case_studies_slug_format) and uniqueness
 * (analyses_slug_key / case_studies_slug_key); these helpers only produce
 * and pre-check values that satisfy it.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 80;

/**
 * Turns arbitrary text (a title, or a hand-typed slug) into a URL-safe
 * slug: lowercase ASCII letters/digits separated by single hyphens.
 * Accents and apostrophes are dropped ("Café", "Grameenphone's" ->
 * "cafe", "grameenphones"), "&" becomes "and".
 */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, "");
}

/** Error message for an already-slugified value, or null if valid. */
export function validateSlug(slug: string): string | null {
  if (slug === "") {
    return "Enter a slug (letters and numbers separated by hyphens).";
  }
  if (!SLUG_PATTERN.test(slug)) {
    return "Use lowercase letters and numbers separated by single hyphens.";
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return `Slugs can be at most ${SLUG_MAX_LENGTH} characters.`;
  }
  return null;
}
