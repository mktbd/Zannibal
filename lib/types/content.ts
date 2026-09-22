/**
 * Shared content model types, mirroring the approved data model in
 * docs/MKTBD_SPEC.md. These describe shape only — no data-fetching logic
 * (Supabase queries/tables) is implemented yet.
 */

export type ContentStatus = "draft" | "published";

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface AnalysisSlide {
  id: string;
  order: number;
  imageUrl: string;
}

export interface Analysis {
  id: string;
  title: string;
  slug: string;
  publicationDate: string;
  tags: Tag[];
  linkedinUrl: string | null;
  slides: AnalysisSlide[];
  status: ContentStatus;
}

export type CaseStudyFormat = "PDF";

export interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string;
  shortDescription: string;
  productDescription: string;
  priceBdt: number;
  industry: string;
  tags: Tag[];
  pageCount: number;
  publicationDate: string;
  format: CaseStudyFormat;
  status: ContentStatus;
}

export type OrderStatus = "pending" | "fulfilled" | "invalid";

export interface Order {
  id: string;
  customerName: string;
  email: string;
  bkashNumber: string;
  bkashTransactionNumber: string;
  caseStudyId: string | null;
  caseStudyTitleSnapshot: string;
  priceSnapshotBdt: number;
  submittedAt: string;
  status: OrderStatus;
}
