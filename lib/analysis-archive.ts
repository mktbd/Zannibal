/**
 * Pure helpers for the public Analysis archive: shaping published rows into
 * index entries, the topic list, search + topic filtering, paging and feed
 * parameter parsing. No imports at all, so the same code runs on the
 * server, in the browser and in the node:test unit tests.
 */

/** Number of cards per archive batch (divisible by the 1/2/3-column grids). */
export const ARCHIVE_PAGE_SIZE = 18;

export interface ArchiveTag {
  id: string;
  name: string;
}

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
export interface ArchivePage {
  items: ArchiveCard[];
  /** Matching analyses in the whole archive. */
  total: number;
  offset: number;
}

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
  const byId = new Map<string, ArchiveTag>();
  for (const entry of entries) for (const tag of entry.tags) byId.set(tag.id, tag);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** Lower-cases, strips accents and collapses whitespace. */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Case-insensitive partial matching on title and tag names: every word of
 * the query must appear somewhere in the title or one of the tags ("bkash
 * fin" matches a bKash analysis tagged "Fintech"). Combined with an
 * optional topic (tag id). Order is preserved.
 */
export function filterAnalyses<T extends ArchiveEntry>(entries: readonly T[], query: string, tagId: string | null): T[] {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  return entries.filter((entry) => {
    if (tagId && !entry.tags.some((tag) => tag.id === tagId)) return false;
    if (words.length === 0) return true;
    const haystack = [entry.title, ...entry.tags.map((tag) => tag.name)].map(normalizeSearchText);
    return words.every((word) => haystack.some((text) => text.includes(word)));
  });
}

/** Filters the full index and returns one batch of cards (tags stay server-side). */
export function archivePage(
  entries: readonly ArchiveEntry[],
  { query, tagId, offset }: { query: string; tagId: string | null; offset: number },
  limit = ARCHIVE_PAGE_SIZE,
): ArchivePage {
  const matches = filterAnalyses(entries, query, tagId);
  return { items: matches.slice(offset, offset + limit).map(toCard), total: matches.length, offset };
}

/** Appends a batch, dropping anything already shown (keeps first-seen order). */
export function appendUnique<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id) && seen.add(item.id))];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_QUERY_LENGTH = 100;
const MAX_OFFSET = 100_000;

/** Validates /api/analysis query parameters; anything malformed falls back to a safe default. */
export function parseFeedParams(params: URLSearchParams): { query: string; tagId: string | null; offset: number } {
  const query = (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  const topic = params.get("topic");
  const offset = Number.parseInt(params.get("offset") ?? "0", 10);
  return {
    query,
    tagId: topic && UUID.test(topic) ? topic : null,
    offset: Number.isFinite(offset) && offset > 0 ? Math.min(offset, MAX_OFFSET) : 0,
  };
}

/** Same rule as the analyses_slug_format check constraint. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 200;
}

/** The slug in an /analysis/[slug] path, or null for anything else. */
export function viewerSlugFromPath(pathname: string | null): string | null {
  const match = /^\/analysis\/([^/?#]+)\/?$/.exec(pathname ?? "");
  return match ? decodeURIComponent(match[1]) : null;
}
