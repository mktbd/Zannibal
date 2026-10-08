"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { analysisSlidePrefix, isAnalysisSlidePath } from "@/lib/media";
import { slugify, validateSlug } from "@/lib/slug";
import {
  formString,
  parseDate,
  parseIdList,
  parseOptionalUrl,
  parseRequiredText,
  UUID_PATTERN,
} from "@/lib/validation";
import {
  listMediaObjects,
  removeUnreferencedMedia,
  slugOwnerTitle,
  syncTagLinks,
  FOREIGN_KEY_VIOLATION,
  UNIQUE_VIOLATION,
  type SessionClient,
} from "@/lib/data/admin/content-mutations";
import type { EditorState } from "@/components/admin/editor-state";

const MAX_SLIDES = 100;
const MAX_TAGS = 30;

type Intent = "save" | "publish" | "unpublish";

interface SlideInput {
  id: string | null;
  path: string;
}

function parseIntent(formData: FormData): Intent {
  const intent = formString(formData, "intent");
  return intent === "publish" || intent === "unpublish" ? intent : "save";
}

function parseSlides(raw: string, analysisId: string): SlideInput[] | string {
  let value: unknown;
  try {
    value = JSON.parse(raw || "[]");
  } catch {
    return "The slide list could not be read. Reload and try again.";
  }
  if (!Array.isArray(value)) return "The slide list could not be read. Reload and try again.";
  if (value.length > MAX_SLIDES) return `An Analysis can have at most ${MAX_SLIDES} slides.`;

  const seen = new Set<string>();
  const slides: SlideInput[] = [];
  for (const item of value) {
    const id = item?.id ?? null;
    const path = item?.path;
    if (
      (id !== null && (typeof id !== "string" || !UUID_PATTERN.test(id))) ||
      typeof path !== "string" ||
      !isAnalysisSlidePath(analysisId, path) ||
      seen.has(path)
    ) {
      return "One of the slides is invalid. Reload and try again.";
    }
    seen.add(path);
    slides.push({ id, path });
  }
  return slides;
}

/**
 * Makes this Analysis's row in analysis_article_links match the editor:
 * no Article -> no row; otherwise one row with the chosen Article and the
 * toggle (kept even when the toggle is off). The link lives in its own
 * table so RLS can hide it from the public unless it is switched on and
 * both records are published (migration 10). Returns a field error, a
 * general error, or null.
 */
async function syncArticleLink(
  supabase: SessionClient,
  analysisId: string,
  articleId: string | null,
  enabled: boolean,
): Promise<{ field: string } | { failed: string } | null> {
  if (articleId === null) {
    const { error } = await supabase.from("analysis_article_links").delete().eq("analysis_id", analysisId);
    return error ? { failed: error.message } : null;
  }
  const { error } = await supabase
    .from("analysis_article_links")
    .upsert({ analysis_id: analysisId, article_id: articleId, read_article_enabled: enabled }, { onConflict: "analysis_id" });
  if (!error) return null;
  // analysis_article_links_article_id_key: linked to another Analysis meanwhile.
  if (error.code === UNIQUE_VIOLATION) return { field: "That Article was just linked to another Analysis. Choose a different one." };
  if (error.code === FOREIGN_KEY_VIOLATION) return { field: "The selected Article no longer exists. Choose another." };
  return { failed: error.message };
}

/** Why `articleId` can't be linked to this Analysis, or null if it can. */
async function linkedArticleProblem(
  supabase: SessionClient,
  articleId: string,
  analysisId: string | null,
): Promise<string | null> {
  const [article, owner] = await Promise.all([
    supabase.from("articles").select("id").eq("id", articleId).maybeSingle<{ id: string }>(),
    supabase
      .from("analysis_article_links")
      .select("analysis_id, analyses(title)")
      .eq("article_id", articleId)
      .maybeSingle<{ analysis_id: string; analyses: { title: string } | null }>(),
  ]);
  if (article.error || owner.error) {
    console.error("[admin/analysis] linked article check failed:", article.error?.message ?? owner.error?.message);
    return "The selected Article could not be checked. Try again.";
  }
  if (!article.data) return "The selected Article no longer exists. Choose another.";
  if (owner.data && owner.data.analysis_id !== analysisId) {
    return `That Article is already linked to the Analysis “${owner.data.analyses?.title ?? "another Analysis"}”. An Article can belong to one Analysis.`;
  }
  return null;
}

function revalidateAnalysisViews(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/articles");
  revalidatePath("/admin/articles/[id]/edit", "page");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/analysis");
  if (id) {
    revalidatePath(`/admin/analysis/${id}/edit`);
    revalidatePath(`/admin/analysis/${id}/preview`);
  }
  revalidatePath("/analysis");
  revalidatePath("/analysis/[slug]", "page");
  revalidatePath("/");
}

/**
 * Create or save an Analysis. The submit button's `intent` decides the
 * resulting status: save keeps it, publish -> published, unpublish ->
 * draft. On success the editor is reloaded via redirect so it always shows
 * exactly what was persisted.
 *
 * Write order (no RPC/transaction is available through PostgREST, so each
 * step is its own request and ordered so a failure part-way never exposes
 * an incomplete record publicly or deletes an image a row still uses):
 *   1. unpublish first if requested (hide from the public immediately)
 *   2. content fields (status unchanged)
 *   3. slides: delete removed rows, then one upsert of the full ordered
 *      list (single statement, so the deferred position uniqueness is
 *      checked once at commit and reorders never collide)
 *   4. tag links
 *   5. publish last if requested, after everything it depends on exists
 *   6. Storage cleanup of objects no longer referenced (best effort)
 */
export async function saveAnalysis(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const mode = formString(formData, "mode") === "edit" ? "edit" : "create";
  const id = formString(formData, "id");
  if (mode === "edit" && !UUID_PATTERN.test(id)) {
    return { status: "error", message: "This Analysis could not be identified. Reload and try again.", fieldErrors: {} };
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

  const linkedinUrl = parseOptionalUrl(formString(formData, "linkedinUrl"));
  if (!linkedinUrl.ok) fieldErrors.linkedinUrl = linkedinUrl.error;

  const tags = parseIdList(formData, "tagIds", MAX_TAGS);
  if (!tags.ok) fieldErrors.tags = tags.error;

  const slides = mode === "edit" ? parseSlides(formString(formData, "slides"), id) : [];
  if (typeof slides === "string") fieldErrors.slides = slides;

  // Linked Article: the selection is kept even while the toggle is off.
  const readArticleEnabled = formString(formData, "readArticleEnabled") === "on";
  const linkedArticleInput = formString(formData, "linkedArticleId");
  let linkedArticleId: string | null = null;
  if (linkedArticleInput !== "") {
    if (UUID_PATTERN.test(linkedArticleInput)) linkedArticleId = linkedArticleInput.toLowerCase();
    else fieldErrors.linkedArticle = "The selected Article is invalid. Reload and choose again.";
  }
  if (readArticleEnabled && linkedArticleId === null && !fieldErrors.linkedArticle) {
    fieldErrors.linkedArticle = "Choose the Article to link, or turn off Read Article.";
  }

  const supabase = await createClient();

  let currentStatus: "draft" | "published" = "draft";
  let currentSlides: { id: string; storage_path: string }[] = [];
  if (mode === "edit") {
    const { data, error } = await supabase
      .from("analyses")
      .select("status, analysis_slides(id, storage_path)")
      .eq("id", id)
      .maybeSingle<{ status: "draft" | "published"; analysis_slides: { id: string; storage_path: string }[] }>();
    if (error) {
      console.error("[admin/analysis] load before save failed:", error.message);
      return { status: "error", message: "The Analysis could not be saved. Try again.", fieldErrors };
    }
    if (!data) {
      return { status: "error", message: "This Analysis no longer exists.", fieldErrors };
    }
    currentStatus = data.status;
    currentSlides = data.analysis_slides;
  }

  const targetStatus = intent === "publish" ? "published" : intent === "unpublish" ? "draft" : currentStatus;

  // The Article must exist and must not already belong to another Analysis
  // (also enforced by the analysis_article_links_article_id_key constraint).
  if (linkedArticleId !== null && !fieldErrors.linkedArticle) {
    const problem = await linkedArticleProblem(supabase, linkedArticleId, mode === "edit" ? id : null);
    if (problem) fieldErrors.linkedArticle = problem;
  }

  if (targetStatus === "published" && typeof slides !== "string" && slides.length === 0) {
    fieldErrors.slides =
      currentStatus === "published"
        ? "A published Analysis needs at least one slide. Add a slide, or unpublish it first."
        : "Add at least one slide before publishing.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: targetStatus === "published" && intent === "publish"
        ? "This Analysis can’t be published yet. Fix the highlighted fields."
        : "Check the highlighted fields.",
      fieldErrors,
    };
  }
  // Narrowed by the checks above.
  const values = {
    title: (title as { value: string }).value,
    slug,
    publication_date: (publicationDate as { value: string }).value,
    linkedin_url: (linkedinUrl as { value: string | null }).value,
  };
  const tagIds = (tags as { value: string[] }).value;
  const slideList = slides as SlideInput[];

  const slugConflict = async () => {
    const owner = await slugOwnerTitle(supabase, "analyses", slug);
    return {
      status: "error" as const,
      message: "Check the highlighted fields.",
      fieldErrors: {
        slug: owner
          ? `“${slug}” is already used by the Analysis “${owner}”. Choose a different slug.`
          : `“${slug}” is already in use. Choose a different slug.`,
      },
    };
  };

  // ---- Create: content row + tags only (slides are added after the first save)
  if (mode === "create") {
    const { data, error } = await supabase
      .from("analyses")
      .insert({ ...values, status: "draft" })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return slugConflict();
      console.error("[admin/analysis] create failed:", error.message);
      return { status: "error", message: "The Analysis could not be created. Try again.", fieldErrors: {} };
    }
    const tagError = await syncTagLinks(supabase, "analysis_tags", "analysis_id", data.id, tagIds);
    const linkError = await syncArticleLink(supabase, data.id, linkedArticleId, readArticleEnabled);
    revalidateAnalysisViews(data.id);
    const problems = [tagError ? "tags" : null, linkError ? "link" : null].filter(Boolean);
    if (tagError) console.error("[admin/analysis] tags after create failed:", tagError);
    if (linkError) console.error("[admin/analysis] article link after create failed:", linkError);
    // A failed link leaves the Analysis unlinked (a draft either way); the
    // editor reports it and the link can be chosen again.
    redirect(`/admin/analysis/${data.id}/edit?notice=created${problems.length ? `&problem=${problems[0]}` : ""}`);
  }

  // ---- Edit
  const partial = (step: string) => ({
    status: "error" as const,
    message: `Saved only partly: ${step} could not be saved. Nothing is published that wasn’t before. Reload the page to see the current state, then try again.`,
    fieldErrors: {},
  });

  // Every new slide must actually exist in Storage before a row points at it.
  const knownIds = new Set(currentSlides.map((slide) => slide.id));
  const newSlides = slideList.filter((slide) => slide.id === null || !knownIds.has(slide.id));
  if (newSlides.length > 0) {
    const { paths, error } = await listMediaObjects(supabase, analysisSlidePrefix(id));
    if (error) {
      console.error("[admin/analysis] storage check failed:", error);
      return { status: "error", message: "Uploaded slides could not be verified. Try again.", fieldErrors: {} };
    }
    const stored = new Set(paths);
    if (newSlides.some((slide) => !stored.has(slide.path))) {
      return {
        status: "error",
        message: "Check the highlighted fields.",
        fieldErrors: { slides: "A slide upload didn’t finish. Remove it and upload it again." },
      };
    }
  }

  // 1. Unpublish first.
  if (targetStatus === "draft" && currentStatus === "published") {
    const { error } = await supabase.from("analyses").update({ status: "draft" }).eq("id", id);
    if (error) {
      console.error("[admin/analysis] unpublish failed:", error.message);
      return { status: "error", message: "The Analysis could not be unpublished. Try again.", fieldErrors: {} };
    }
  }

  // 2. Content fields.
  {
    const { error } = await supabase.from("analyses").update(values).eq("id", id);
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return slugConflict();
      console.error("[admin/analysis] update failed:", error.message);
      return { status: "error", message: "The Analysis could not be saved. Try again.", fieldErrors: {} };
    }
  }

  // 3. Slides. Existing rows keep their stored path (never trusted from the client).
  const pathById = new Map(currentSlides.map((slide) => [slide.id, slide.storage_path]));
  const keptIds = new Set(slideList.filter((s) => s.id && pathById.has(s.id)).map((s) => s.id as string));
  const removedIds = currentSlides.filter((slide) => !keptIds.has(slide.id)).map((slide) => slide.id);

  if (removedIds.length > 0) {
    const { error } = await supabase.from("analysis_slides").delete().in("id", removedIds);
    if (error) {
      console.error("[admin/analysis] slide delete failed:", error.message);
      return partial("the slide changes");
    }
  }
  if (slideList.length > 0) {
    const rows = slideList.map((slide, position) => {
      const existing = slide.id && pathById.has(slide.id);
      return {
        id: existing ? slide.id! : crypto.randomUUID(),
        analysis_id: id,
        storage_path: existing ? pathById.get(slide.id!)! : slide.path,
        position,
      };
    });
    const { error } = await supabase.from("analysis_slides").upsert(rows, { onConflict: "id" });
    if (error) {
      console.error("[admin/analysis] slide upsert failed:", error.message);
      return partial("the slides");
    }
  }

  // 4. Tags.
  const tagError = await syncTagLinks(supabase, "analysis_tags", "analysis_id", id, tagIds);
  if (tagError) {
    console.error("[admin/analysis] tag sync failed:", tagError);
    return partial("the tags");
  }

  // 4b. Linked Article.
  const linkError = await syncArticleLink(supabase, id, linkedArticleId, readArticleEnabled);
  if (linkError) {
    if ("field" in linkError) {
      return {
        status: "error",
        message: "Your other changes were saved, but the Linked Article could not be. Nothing is published that wasn’t before.",
        fieldErrors: { linkedArticle: linkError.field },
      };
    }
    console.error("[admin/analysis] article link sync failed:", linkError.failed);
    return partial("the Linked Article");
  }

  // 5. Publish last.
  if (targetStatus === "published" && currentStatus !== "published") {
    const { error } = await supabase.from("analyses").update({ status: "published" }).eq("id", id);
    if (error) {
      console.error("[admin/analysis] publish failed:", error.message);
      return {
        status: "error",
        message: "Your changes were saved as a draft, but the Analysis could not be published. Try Publish again.",
        fieldErrors: {},
      };
    }
  }

  // 6. Storage cleanup, only now that no row references the removed objects.
  const keepPaths = slideList.map((slide) =>
    slide.id && pathById.has(slide.id) ? pathById.get(slide.id)! : slide.path,
  );
  const leftovers = await removeUnreferencedMedia(supabase, analysisSlidePrefix(id), keepPaths);

  revalidateAnalysisViews(id);
  const notice =
    targetStatus === currentStatus ? (targetStatus === "published" ? "updated" : "saved") : targetStatus === "published" ? "published" : "unpublished";
  redirect(`/admin/analysis/${id}/edit?notice=${notice}${leftovers ? "&problem=cleanup" : ""}`);
}

/**
 * Permanently deletes an Analysis. The row delete cascades to its slide
 * rows and tag links (existing foreign keys); its Storage folder is
 * emptied only after that succeeds.
 */
export async function deleteAnalysis(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const id = formString(formData, "id");
  if (!UUID_PATTERN.test(id)) {
    return { status: "error", message: "This Analysis could not be identified. Reload and try again.", fieldErrors: {} };
  }
  if (formString(formData, "confirm") !== "delete") {
    return { status: "error", message: "Confirm the deletion first.", fieldErrors: {} };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("analyses").delete().eq("id", id).select("id");
  if (error) {
    console.error("[admin/analysis] delete failed:", error.message);
    return { status: "error", message: "The Analysis could not be deleted. Try again.", fieldErrors: {} };
  }
  if (data.length === 0) {
    return { status: "error", message: "This Analysis no longer exists.", fieldErrors: {} };
  }

  const leftovers = await removeUnreferencedMedia(supabase, analysisSlidePrefix(id), []);
  revalidateAnalysisViews();
  redirect(`/admin/analysis?notice=deleted${leftovers ? "&problem=cleanup" : ""}`);
}
