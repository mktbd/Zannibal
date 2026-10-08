import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getTagOptions } from "@/lib/data/admin/content";
import { EMPTY_ARTICLE_BODY } from "@/lib/article-body";
import { todayInDhaka } from "@/lib/validation";
import { PageHeader } from "@/components/admin/page-header";
import { linkButton } from "@/components/admin/ui";
import { ArticleEditor } from "../article-editor";

export const metadata = { title: "New Article · mktbd admin" };

export default async function AdminNewArticlePage() {
  await requireAdmin();
  const allTags = await getTagOptions();

  return (
    <>
      <PageHeader
        title="New Article"
        description="Write or paste the article and save a draft; the cover and images are added next."
        actions={
          <Link href="/admin/articles" className={linkButton}>
            Back to Articles
          </Link>
        }
      />
      <ArticleEditor
        allTags={allTags}
        values={{
          id: null,
          title: "",
          slug: "",
          shortDescription: "",
          coverImagePath: null,
          body: EMPTY_ARTICLE_BODY,
          publicationDate: todayInDhaka(),
          status: "draft",
          tagIds: [],
          linkedAnalysis: null,
        }}
      />
    </>
  );
}
