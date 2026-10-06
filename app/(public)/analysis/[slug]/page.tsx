import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArchiveIndex, getPublishedAnalysisViewer } from "@/lib/data/analysis";
import { archivePage, archiveTags } from "@/lib/analysis-archive";
import { AnalysisHero, ANALYSIS_DESCRIPTION } from "@/components/analysis/analysis-hero";
import { AnalysisArchive } from "@/components/analysis/analysis-archive";

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
  return {
    title: analysis.title,
    description: ANALYSIS_DESCRIPTION,
    openGraph: { title: `${analysis.title} | mktbd`, description: ANALYSIS_DESCRIPTION, images },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: `${analysis.title} | mktbd`,
      description: ANALYSIS_DESCRIPTION,
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
