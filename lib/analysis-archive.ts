/**
 * Pure helpers for the public Analysis archive: shaping published rows into
 * index entries, search + topic filtering and paging. The generic pieces
 * (normalisation, matching, paging, de-dup, parameter checks) live in
 * archive-core.ts and are shared with Case Studies. Framework-free, so the
 * same code runs on the server, in the browser and in node:test.
 */
import {
  appendUnique,
  collectTags,
  isValidSlug,
  matchesQuery,
  normalizeSearchText,
  pageOf,
  parseFeedParams,
  type ArchiveTag,
  type FeedPage,
} from "./archive-core.ts";

export { appendUnique, isValidSlug, normalizeSearchText, parseFeedParams, type ArchiveTag };

/** Number of cards per archive batch (divisible by the 1/2/3-column grids). */
export const ARCHIVE_PAGE_SIZE = 18;

/** What a card needs -- the only per-Analysis data the browser receives in lists. */
export interface ArchiveCard {
  id: string;
  title: string;
  slug: string;
  /** Public URL of the first slide (lowest position), or null. */
  coverUrl: string | null;
}

/** Server-side search index entry: a card plus the tags it can be found by. */
export interface ArchiveEntry extends ArchiveCard {
  tags: ArchiveTag[];
}

/** One batch of archive results, as sent to the browser. */
export type ArchivePage = FeedPage<ArchiveCard>;

export interface ArchiveRow {
  id: string;
  title: string;
  slug: string;
  analysis_slides: { position: number; storage_path: string | null }[] | null;
  analysis_tags: { tags: { id: string; name: string } | null }[] | null;
}

const usablePaths = (slides: ArchiveRow["analysis_slides"]) =>
  (slides ?? [])
    .filter((slide) => typeof slide.storage_path === "string" && slide.storage_path.trim() !== "")
    .sort((a, b) => a.position - b.position)
    .map((slide) => slide.storage_path as string);

/**
 * Index entry for a published row. The cover is the lowest-position usable
 * slide -- the same rule as coverSlidePath() for the homepage.
 */
export function toArchiveEntry(row: ArchiveRow, publicUrl: (path: string) => string): ArchiveEntry {
  const cover = usablePaths(row.analysis_slides)[0];
  const tags = (row.analysis_tags ?? [])
    .map((link) => link.tags)
    .filter((tag): tag is ArchiveTag => tag !== null)
    .map((tag) => ({ id: tag.id, name: tag.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  return { id: row.id, title: row.title, slug: row.slug, coverUrl: cover ? publicUrl(cover) : null, tags };
}

/** All slide URLs of one Analysis, in position order (blank paths skipped). */
export function orderedSlideUrls(slides: ArchiveRow["analysis_slides"], publicUrl: (path: string) => string): string[] {
  return usablePaths(slides).map(publicUrl);
}

export function toCard(entry: ArchiveCard): ArchiveCard {
  return { id: entry.id, title: entry.title, slug: entry.slug, coverUrl: entry.coverUrl };
}

/** Tags used by at least one of the given (published) analyses, A-Z. */
export function archiveTags(entries: readonly ArchiveEntry[]): ArchiveTag[] {
  return collectTags(entries);
}

/**
 * Case-insensitive partial matching on title and tag names: every word of
 * the query must appear somewhere in the title or one of the tags ("bkash
 * fin" matches a bKash analysis tagged "Fintech"). Combined with an
 * optional topic (tag id). Order is preserved.
 */
export function filterAnalyses<T extends ArchiveEntry>(entries: readonly T[], query: string, tagId: string | null): T[] {
  return entries.filter(
    (entry) =>
      (!tagId || entry.tags.some((tag) => tag.id === tagId)) &&
      matchesQuery([entry.title, ...entry.tags.map((tag) => tag.name)], query),
  );
}

/** Filters the full index and returns one batch of cards (tags stay server-side). */
export function archivePage(
  entries: readonly ArchiveEntry[],
  { query, tagId, offset }: { query: string; tagId: string | null; offset: number },
  limit = ARCHIVE_PAGE_SIZE,
): ArchivePage {
  return pageOf(filterAnalyses(entries, query, tagId), offset, limit, toCard);
}

/** The slug in an /analysis/[slug] path, or null for anything else. */
export function viewerSlugFromPath(pathname: string | null): string | null {
  const match = /^\/analysis\/([^/?#]+)\/?$/.exec(pathname ?? "");
  return match ? decodeURIComponent(match[1]) : null;
}
