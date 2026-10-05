import type { Metadata } from "next";
import { getLatestAnalyses } from "@/lib/data/home";
import { Hero } from "@/components/home/hero";
import { LatestAnalysis } from "@/components/home/latest-analysis";
import { PremiumCaseStudies } from "@/components/home/premium-case-studies";
import { CoBuild } from "@/components/home/co-build";

const DESCRIPTION =
  "mktbd breaks down the strategies, decisions and market dynamics shaping businesses in Bangladesh.";

export const metadata: Metadata = {
  title: { absolute: "mktbd — How Bangladeshi Businesses Grow" },
  description: DESCRIPTION,
  openGraph: { title: "mktbd — How Bangladeshi Businesses Grow", description: DESCRIPTION },
  twitter: { title: "mktbd — How Bangladeshi Businesses Grow", description: DESCRIPTION },
};

// Statically rendered; refreshed at most every 5 minutes, and immediately
// when the CMS publishes/edits an Analysis (its actions revalidate "/").
export const revalidate = 300;

export default async function HomePage() {
  const analyses = await getLatestAnalyses(3);

  return (
    <>
      <Hero />
      <LatestAnalysis analyses={analyses} />
      <PremiumCaseStudies />
      <CoBuild />
    </>
  );
}
