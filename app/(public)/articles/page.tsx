import type { Metadata } from "next";
import { OG_BASE } from "@/lib/seo-config";
import { getArticleIndex } from "@/lib/data/articles";
import { splitFeatured } from "@/lib/article-archive";
import { Container, SectionHeading } from "@/components/site/primitives";
import { ArticlesHero, ARTICLES_DESCRIPTION } from "@/components/articles/articles-hero";
import { FeaturedArticle } from "@/components/articles/featured-article";
import { ArticleCard } from "@/components/articles/article-card";

export const metadata: Metadata = {
  title: "Articles",
  description: ARTICLES_DESCRIPTION,
  alternates: { canonical: "/articles" },
  openGraph: { ...OG_BASE, type: "website", title: "Articles | mktbd", description: ARTICLES_DESCRIPTION, url: "/articles" },
  twitter: { title: "Articles | mktbd", description: ARTICLES_DESCRIPTION },
};

// Statically rendered; refreshed at most every 5 minutes, and immediately
// when the CMS changes an Article (its actions revalidate "/articles").
export const revalidate = 300;

const CARD_SIZES = "(min-width: 1280px) 290px, (min-width: 1024px) 23vw, (min-width: 768px) 31vw, 46vw";

/**
 * /articles: the newest published Article featured in a wide frame, then
 * every other published Article in a library grid (two columns on phones,
 * three on tablets, four on desktop). Cards carry only what they show --
 * never the body. Drafts never reach this page (RLS + status filter).
 */
export default async function ArticlesPage() {
  const index = await getArticleIndex();
  const { featured, library } = splitFeatured(index.cards);

  return (
    <>
      <ArticlesHero />
      {!index.ok || !featured ? (
        <section aria-label="Articles" className="bg-off-white py-16 sm:py-20">
          <Container>
            <p className="max-w-[44ch] text-lede text-muted">
              {index.ok
                ? "The first articles are being written. Check back soon."
                : "The articles couldn’t be loaded right now. Please try again in a moment."}
            </p>
          </Container>
        </section>
      ) : (
        <>
          <section aria-label="Latest article" className="bg-off-white pt-10 pb-12 sm:pt-14 sm:pb-16 lg:pt-16 lg:pb-20">
            <Container>
              <FeaturedArticle article={featured} />
            </Container>
          </section>

          {library.length > 0 ? (
            <section aria-labelledby="more-articles-heading" className="bg-off-white pb-16 sm:pb-20 lg:pb-24">
              <Container>
                <SectionHeading id="more-articles-heading" title="More Articles" />
                <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 sm:mt-8 sm:gap-x-5 sm:gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-12">
                  {library.map((article) => (
                    <li key={article.id} className="min-w-0">
                      <ArticleCard article={article} sizes={CARD_SIZES} />
                    </li>
                  ))}
                </ul>
              </Container>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
