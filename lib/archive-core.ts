/**
 * Shared, framework-free building blocks for the public archives (Analysis
 * and Case Studies): search normalisation and matching, paging, de-dup and
 * feed-parameter validation. Imports nothing, so it runs on the server, in
 * the browser and in node:test.
 */

export interface ArchiveTag {
  id: string;
  name: string;
}

/** Lower-cases, strips accents and collapses whitespace. */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Case-insensitive partial matching: every word of the query must appear
 * somewhere in one of the given texts. Plain substring matching, so
 * characters such as "%" and "_" are always literal.
 */
export function matchesQuery(texts: readonly (string | null | undefined)[], query: string): boolean {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = texts.filter((text): text is string => typeof text === "string").map(normalizeSearchText);
  return words.every((word) => haystack.some((text) => text.includes(word)));
}

/** Tags used by at least one of the given entries, each once, A-Z. */
export function collectTags(entries: readonly { tags: readonly ArchiveTag[] }[]): ArchiveTag[] {
  const byId = new Map<string, ArchiveTag>();
  for (const entry of entries) for (const tag of entry.tags) byId.set(tag.id, { id: tag.id, name: tag.name });
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/** One batch of archive results, as sent to the browser. */
export interface FeedPage<T> {
  items: T[];
  /** Matching entries in the whole archive. */
  total: number;
  offset: number;
}

export function pageOf<E, T>(matches: readonly E[], offset: number, limit: number, toItem: (entry: E) => T): FeedPage<T> {
  return { items: matches.slice(offset, offset + limit).map(toItem), total: matches.length, offset };
}

/** Appends a batch, dropping anything already shown (keeps first-seen order). */
export function appendUnique<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id) && seen.add(item.id))];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_QUERY_LENGTH = 100;
const MAX_OFFSET = 100_000;

/** Validates archive feed query parameters; anything malformed falls back to a safe default. */
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

/** Same rule as the *_slug_format check constraints. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 200;
}
