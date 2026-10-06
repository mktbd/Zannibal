/**
 * Pure helpers for the public Case Studies catalogue: shaping published
 * rows into index entries, search + topic filtering and paging. Built on
 * archive-core.ts (shared with Analysis). Framework-free, so it runs on the
 * server, in the browser and in node:test.
 */
import { collectTags, matchesQuery, pageOf, type ArchiveTag, type FeedPage } from "./archive-core.ts";

/** Case Studies per catalogue batch (a slower-growing premium list). */
export const CASE_STUDY_PAGE_SIZE = 12;

/** What a catalogue row needs -- the only per-Case-Study data the browser receives in lists. */
export interface CaseStudyListItem {
  id: string;
  title: string;
  slug: string;
  /** Public URL of the cover image, or null. */
  coverUrl: string | null;
  shortDescription: string | null;
  priceBdt: number;
  /** ISO date (YYYY-MM-DD). */
  publicationDate: string;
  /** Topic names for the row's small topic line, A-Z. */
  topics: string[];
}

/** Server-side index entry: a list item plus tag ids (for the topic filter). */
export interface CaseStudyEntry extends CaseStudyListItem {
  tags: ArchiveTag[];
}

export type CaseStudyPage = FeedPage<CaseStudyListItem>;

export interface CaseStudyIndexRow {
  id: string;
  title: string;
  slug: string;
  cover_image_path: string | null;
  short_description: string | null;
  price_bdt: number | string;
  publication_date: string;
  case_study_tags: { tags: { id: string; name: string } | null }[] | null;
}

const blankToNull = (value: string | null) => (value && value.trim() !== "" ? value : null);

export function toCaseStudyEntry(row: CaseStudyIndexRow, publicUrl: (path: string) => string): CaseStudyEntry {
  const tags = (row.case_study_tags ?? [])
    .map((link) => link.tags)
    .filter((tag): tag is ArchiveTag => tag !== null)
    .map((tag) => ({ id: tag.id, name: tag.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const cover = blankToNull(row.cover_image_path);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverUrl: cover ? publicUrl(cover) : null,
    shortDescription: blankToNull(row.short_description),
    // numeric(10,2) may arrive as a string; the stored value is never altered.
    priceBdt: Number(row.price_bdt),
    publicationDate: row.publication_date,
    topics: tags.map((tag) => tag.name),
    tags,
  };
}

export function toListItem(entry: CaseStudyEntry): CaseStudyListItem {
  const { tags: _tags, ...item } = entry;
  void _tags;
  return item;
}

/** Tags used by at least one of the given (published) Case Studies, A-Z. */
export function caseStudyTopics(entries: readonly CaseStudyEntry[]): ArchiveTag[] {
  return collectTags(entries);
}

/**
 * Case-insensitive partial matching on title, short description and tag
 * names: every word of the query must appear in one of them. Optional
 * topic (tag id). Order is preserved.
 */
export function filterCaseStudies<T extends CaseStudyEntry>(entries: readonly T[], query: string, tagId: string | null): T[] {
  return entries.filter(
    (entry) =>
      (!tagId || entry.tags.some((tag) => tag.id === tagId)) &&
      matchesQuery([entry.title, entry.shortDescription, ...entry.tags.map((tag) => tag.name)], query),
  );
}

/** Filters the full index and returns one batch of list items. */
export function caseStudyPage(
  entries: readonly CaseStudyEntry[],
  { query, tagId, offset }: { query: string; tagId: string | null; offset: number },
  limit = CASE_STUDY_PAGE_SIZE,
): CaseStudyPage {
  return pageOf(filterCaseStudies(entries, query, tagId), offset, limit, toListItem);
}

/**
 * Product Description as paragraphs: blank lines separate paragraphs,
 * single line breaks are kept inside one (rendered as plain text -- never
 * HTML). Same rule as the CMS preview.
 */
export function descriptionParagraphs(text: string | null): string[] {
  return (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
