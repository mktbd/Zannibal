import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getArticle, getTagOptions } from "@/lib/data/admin/content";
import { readStoredArticleBody } from "@/lib/article-body";
import { UUID_PATTERN } from "@/lib/validation";
import { PageHeader } from "@/components/admin/page-header";
import { DeleteSection, SaveNotice } from "@/components/admin/editor-parts";
import { noticeText, problemText } from "@/components/admin/editor-state";
import { linkButton } from "@/components/admin/ui";
import { ArticleEditor } from "../../article-editor";
import { deleteArticle } from "../../actions";

export const metadata = { title: "Edit Article · mktbd admin" };

export default async function AdminEditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; problem?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const [article, allTags, query] = await Promise.all([getArticle(id), getTagOptions(), searchParams]);
  if (!article) notFound();

  return (
    <>
      <PageHeader
        title={article.title}
        description="Edit Article"
        actions={
          <Link href="/admin/articles" className={linkButton}>
            Back to Articles
          </Link>
        }
      />
      <SaveNotice notice={noticeText(query.notice)} problem={problemText(query.problem)} />
      {/* Keyed on updated_at: after every save the editor remounts with exactly what was stored. */}
      <ArticleEditor
        key={article.updatedAt}
        allTags={allTags}
        values={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          shortDescription: article.shortDescription ?? "",
          coverImagePath: article.coverImagePath,
          body: readStoredArticleBody(article.body, article.id),
          publicationDate: article.publicationDate,
          status: article.status,
          tagIds: article.tagIds,
          linkedAnalysis: article.linkedAnalysis,
        }}
      />
      <DeleteSection
        id={article.id}
        label="Article"
        consequence={
          article.linkedAnalysis
            ? `Removes the Article, its tag links and its uploaded images. The linked Analysis “${article.linkedAnalysis.title}” is kept; its Read Article link is removed. Tags themselves are kept.`
            : "Removes the Article, its tag links and its uploaded images. Tags themselves are kept."
        }
        action={deleteArticle}
      />
    </>
  );
}
