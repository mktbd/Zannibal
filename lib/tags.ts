/**
 * Tag name helpers shared by the Admin tag actions.
 *
 * The database is the source of truth for duplicate detection: tags has a
 * generated normalized_name column (lowercased, btrim'd, internal
 * whitespace collapsed) with a unique constraint -- see
 * supabase/migrations/20261003000003_tags.sql. These helpers only tidy
 * input before it is written, and mirror that expression so the UI can
 * name the existing tag a conflicting create/rename collided with.
 */

export const TAG_NAME_MAX_LENGTH = 60;

/** Display form stored in tags.name: trimmed, internal whitespace collapsed. */
export function cleanTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Mirrors tags.normalized_name. For a name already passed through
 * cleanTagName() this is exactly what Postgres computes.
 */
export function normalizeTagName(raw: string): string {
  return cleanTagName(raw).toLowerCase();
}

/** Returns an error message, or null if the cleaned name is acceptable. */
export function validateTagName(cleaned: string): string | null {
  if (cleaned === "") {
    return "Enter a tag name.";
  }
  if (cleaned.length > TAG_NAME_MAX_LENGTH) {
    return `Tag names can be at most ${TAG_NAME_MAX_LENGTH} characters.`;
  }
  return null;
}
