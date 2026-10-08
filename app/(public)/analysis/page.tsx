import type { Metadata } from "next";
import { OG_BASE } from "@/lib/seo-config";
import { getArchiveIndex } from "@/lib/data/analysis";
import { archivePage, archiveTags } from "@/lib/analysis-archive";
import { AnalysisHero, ANALYSIS_DESCRIPTION } from "@/components/analysis/analysis-hero";
import { AnalysisArchive } from "@/components/analysis/analysis-archive";

export const metadata: Metadata = {
  title: "Analysis",
  description: ANALYSIS_DESCRIPTION,
  alternates: { canonical: "/analysis" },
  openGraph: { ...OG_BASE, type: "website", title: "Analysis | mktbd", description: ANALYSIS_DESCRIPTION, url: "/analysis" },
  twitter: { title: "Analysis | mktbd", description: ANALYSIS_DESCRIPTION },
};

// Statically rendered; refreshed at most every 5 minutes, and immediately
// when the CMS changes an Analysis (its actions revalidate "/analysis").
export const revalidate = 300;

export default async function AnalysisPage() {
  const index = await getArchiveIndex();
  return (
    <>
      <AnalysisHero />
      <AnalysisArchive
        initialPage={archivePage(index.entries, { query: "", tagId: null, offset: 0 })}
        tags={archiveTags(index.entries)}
        loadError={!index.ok}
        initialViewer={null}
      />
    </>
  );
}
