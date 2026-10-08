import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getArticle } from "@/lib/data/admin/content";
import { readStoredArticleBody } from "@/lib/article-body";
import { mediaPublicUrl } from "@/lib/media";
import { formatDate } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/validation";
import { ArticleBody } from "@/components/articles/article-body";
import { StatusBadge } from "@/components/admin/status-badge";
import { linkButton } from "@/components/admin/ui";

// Anonymous visitors (and crawlers) are redirected to the login by
// requireAdmin() before anything renders; noindex is a second guard in case
// a preview URL is ever shared.
export const metadata = { title: "Preview Article · mktbd admin", robots: { index: false, follow: false } };

/**
 * Admin-only preview of an Article, drafts included, laid out like the
 * planned public reading page (single column, cover, title, standfirst,
 * body). Reads through the admin's session -- requireAdmin() plus RLS --
 * so it never exposes a draft to anyone else.
 */
export default async function AdminArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const article = await getArticle(id);
  if (!article) notFound();
  const body = readStoredArticleBody(article.body, article.id);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-light-grey pb-3 text-sm">
        <p className="flex items-center gap-2">
          <span className="font-semibold">Preview</span>
          <StatusBadge status={article.status} />
          {article.status === "draft" ? <span className="text-muted">Only admins can see this.</span> : null}
        </p>
        <Link href={`/admin/articles/${article.id}/edit`} className={linkButton}>
          Back to editor
        </Link>
      </div>

      <article className="mx-auto mt-8 max-w-[44rem] bg-white px-5 py-8 sm:px-10 sm:py-12">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Article</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">{article.title}</h1>
          {article.shortDescription ? (
            <p className="mt-4 text-lg leading-relaxed text-muted">{article.shortDescription}</p>
          ) : null}
          <p className="mt-4 text-sm text-muted">
            {formatDate(article.publicationDate)}
            {article.tags.length > 0 ? ` · ${article.tags.join(", ")}` : ""}
          </p>
        </header>
        {article.coverImagePath ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of the uploaded cover
          <img
            src={mediaPublicUrl(article.coverImagePath)}
            alt=""
            className="mt-8 aspect-[16/9] w-full bg-off-white object-cover"
          />
        ) : null}
        <div className="mt-8">
          {body.content.length > 0 ? (
            <ArticleBody doc={body} />
          ) : (
            <p className="text-sm text-muted">The body is empty.</p>
          )}
        </div>
        {article.linkedAnalysis ? (
          <p className="mt-10 border-t border-light-grey pt-4 text-sm text-muted">
            Linked Analysis: {article.linkedAnalysis.title} (
            {article.linkedAnalysis.readArticleEnabled ? "link on" : "link off"}). The public “See Visual Story →” link
            appears here once both are published and the link is on.
          </p>
        ) : null}
      </article>
    </>
  );
}
