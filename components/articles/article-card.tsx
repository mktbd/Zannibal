import Link from "next/link";
import type { ArticleCard as ArticleCardData } from "@/lib/article-archive";
import { formatDate } from "@/lib/format";
import { ArticleCover } from "./article-cover";

/**
 * One Article in the library grid: a 4:3 landscape cover, then the title
 * and date below it (never over the image). The whole card is one link to
 * /articles/[slug]. No tags, excerpt or CTA by design.
 */
export function ArticleCard({ article, sizes }: { article: ArticleCardData; sizes: string }) {
  return (
    <Link href={`/articles/${article.slug}`} className="group block">
      <ArticleCover src={article.coverUrl} title={article.title} sizes={sizes} ratio="aspect-[4/3]" decorative />
      <h3 className="mt-3 text-[0.9375rem] leading-snug font-bold text-balance break-words group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-base lg:text-[1.0625rem]">
        {article.title}
      </h3>
      <p className="mt-1.5 text-xs text-muted sm:text-[0.8125rem]">
        <time dateTime={article.publicationDate}>{formatDate(article.publicationDate)}</time>
      </p>
    </Link>
  );
}
