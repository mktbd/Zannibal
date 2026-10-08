import Link from "next/link";
import type { ArticleCard } from "@/lib/article-archive";
import { formatDate } from "@/lib/format";
import { Eyebrow } from "@/components/site/primitives";
import { ArticleCover } from "./article-cover";

/**
 * The newest Article, given the archive's largest frame: a wide landscape
 * cover with the headline, standfirst and date set beside it on desktop
 * (below it on phones and tablets) -- type on paper, not over the image, so
 * the headline always reads. The whole feature is one link.
 */
export function FeaturedArticle({ article }: { article: ArticleCard }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group grid gap-6 sm:gap-7 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:items-end lg:gap-10"
    >
      <ArticleCover
        src={article.coverUrl}
        title={article.title}
        sizes="(min-width: 1280px) 760px, (min-width: 1024px) 60vw, 100vw"
        ratio="aspect-[16/10] lg:aspect-[3/2]"
        preload
      />
      <div className="lg:pb-1">
        <Eyebrow marker className="text-muted">
          Latest Article
        </Eyebrow>
        <h2 className="mt-4 text-title font-extrabold text-balance break-words group-hover:underline group-hover:decoration-2 group-hover:underline-offset-[0.12em] lg:text-[clamp(1.75rem,1rem+1.6vw,2.5rem)] lg:leading-[1.08]">
          {article.title}
        </h2>
        {article.shortDescription ? (
          <p className="mt-4 max-w-[52ch] text-lede text-near-black/75">{article.shortDescription}</p>
        ) : null}
        <p className="mt-5 flex items-center gap-4 text-sm text-muted">
          <time dateTime={article.publicationDate}>{formatDate(article.publicationDate)}</time>
          <span aria-hidden="true" className="h-px w-8 bg-current/40" />
          <span className="font-medium text-black">
            <span className="underline decoration-1 underline-offset-[0.2em] group-hover:decoration-2">Read Article</span>{" "}
            <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </p>
      </div>
    </Link>
  );
}
