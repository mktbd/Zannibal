import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedCaseStudy } from "@/lib/data/case-studies";
import { CASE_STUDIES_DESCRIPTION } from "@/components/case-studies/case-study-hero";
import { CaseStudyProduct } from "@/components/case-studies/case-study-product";

// Rendered on first request and cached (ISR); the CMS revalidates
// "/case-studies/[slug]" whenever a Case Study changes, so a newly
// published slug works at once and an unpublished one stops resolving.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = await getPublishedCaseStudy(slug);
  if (!caseStudy) return { title: "Case study not found", robots: { index: false } };
  const description = caseStudy.shortDescription ?? CASE_STUDIES_DESCRIPTION;
  const images = caseStudy.coverUrl ? [{ url: caseStudy.coverUrl, alt: `Cover of “${caseStudy.title}”` }] : undefined;
  return {
    title: caseStudy.title,
    description,
    openGraph: { title: `${caseStudy.title} | mktbd`, description, images },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: `${caseStudy.title} | mktbd`,
      description,
      images: images?.map((image) => image.url),
    },
  };
}

/**
 * The public product page of one published Case Study. Unknown,
 * unpublished (draft) and deleted slugs all get the same public 404 --
 * nothing about a draft is ever read with the public client.
 */
export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const caseStudy = await getPublishedCaseStudy(slug);
  if (!caseStudy) notFound();
  return <CaseStudyProduct caseStudy={caseStudy} />;
}
