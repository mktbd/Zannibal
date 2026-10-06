import type { Metadata } from "next";
import { getCaseStudyIndex } from "@/lib/data/case-studies";
import { caseStudyPage, caseStudyTopics } from "@/lib/case-study-archive";
import { CaseStudyHero, CASE_STUDIES_DESCRIPTION } from "@/components/case-studies/case-study-hero";
import { CaseStudyCatalogue } from "@/components/case-studies/case-study-catalogue";

export const metadata: Metadata = {
  title: "Case Studies",
  description: CASE_STUDIES_DESCRIPTION,
  openGraph: { title: "Case Studies | mktbd", description: CASE_STUDIES_DESCRIPTION },
  twitter: { title: "Case Studies | mktbd", description: CASE_STUDIES_DESCRIPTION },
};

// Statically rendered; refreshed at most every 5 minutes, and immediately
// when the CMS changes a Case Study (its actions revalidate "/case-studies").
export const revalidate = 300;

export default async function CaseStudiesPage() {
  const index = await getCaseStudyIndex();
  return (
    <>
      <CaseStudyHero />
      <CaseStudyCatalogue
        initialPage={caseStudyPage(index.entries, { query: "", tagId: null, offset: 0 })}
        tags={caseStudyTopics(index.entries)}
        loadError={!index.ok}
      />
    </>
  );
}
