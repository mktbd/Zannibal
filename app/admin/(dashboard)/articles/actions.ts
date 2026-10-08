"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { articleMediaPrefix, isArticleCoverPath, isArticleImagePath } from "@/lib/media";
import { articleImagePaths, hasArticleContent, parseArticleBody, type ArticleDoc } from "@/lib/article-body";
import { slugify, validateSlug } from "@/lib/slug";
import { formString, parseDate, parseIdList, parseOptionalText, parseRequiredText, UUID_PATTERN } from "@/lib/validation";
import {
  listMediaObjects,
  removeUnreferencedMedia,
  slugOwnerTitle,
  syncTagLinks,
  UNIQUE_VIOLATION,
} from "@/lib/data/admin/content-mutations";
import type { EditorState } from "@/components/admin/editor-state";

const MAX_TAGS = 30;

/** Never-saved uploads younger than this are left for a later save to sweep. */
const UNSAVED_UPLOAD_GRACE_MS = 60 * 60 * 1000;

/** Only this Article's own cover-/image- objects are ever deleted. */
const ownedBy = (id: string) => (path: string) => isArticleCoverPath(id, path) || isArticleImagePath(id, path);

/** Every Storage path a stored Article row references. */
function referencedPaths(id: string, cover: string | null, body: unknown): string[] {
  const parsed = parseArticleBody(JSON.stringify(body ?? null), id);
  const images = parsed.ok ? articleImagePaths(parsed.value) : [];
  return cover ? [cover, ...images] : images;
}

type Intent = "save" | "publish" | "unpublish";

function parseIntent(formData: FormData): Intent {
  const intent = formString(formData, "intent");
  return intent === "publish" || intent === "unpublish" ? intent : "save";
}

function revalidateArticleViews(id?: string) {
  // Published URLs and their lastmod live in the sitemap.
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/articles");
  // The Analysis editor lists Articles in its "Linked Article" selector.
  revalidatePath("/admin/analysis/[id]/edit", "page");
  if (id) {
    revalidatePath(`/admin/articles/${id}/edit`);
    revalidatePath(`/admin/articles/${id}/preview`);
  }
  // Public pages: the archive, the reading page, and a linked Analysis's
  // "Read Article" link (shown only when both are published).
  revalidatePath("/articles");
  revalidatePath("/articles/[slug]", "page");
  revalidatePath("/analysis/[slug]", "page");
}

/**
 * Create or save an Article. Same contract as saveAnalysis: the submit
 * button's `intent` decides the resulting status, success redirects back
 * to the editor with a notice, and writes are ordered so a failure part-way
 * never exposes an incomplete Article or deletes an image a row still uses:
 *   1. unpublish first if requested
 *   2. content fields (title, slug, description, date, cover, body)
 *   3. tag links
 *   4. publish last if requested
 *   5. Storage cleanup of objects no longer referenced (best effort)
 *
 * The body arrives as Tiptap JSON and is rebuilt by the allow-list
 * validator (lib/article-body.ts) before it is stored -- the browser's
 * version is never written as-is.
 */
export async function saveArticle(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const mode = formString(formData, "mode") === "edit" ? "edit" : "create";
  const id = formString(formData, "id");
  if (mode === "edit" && !UUID_PATTERN.test(id)) {
    return { status: "error", message: "This Article could not be identified. Reload and try again.", fieldErrors: {} };
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

  const shortDescription = parseOptionalText(formString(formData, "shortDescription"), "short description", 300);
  if (!shortDescription.ok) fieldErrors.shortDescription = shortDescription.error;

  const publicationDate = parseDate(formString(formData, "publicationDate"));
  if (!publicationDate.ok) fieldErrors.publicationDate = publicationDate.error;

  const tags = parseIdList(formData, "tagIds", MAX_TAGS);
  if (!tags.ok) fieldErrors.tags = tags.error;

  // Images can only belong to a saved Article, so on create any figure is refused.
  const body = parseArticleBody(formString(formData, "body"), mode === "edit" ? id : null);
  if (!body.ok) fieldErrors.body = body.error;

  let coverPath: string | null = null;
  if (mode === "edit") {
    const raw = formString(formData, "coverPath");
    if (raw !== "") {
      if (isArticleCoverPath(id, raw)) coverPath = raw;
      else fieldErrors.cover = "The cover image is invalid. Upload it again.";
    }
  }

  const supabase = await createClient();

  let currentStatus: "draft" | "published" = "draft";
  let currentCover: string | null = null;
  let currentImages = new Set<string>();
  if (mode === "edit") {
    const { data, error } = await supabase
      .from("articles")
      .select("status, cover_image_path, body")
      .eq("id", id)
      .maybeSingle<{ status: "draft" | "published"; cover_image_path: string | null; body: unknown }>();
    if (error) {
      console.error("[admin/articles] load before save failed:", error.message);
      return { status: "error", message: "The Article could not be saved. Try again.", fieldErrors };
    }
    if (!data) {
      return { status: "error", message: "This Article no longer exists.", fieldErrors };
    }
    currentStatus = data.status;
    currentCover = data.cover_image_path;
    currentImages = new Set(referencedPaths(id, null, data.body));
  }

  const targetStatus = intent === "publish" ? "published" : intent === "unpublish" ? "draft" : currentStatus;

  if (targetStatus === "published" && body.ok && !hasArticleContent(body.value)) {
    fieldErrors.body =
      currentStatus === "published"
        ? "A published Article needs body text. Add some, or unpublish it first."
        : "Write the article body before publishing.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message:
        targetStatus === "published" && intent === "publish"
          ? "This Article can’t be published yet. Fix the highlighted fields."
          : "Check the highlighted fields.",
      fieldErrors,
    };
  }
  // Narrowed by the checks above.
  const doc = (body as { value: ArticleDoc }).value;
  const values = {
    title: (title as { value: string }).value,
    slug,
    short_description: (shortDescription as { value: string | null }).value,
    publication_date: (publicationDate as { value: string }).value,
    body: doc,
  };
  const tagIds = (tags as { value: string[] }).value;

  const slugConflict = async () => {
    const owner = await slugOwnerTitle(supabase, "articles", slug);
    return {
      status: "error" as const,
      message: "Check the highlighted fields.",
      fieldErrors: {
        slug: owner
          ? `“${slug}” is already used by the Article “${owner}”. Choose a different slug.`
          : `“${slug}” is already in use. Choose a different slug.`,
      },
    };
  };

  // ---- Create: content row + tags only (cover and images are added after the first save)
  if (mode === "create") {
    const { data, error } = await supabase
      .from("articles")
      .insert({ ...values, status: "draft" })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return slugConflict();
      console.error("[admin/articles] create failed:", error.message);
      return { status: "error", message: "The Article could not be created. Try again.", fieldErrors: {} };
    }
    const tagError = await syncTagLinks(supabase, "article_tags", "article_id", data.id, tagIds);
    revalidateArticleViews(data.id);
    if (tagError) {
      console.error("[admin/articles] tags after create failed:", tagError);
      redirect(`/admin/articles/${data.id}/edit?notice=created&problem=tags`);
    }
    redirect(`/admin/articles/${data.id}/edit?notice=created`);
  }

  // ---- Edit
  const partial = (step: string) => ({
    status: "error" as const,
    message: `Saved only partly: ${step} could not be saved. Nothing is published that wasn’t before. Reload the page to see the current state, then try again.`,
    fieldErrors: {},
  });

  // Every newly referenced object (cover or inline image) must exist in
  // Storage before a row points at it.
  const images = articleImagePaths(doc);
  const newCover = coverPath && coverPath !== currentCover ? coverPath : null;
  const newImages = images.filter((path) => !currentImages.has(path));
  if (newCover || newImages.length > 0) {
    const { paths, error } = await listMediaObjects(supabase, articleMediaPrefix(id));
    if (error) {
      console.error("[admin/articles] storage check failed:", error);
      return { status: "error", message: "Uploaded images could not be verified. Try again.", fieldErrors: {} };
    }
    const stored = new Set(paths);
    const missing: Record<string, string> = {};
    if (newCover && !stored.has(newCover)) missing.cover = "The cover upload didn’t finish. Upload it again.";
    if (newImages.some((path) => !stored.has(path))) {
      missing.body = "An image upload in the article didn’t finish. Remove that image and upload it again.";
    }
    if (Object.keys(missing).length > 0) {
      return { status: "error", message: "Check the highlighted fields.", fieldErrors: missing };
    }
  }

  // 1. Unpublish first.
  if (targetStatus === "draft" && currentStatus === "published") {
    const { error } = await supabase.from("articles").update({ status: "draft" }).eq("id", id);
    if (error) {
      console.error("[admin/articles] unpublish failed:", error.message);
      return { status: "error", message: "The Article could not be unpublished. Try again.", fieldErrors: {} };
    }
  }

  // 2. Content fields.
  {
    const { error } = await supabase
      .from("articles")
      .update({ ...values, cover_image_path: coverPath })
      .eq("id", id);
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return slugConflict();
      console.error("[admin/articles] update failed:", error.message);
      return { status: "error", message: "The Article could not be saved. Try again.", fieldErrors: {} };
    }
  }

  // 3. Tags.
  const tagError = await syncTagLinks(supabase, "article_tags", "article_id", id, tagIds);
  if (tagError) {
    console.error("[admin/articles] tag sync failed:", tagError);
    return partial("the tags");
  }

  // 4. Publish last.
  if (targetStatus === "published" && currentStatus !== "published") {
    const { error } = await supabase.from("articles").update({ status: "published" }).eq("id", id);
    if (error) {
      console.error("[admin/articles] publish failed:", error.message);
      return {
        status: "error",
        message: "Your changes were saved as a draft, but the Article could not be published. Try Publish again.",
        fieldErrors: {},
      };
    }
  }

  // 5. Storage cleanup, only now that the row no longer references the
  // removed objects. Safety rules:
  //   - keep everything this save wrote AND everything the row references
  //     right now (re-read), in case another save landed in between;
  //   - if that re-read fails, skip cleanup (orphans are harmless and are
  //     swept by a later save; deleting a used image is not);
  //   - only this Article's own folder and cover-/image- names: Article
  //     bodies and covers can only reference their own folder (validated
  //     above), and Analysis/Case Study media live under other prefixes, so
  //     nothing another record uses can be reached;
  //   - an object this save replaced or removed goes now; one that was
  //     never saved is kept for an hour (it may be another tab's upload).
  const written = coverPath ? [coverPath, ...images] : images;
  let leftovers = 0;
  const { data: after, error: rereadError } = await supabase
    .from("articles")
    .select("cover_image_path, body")
    .eq("id", id)
    .maybeSingle<{ cover_image_path: string | null; body: unknown }>();
  if (rereadError || !after) {
    console.error("[admin/articles] re-read before cleanup failed:", rereadError?.message ?? "row missing");
    leftovers = 1;
  } else {
    const previouslyReferenced = currentCover ? [currentCover, ...currentImages] : [...currentImages];
    leftovers = await removeUnreferencedMedia(
      supabase,
      articleMediaPrefix(id),
      [...written, ...referencedPaths(id, after.cover_image_path, after.body)],
      { isOwnedPath: ownedBy(id), previouslyReferenced, minAgeMs: UNSAVED_UPLOAD_GRACE_MS },
    );
  }

  revalidateArticleViews(id);
  const notice =
    targetStatus === currentStatus
      ? targetStatus === "published"
        ? "updated"
        : "saved"
      : targetStatus === "published"
        ? "published"
        : "unpublished";
  redirect(`/admin/articles/${id}/edit?notice=${notice}${leftovers ? "&problem=cleanup" : ""}`);
}

/**
 * Permanently deletes an Article. Its tag links and its row in
 * analysis_article_links cascade; an Analysis that linked to it keeps
 * existing, simply without a linked Article, so its "Read Article" link
 * disappears. The Article's Storage folder is emptied afterwards.
 */
export async function deleteArticle(_prev: EditorState, formData: FormData): Promise<EditorState> {
  await requireAdmin();

  const id = formString(formData, "id");
  if (!UUID_PATTERN.test(id)) {
    return { status: "error", message: "This Article could not be identified. Reload and try again.", fieldErrors: {} };
  }
  if (formString(formData, "confirm") !== "delete") {
    return { status: "error", message: "Confirm the deletion first.", fieldErrors: {} };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("articles").delete().eq("id", id).select("id");
  if (error) {
    console.error("[admin/articles] delete failed:", error.message);
    return { status: "error", message: "The Article could not be deleted. Try again.", fieldErrors: {} };
  }
  if (data.length === 0) {
    return { status: "error", message: "This Article no longer exists.", fieldErrors: {} };
  }

  // The row is gone, so nothing references the folder any more.
  const leftovers = await removeUnreferencedMedia(supabase, articleMediaPrefix(id), [], { isOwnedPath: ownedBy(id) });
  revalidateArticleViews();
  redirect(`/admin/articles?notice=deleted${leftovers ? "&problem=cleanup" : ""}`);
}
