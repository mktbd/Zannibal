"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { caseStudyCoverPrefix, isCaseStudyCoverPath } from "@/lib/media";
import { slugify, validateSlug } from "@/lib/slug";
import {
  formString,
  parseDate,
  parseIdList,
  parseOptionalPositiveInt,
  parseOptionalText,
  parsePriceBdt,
  parseRequiredText,
  UUID_PATTERN,
} from "@/lib/validation";
import {
  listMediaObjects,
  removeUnreferencedMedia,
  slugOwnerTitle,
  syncTagLinks,
  UNIQUE_VIOLATION,
} from "@/lib/data/admin/content-mutations";
import type { EditorState } from "@/components/admin/editor-state";

const MAX_TAGS = 30;

type Intent = "save" | "publish" | "unpublish";

function parseIntent(formData: FormData): Intent {
  const intent = formString(formData, "intent");
  return intent === "publish" || intent === "unpublish" ? intent : "save";
}

function revalidateCaseStudyViews(id?: string) {
  // Published URLs and their lastmod live in the sitemap.
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/case-studies");
  if (id) {
    revalidatePath(`/admin/case-studies/${id}/edit`);
    revalidatePath(`/admin/case-studies/${id}/preview`);
  }
  revalidatePath("/case-studies");
  revalidatePath("/case-studies/[slug]", "page");
  revalidatePath("/");
}

/**
 * Create or save a Case Study; same intent/status model and write order as
 * saveAnalysis (unpublish first, fields, tags, publish last, then Storage
 * cleanup of superseded covers). Orders are never touched: their title and
 * price snapshots are historical records and stay as submitted.
 *
 * price_bdt is NOT NULL DEFAULT 0 in the schema, so a blank price on a
 * draft is stored as 0 and treated as "not set"; publishing requires a
 * price above 0.
 */
export async function saveCaseStudy(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const mode = formString(formData, "mode") === "edit" ? "edit" : "create";
  const id = formString(formData, "id");
  if (mode === "edit" && !UUID_PATTERN.test(id)) {
    return { status: "error", message: "This Case Study could not be identified. Reload and try again.", fieldErrors: {} };
  }
  const intent = parseIntent(formData);

  // ---- Validate fields
  const fieldErrors: Record<string, string> = {};
  const title = parseRequiredText(formString(formData, "title"), "title", 200);
  if (!title.ok) fieldErrors.title = title.error;

  const slugInput = formString(formData, "slug");
  const slug = slugify(slugInput.trim() !== "" ? slugInput : title.ok ? title.value : "");
  const slugError = validateSlug(slug);
  if (slugError) fieldErrors.slug = slugError;

  const publicationDate = parseDate(formString(formData, "publicationDate"));
  if (!publicationDate.ok) fieldErrors.publicationDate = publicationDate.error;

  const shortDescription = parseOptionalText(formString(formData, "shortDescription"), "short description", 300);
  if (!shortDescription.ok) fieldErrors.shortDescription = shortDescription.error;

  const productDescription = parseOptionalText(formString(formData, "productDescription"), "product description", 10000, true);
  if (!productDescription.ok) fieldErrors.productDescription = productDescription.error;

  const price = parsePriceBdt(formString(formData, "priceBdt"));
  if (!price.ok) fieldErrors.priceBdt = price.error;

  const industry = parseOptionalText(formString(formData, "industry"), "industry", 100);
  if (!industry.ok) fieldErrors.industry = industry.error;

  const pageCount = parseOptionalPositiveInt(formString(formData, "pageCount"), "page count", 5000);
  if (!pageCount.ok) fieldErrors.pageCount = pageCount.error;

  const tags = parseIdList(formData, "tagIds", MAX_TAGS);
  if (!tags.ok) fieldErrors.tags = tags.error;

  let coverPath: string | null = null;
  if (mode === "edit") {
    const raw = formString(formData, "coverPath");
    if (raw !== "") {
      if (isCaseStudyCoverPath(id, raw)) coverPath = raw;
      else fieldErrors.cover = "The cover image is invalid. Upload it again.";
    }
  }

  const supabase = await createClient();

  let currentStatus: "draft" | "published" = "draft";
  let currentCover: string | null = null;
  if (mode === "edit") {
    const { data, error } = await supabase
      .from("case_studies")
      .select("status, cover_image_path")
      .eq("id", id)
      .maybeSingle<{ status: "draft" | "published"; cover_image_path: string | null }>();
    if (error) {
      console.error("[admin/case-studies] load before save failed:", error.message);
      return { status: "error", message: "The Case Study could not be saved. Try again.", fieldErrors };
    }
    if (!data) return { status: "error", message: "This Case Study no longer exists.", fieldErrors };
    currentStatus = data.status;
    currentCover = data.cover_image_path;
  }

  const targetStatus = intent === "publish" ? "published" : intent === "unpublish" ? "draft" : currentStatus;

  if (targetStatus === "published") {
    const needed = "Required to publish.";
    if (!coverPath && !fieldErrors.cover) fieldErrors.cover = "Add a cover image before publishing.";
    if (shortDescription.ok && !shortDescription.value) fieldErrors.shortDescription = needed;
    if (productDescription.ok && !productDescription.value) fieldErrors.productDescription = needed;
    if (price.ok && price.value <= 0) fieldErrors.priceBdt = "Set a price above 0 before publishing.";
    if (industry.ok && !industry.value) fieldErrors.industry = needed;
    if (pageCount.ok && !pageCount.value) fieldErrors.pageCount = needed;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message:
        targetStatus === "published"
          ? currentStatus === "published"
            ? "A published Case Study must keep every required field. Fix the highlighted fields, or unpublish it first."
            : "This Case Study can’t be published yet. Fix the highlighted fields."
          : "Check the highlighted fields.",
      fieldErrors,
    };
  }

  const values = {
    title: (title as { value: string }).value,
    slug,
    publication_date: (publicationDate as { value: string }).value,
    short_description: (shortDescription as { value: string | null }).value,
    product_description: (productDescription as { value: string | null }).value,
    price_bdt: (price as { value: number }).value,
    industry: (industry as { value: string | null }).value,
    page_count: (pageCount as { value: number | null }).value,
  };
  const tagIds = (tags as { value: string[] }).value;

  const slugConflict = async () => {
    const owner = await slugOwnerTitle(supabase, "case_studies", slug);
    return {
      status: "error" as const,
      message: "Check the highlighted fields.",
      fieldErrors: {
        slug: owner
          ? `“${slug}” is already used by the Case Study “${owner}”. Choose a different slug.`
          : `“${slug}” is already in use. Choose a different slug.`,
      },
    };
  };

  // ---- Create (the cover is added after the first save)
  if (mode === "create") {
    const { data, error } = await supabase
      .from("case_studies")
      .insert({ ...values, status: "draft" })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return slugConflict();
      console.error("[admin/case-studies] create failed:", error.message);
      return { status: "error", message: "The Case Study could not be created. Try again.", fieldErrors: {} };
    }
    const tagError = await syncTagLinks(supabase, "case_study_tags", "case_study_id", data.id, tagIds);
    revalidateCaseStudyViews(data.id);
    if (tagError) {
      console.error("[admin/case-studies] tags after create failed:", tagError);
      redirect(`/admin/case-studies/${data.id}/edit?notice=created&problem=tags`);
    }
    redirect(`/admin/case-studies/${data.id}/edit?notice=created`);
  }

  // ---- Edit
  if (coverPath && coverPath !== currentCover) {
    const { paths, error } = await listMediaObjects(supabase, caseStudyCoverPrefix(id));
    if (error) {
      console.error("[admin/case-studies] storage check failed:", error);
      return { status: "error", message: "The uploaded cover could not be verified. Try again.", fieldErrors: {} };
    }
    if (!paths.includes(coverPath)) {
      return {
        status: "error",
        message: "Check the highlighted fields.",
        fieldErrors: { cover: "The cover upload didn’t finish. Upload it again." },
      };
    }
  }

  if (targetStatus === "draft" && currentStatus === "published") {
    const { error } = await supabase.from("case_studies").update({ status: "draft" }).eq("id", id);
    if (error) {
      console.error("[admin/case-studies] unpublish failed:", error.message);
      return { status: "error", message: "The Case Study could not be unpublished. Try again.", fieldErrors: {} };
    }
  }

  {
    const { error } = await supabase
      .from("case_studies")
      .update({ ...values, cover_image_path: coverPath })
      .eq("id", id);
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return slugConflict();
      console.error("[admin/case-studies] update failed:", error.message);
      return { status: "error", message: "The Case Study could not be saved. Try again.", fieldErrors: {} };
    }
  }

  const tagError = await syncTagLinks(supabase, "case_study_tags", "case_study_id", id, tagIds);
  if (tagError) {
    console.error("[admin/case-studies] tag sync failed:", tagError);
    return {
      status: "error",
      message:
        "Saved only partly: the tags could not be saved. Nothing is published that wasn’t before. Reload the page to see the current state, then try again.",
      fieldErrors: {},
    };
  }

  if (targetStatus === "published" && currentStatus !== "published") {
    const { error } = await supabase.from("case_studies").update({ status: "published" }).eq("id", id);
    if (error) {
      console.error("[admin/case-studies] publish failed:", error.message);
      return {
        status: "error",
        message: "Your changes were saved as a draft, but the Case Study could not be published. Try Publish again.",
        fieldErrors: {},
      };
    }
  }

  const leftovers = await removeUnreferencedMedia(supabase, caseStudyCoverPrefix(id), coverPath ? [coverPath] : []);

  revalidateCaseStudyViews(id);
  const notice =
    targetStatus === currentStatus ? (targetStatus === "published" ? "updated" : "saved") : targetStatus === "published" ? "published" : "unpublished";
  redirect(`/admin/case-studies/${id}/edit?notice=${notice}${leftovers ? "&problem=cleanup" : ""}`);
}

/**
 * Permanently deletes a Case Study. Tag links cascade; orders.case_study_id
 * is set to NULL by the existing foreign key, so orders and their
 * title/price snapshots survive. The cover folder is emptied afterwards.
 */
export async function deleteCaseStudy(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const id = formString(formData, "id");
  if (!UUID_PATTERN.test(id)) {
    return { status: "error", message: "This Case Study could not be identified. Reload and try again.", fieldErrors: {} };
  }
  if (formString(formData, "confirm") !== "delete") {
    return { status: "error", message: "Confirm the deletion first.", fieldErrors: {} };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("case_studies").delete().eq("id", id).select("id");
  if (error) {
    console.error("[admin/case-studies] delete failed:", error.message);
    return { status: "error", message: "The Case Study could not be deleted. Try again.", fieldErrors: {} };
  }
  if (data.length === 0) {
    return { status: "error", message: "This Case Study no longer exists.", fieldErrors: {} };
  }

  const leftovers = await removeUnreferencedMedia(supabase, caseStudyCoverPrefix(id), []);
  revalidateCaseStudyViews();
  redirect(`/admin/case-studies?notice=deleted${leftovers ? "&problem=cleanup" : ""}`);
}
