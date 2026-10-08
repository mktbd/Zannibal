import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticle } from "@/lib/data/articles";
import { formatDate } from "@/lib/format";
import { Container } from "@/components/site/primitives";
import { ARTICLES_DESCRIPTION } from "@/components/articles/articles-hero";
import { ArticleBody } from "@/components/articles/article-body";
import { ArticleCover } from "@/components/articles/article-cover";
import { JsonLd } from "@/components/seo/json-ld";
import { articleGraph } from "@/lib/seo";
import { OG_BASE, SITE_INFO } from "@/lib/seo-config";

// Rendered on first request and cached (ISR); the CMS revalidates
// "/articles/[slug]" whenever an Article (or its linked Analysis) changes,
// so a newly published slug works at once and an unpublished one stops
// resolving.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: "Article not found", robots: { index: false } };
  const description = article.shortDescription ?? ARTICLES_DESCRIPTION;
  const images = article.coverUrl ? [{ url: article.coverUrl, alt: `Cover image for “${article.title}”` }] : undefined;
  const path = `/articles/${article.slug}`;
  return {
    title: article.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...OG_BASE,
      type: "article",
      url: path,
      title: `${article.title} | mktbd`,
      description,
      images,
      publishedTime: article.publicationDate,
      modifiedTime: article.updatedAt,
      tags: article.tags.map((tag) => tag.name),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: `${article.title} | mktbd`,
      description,
      images: images?.map((image) => image.url),
    },
  };
}

/**
 * One published Article: a text-first reading page. Header (topics, title,
 * standfirst, date), an optional landscape cover, the validated body
 * rendered by <ArticleBody> (fixed elements, never HTML), then "See Visual
 * Story →" when its Analysis link may be shown, and a way back to the
 * archive. Unknown, draft and deleted slugs all get the same public 404.
 */
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  return (
    <article className="bg-off-white pt-8 pb-16 sm:pt-10 sm:pb-20 lg:pb-24">
      <JsonLd
        data={articleGraph(SITE_INFO, {
          title: article.title,
          slug: article.slug,
          description: article.shortDescription,
          coverUrl: article.coverUrl,
          publicationDate: article.publicationDate,
          updatedAt: article.updatedAt,
          tags: article.tags.map((tag) => tag.name),
          visualStorySlug: article.visualStory?.slug ?? null,
        })}
      />
      <Container>
        <nav aria-label="Breadcrumb" className="mx-auto max-w-[44rem] text-sm">
          <Link href="/articles" className="group inline-flex min-h-11 items-center gap-1.5 font-medium text-muted hover:text-black">
            <span aria-hidden="true" className="inline-block transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            <span className="group-hover:underline group-hover:underline-offset-[0.2em]">Articles</span>
          </Link>
        </nav>

        <header className="mx-auto mt-4 max-w-[44rem] sm:mt-6">
          {article.tags.length > 0 ? (
            <ul aria-label="Topics" className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium tracking-[0.14em] text-muted uppercase">
              {article.tags.map((tag, i) => (
                <li key={tag.id} className="flex items-center gap-3">
                  {i > 0 ? <span aria-hidden="true" className="text-muted/50">·</span> : null}
                  {tag.name}
                </li>
              ))}
            </ul>
          ) : null}
          <h1 className="mt-4 text-[clamp(1.875rem,1.35rem+2.4vw,3.25rem)] leading-[1.06] font-extrabold tracking-[-0.025em] text-balance break-words">
            {article.title}
          </h1>
          {article.shortDescription ? (
            <p className="mt-5 text-lede text-near-black/75">{article.shortDescription}</p>
          ) : null}
          <p className="mt-6 border-t border-black/10 pt-4 text-sm text-muted">
            <time dateTime={article.publicationDate}>{formatDate(article.publicationDate)}</time>
          </p>
        </header>

        {article.coverUrl ? (
          <div className="mx-auto mt-8 max-w-[56rem] sm:mt-10">
            <ArticleCover
              src={article.coverUrl}
              title={article.title}
              sizes="(min-width: 960px) 896px, 100vw"
              ratio="aspect-[16/9]"
              preload
            />
          </div>
        ) : null}

        <div className="mx-auto mt-10 max-w-[44rem] sm:mt-12">
          {article.body.content.length > 0 ? <ArticleBody doc={article.body} /> : null}

          {article.visualStory ? (
            <p className="mt-14 border-t border-black/10 pt-8 sm:mt-16 sm:pt-10">
              {/* Semibold text link (not a button), same underline/arrow behaviour as TextLink. */}
              <Link href={`/analysis/${article.visualStory.slug}`} className="group inline-flex items-baseline gap-1.5 text-lg font-semibold">
                <span className="underline decoration-1 underline-offset-[0.2em] group-hover:decoration-2">See Visual Story</span>
                <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </p>
          ) : null}

          <p className={`${article.visualStory ? "mt-10" : "mt-12 border-t border-black/10 pt-6"} text-sm`}>
            <Link href="/articles" className="font-medium text-muted underline-offset-[0.2em] hover:text-black hover:underline">
              Back to all articles
            </Link>
          </p>
        </div>
      </Container>
    </article>
  );
}
