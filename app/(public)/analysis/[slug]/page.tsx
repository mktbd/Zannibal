import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArchiveIndex, getPublishedAnalysisViewer } from "@/lib/data/analysis";
import { archivePage, archiveTags } from "@/lib/analysis-archive";
import { AnalysisHero, ANALYSIS_DESCRIPTION } from "@/components/analysis/analysis-hero";
import { AnalysisArchive } from "@/components/analysis/analysis-archive";
import { JsonLd } from "@/components/seo/json-ld";
import { analysisDescription, analysisGraph } from "@/lib/seo";
import { OG_BASE, SITE_INFO } from "@/lib/seo-config";

// Rendered on first request and cached (ISR); the CMS revalidates
// "/analysis/[slug]" whenever an Analysis changes, so a newly published
// slug works at once and an unpublished one stops resolving.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const analysis = await getPublishedAnalysisViewer(slug);
  if (!analysis) return { title: "Analysis not found", robots: { index: false } };
  const cover = analysis.slides[0];
  const images = cover ? [{ url: cover, alt: `First slide of “${analysis.title}”` }] : undefined;
  const description = analysisDescription(analysis.tags, ANALYSIS_DESCRIPTION);
  const path = `/analysis/${analysis.slug}`;
  return {
    title: analysis.title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, type: "website", title: `${analysis.title} | mktbd`, description, url: path, images },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: `${analysis.title} | mktbd`,
      description,
      images: images?.map((image) => image.url),
    },
  };
}

/**
 * A shared or refreshed /analysis/[slug] link: the archive's first batch
 * with this Analysis's viewer already open and its slides already loaded
 * (it may sit far beyond the first batch). Unknown or unpublished slugs
 * get the public 404 -- drafts never resolve.
 */
export default async function AnalysisSlugPage({ params }: Props) {
  const { slug } = await params;
  const [analysis, index] = await Promise.all([getPublishedAnalysisViewer(slug), getArchiveIndex()]);
  if (!analysis) notFound();
  return (
    <>
      <JsonLd
        data={analysisGraph(SITE_INFO, {
          title: analysis.title,
          slug: analysis.slug,
          description: analysisDescription(analysis.tags, ANALYSIS_DESCRIPTION),
          slides: analysis.slides,
          publicationDate: analysis.publicationDate,
          updatedAt: analysis.updatedAt,
          tags: analysis.tags,
          articleSlug: analysis.article?.slug ?? null,
        })}
      />
      <AnalysisHero />
      <AnalysisArchive
        initialPage={archivePage(index.entries, { query: "", tagId: null, offset: 0 })}
        tags={archiveTags(index.entries)}
        loadError={!index.ok}
        initialViewer={analysis}
      />
    </>
  );
}
