/**
 * Pure helpers for the public Articles pages: shaping published rows into
 * archive cards, choosing the featured Article, and reading the
 * Analysis <-> Article link from an RLS-filtered embed. Framework-free, so
 * the same code runs on the server and in node:test.
 */
import { isArticleLinkVisible } from "./article-links.ts";

type Status = "draft" | "published";

/** What an archive card (or the featured Article) needs -- never the body. */
export interface ArticleCard {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  /** Public URL of the landscape cover, or null. */
  coverUrl: string | null;
  publicationDate: string;
}

export interface ArticleCardRow {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  cover_image_path: string | null;
  publication_date: string;
}

export function toArticleCard(row: ArticleCardRow, publicUrl: (path: string) => string): ArticleCard {
  const cover = typeof row.cover_image_path === "string" && row.cover_image_path.trim() !== "" ? row.cover_image_path : null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description?.trim() ? row.short_description.trim() : null,
    coverUrl: cover ? publicUrl(cover) : null,
    publicationDate: row.publication_date,
  };
}

/**
 * The newest Article is featured; the rest form the library. Input must
 * already be newest first (publication date, then created_at, then id);
 * the featured Article never appears in the library.
 */
export function splitFeatured<T>(cards: readonly T[]): { featured: T | null; library: T[] } {
  return { featured: cards[0] ?? null, library: cards.slice(1) };
}

function one<T>(raw: T | T[] | null | undefined): T | null {
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
}

/** The link row as PostgREST embeds it from either side. */
export interface LinkEmbed<Other> {
  read_article_enabled: boolean;
  other: Other | Other[] | null;
}

/**
 * The record on the other side of a link -- the Article for an Analysis
 * ("Read Article"), or the Analysis for an Article ("See Visual Story") --
 * or null unless the public may see the link: toggle on and both records
 * published. RLS already returns the link row only in that case
 * (migration 10); this repeats the rule so a page stays correct even if
 * it were ever called with another client.
 */
export function visibleLinkTarget<Other extends { slug: string; title: string; status: Status }>(
  link: LinkEmbed<Other> | null,
  self: { kind: "analysis" | "article"; status: Status },
): { slug: string; title: string } | null {
  const other = link ? one(link.other) : null;
  if (!link || !other) return null;
  const analysisStatus = self.kind === "analysis" ? self.status : other.status;
  const articleStatus = self.kind === "article" ? self.status : other.status;
  const visible = isArticleLinkVisible({
    readArticleEnabled: link.read_article_enabled === true,
    // A link row exists and its other side is readable.
    linkedArticleId: other.slug,
    analysisStatus,
    articleStatus,
  });
  return visible ? { slug: other.slug, title: other.title } : null;
}
