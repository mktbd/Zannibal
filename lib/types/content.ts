/**
 * Shared content model types, mirroring the real Postgres schema in
 * supabase/migrations/. These describe shape only — the query functions in
 * lib/data/ are responsible for mapping DB rows onto these types.
 *
 * Kept hand-written for now (see docs/SUPABASE_SETUP.md "Regenerating
 * database types" for the plan to supplement/replace this with
 * `supabase gen types typescript` once a live project exists).
 */

import type { ArticleDoc } from "@/lib/article-body";

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

/**
 * Free, written business analysis. `body` is a validated ProseMirror/Tiptap
 * JSON document (lib/article-body.ts ArticleDoc), never HTML. The Analysis
 * it accompanies, if any, is found through analysis_article_links (one row
 * per link, with the read_article_enabled toggle; publicly visible only
 * when switched on and both records are published).
 */
export interface Article {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImagePath: string | null;
  body: ArticleDoc;
  publicationDate: string;
  status: ContentStatus;
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
