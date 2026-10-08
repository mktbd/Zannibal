/**
 * When the public cross-links between an Analysis and its Article may be
 * shown -- "Read Article" in the Analysis viewer and "See Visual Story"
 * on the Article page (Stage 5C). One rule for both directions, because
 * the link itself is stored once (one analysis_article_links row with
 * article_id + read_article_enabled, migration 10):
 *
 *   the toggle is on, an Article is selected, and BOTH records are
 *   published.
 *
 * A draft on either side, a deleted Article (link row gone) or a
 * switched-off toggle hides the link. For the public the database enforces
 * the same rule: RLS returns a link row only when it is switched on and
 * both records are published, so a hidden link (or a draft Article's id)
 * never reaches a public response. This function is the matching check
 * for code that has the full state (the CMS, the 5C pages).
 */
export interface ArticleLinkState {
  readArticleEnabled: boolean;
  linkedArticleId: string | null;
  analysisStatus: "draft" | "published";
  /** null when the Article isn't readable (deleted, or a draft hidden by RLS). */
  articleStatus: "draft" | "published" | null;
}

export function isArticleLinkVisible(state: ArticleLinkState): boolean {
  return (
    state.readArticleEnabled &&
    state.linkedArticleId !== null &&
    state.analysisStatus === "published" &&
    state.articleStatus === "published"
  );
}
