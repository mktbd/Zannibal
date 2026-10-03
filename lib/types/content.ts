/**
 * Shared content model types, mirroring the real Postgres schema in
 * supabase/migrations/. These describe shape only — the query functions in
 * lib/data/ are responsible for mapping DB rows onto these types.
 *
 * Kept hand-written for now (see docs/SUPABASE_SETUP.md "Regenerating
 * database types" for the plan to supplement/replace this with
 * `supabase gen types typescript` once a live project exists).
 */

export type ContentStatus = "draft" | "published";

export interface Tag {
  id: string;
  name: string;
  normalizedName: string;
}

export interface AnalysisSlide {
  id: string;
  position: number;
  storagePath: string;
}

export interface Analysis {
  id: string;
  title: string;
  slug: string;
  publicationDate: string;
  linkedinUrl: string | null;
  status: ContentStatus;
  slides: AnalysisSlide[];
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export type CaseStudyFormat = "PDF";

export interface CaseStudy {
  id: string;
  title: string;
  slug: string;
  coverImagePath: string | null;
  shortDescription: string | null;
  productDescription: string | null;
  priceBdt: number;
  industry: string | null;
  pageCount: number | null;
  publicationDate: string;
  format: CaseStudyFormat;
  status: ContentStatus;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = "pending" | "fulfilled" | "invalid";

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  bkashNumber: string;
  bkashTransactionNumber: string;
  caseStudyId: string | null;
  caseStudyTitleSnapshot: string;
  priceBdtSnapshot: number;
  status: OrderStatus;
  submittedAt: string;
  updatedAt: string;
}

export type ProfileRole = "user" | "admin";

export interface Profile {
  id: string;
  role: ProfileRole;
}
