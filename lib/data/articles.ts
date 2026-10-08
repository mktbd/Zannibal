import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { mediaPublicUrl } from "@/lib/media";
import { isValidSlug } from "@/lib/archive-core";
import { readStoredArticleBody, type ArticleDoc } from "@/lib/article-body";
import { toArticleCard, visibleLinkTarget, type ArticleCard, type ArticleCardRow } from "@/lib/article-archive";

/**
 * Public Articles reads. Every query uses the cookie-less anonymous client,
 * so Postgres RLS decides what is visible exactly as for any visitor: only
 * published Articles and their tags, and an Analysis link only when it is
 * switched on and both records are published (migration 10). The explicit
 * status filters repeat that in the query itself.
 */

export type ArticleIndexResult = { ok: true; cards: ArticleCard[] } | { ok: false; cards: [] };

/**
 * Every published Article as a card (no body), newest publication date
 * first; created_at, then id, break ties so the order -- and so which
 * Article is featured -- is deterministic.
 */
export const getArticleIndex = cache(async (): Promise<ArticleIndexResult> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, short_description, cover_image_path, publication_date")
    .eq("status", "published")
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .overrideTypes<ArticleCardRow[], { merge: false }>();
  if (error) {
    console.error("[articles] index query failed:", error.message);
    return { ok: false, cards: [] };
  }
  return { ok: true, cards: data.map((row) => toArticleCard(row, mediaPublicUrl)) };
});

export interface PublicArticle {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverUrl: string | null;
  publicationDate: string;
  updatedAt: string;
  tags: { id: string; name: string }[];
  /** Validated body, safe to render with <ArticleBody>. */
  body: ArticleDoc;
  /** "See Visual Story": the linked Analysis when the link may be shown. */
  visualStory: { slug: string; title: string } | null;
}

type AnalysisSide = { slug: string; title: string; status: "draft" | "published" };

interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  cover_image_path: string | null;
  body: unknown;
  publication_date: string;
  status: "draft" | "published";
  updated_at: string;
  article_tags: { tags: { id: string; name: string } | null }[] | null;
  analysis_article_links:
    | { read_article_enabled: boolean; analyses: AnalysisSide | AnalysisSide[] | null }
    | { read_article_enabled: boolean; analyses: AnalysisSide | AnalysisSide[] | null }[]
    | null;
}

/**
 * One published Article for /articles/[slug]. Null when the slug doesn't
 * exist or isn't published -- the two are indistinguishable by design.
 * Throws on a failed read, so a valid link never 404s because the database
 * was briefly unreachable.
 */
export const getPublishedArticle = cache(async (slug: string): Promise<PublicArticle | null> => {
  if (!isValidSlug(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, title, slug, short_description, cover_image_path, body, publication_date, status, updated_at, article_tags(tags(id, name)), analysis_article_links(read_article_enabled, analyses(slug, title, status))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()
    .overrideTypes<ArticleRow | null, { merge: false }>();
  if (error) throw new Error(`[articles] article query failed: ${error.message}`);
  if (!data) return null;

  const card = toArticleCard(data, mediaPublicUrl);
  const linkRow = Array.isArray(data.analysis_article_links) ? (data.analysis_article_links[0] ?? null) : data.analysis_article_links;
  return {
    ...card,
    updatedAt: data.updated_at,
    tags: (data.article_tags ?? [])
      .map((link) => link.tags)
      .filter((tag): tag is { id: string; name: string } => tag !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "en")),
    // Re-validated before rendering (defence in depth; invalid -> empty).
    body: readStoredArticleBody(data.body, data.id),
    visualStory: visibleLinkTarget(
      linkRow ? { read_article_enabled: linkRow.read_article_enabled, other: linkRow.analyses } : null,
      { kind: "article", status: data.status },
    ),
  };
});
