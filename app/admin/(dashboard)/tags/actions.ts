"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanTagName, normalizeTagName, validateTagName } from "@/lib/tags";

export type TagActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres error codes surfaced by PostgREST.
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function readTagId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "");
  return UUID_PATTERN.test(id) ? id : null;
}

function revalidateTagViews() {
  revalidatePath("/admin/tags");
  // Dashboard shows the total tag count.
  revalidatePath("/admin");
}

/**
 * Message for a create/rename that hit tags_normalized_name_key. Names the
 * existing tag when it can be found, so the editor can pick it instead.
 */
async function duplicateMessage(
  supabase: SupabaseClient,
  name: string,
): Promise<string> {
  const { data } = await supabase
    .from("tags")
    .select("name")
    .eq("normalized_name", normalizeTagName(name))
    .maybeSingle<{ name: string }>();

  return data
    ? `A tag named “${data.name}” already exists. Tags that differ only by capitalisation or spacing count as the same tag.`
    : "A tag with that name already exists.";
}

type InsertTagResult =
  | { ok: true; tag: { id: string; name: string } }
  | { ok: false; message: string };

/**
 * The single create path for tags, used by the Tags screen and by the
 * inline "Create tag" option in the Analysis/Case Study editors, so both
 * apply the same cleaning, validation and duplicate handling.
 */
async function insertTag(rawName: string): Promise<InsertTagResult> {
  const name = cleanTagName(rawName);
  const invalid = validateTagName(name);
  if (invalid) {
    return { ok: false, message: invalid };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .insert({ name })
    .select("id, name")
    .single<{ id: string; name: string }>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, message: await duplicateMessage(supabase, name) };
    }
    console.error("[admin/tags] create failed:", error.message);
    return { ok: false, message: "The tag could not be created. Try again." };
  }

  revalidateTagViews();
  return { ok: true, tag: data };
}

export async function createTag(
  _prev: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  await requireAdmin();

  const result = await insertTag(String(formData.get("name") ?? ""));
  return result.ok
    ? { status: "success", message: `Created “${result.tag.name}”.` }
    : { status: "error", message: result.message };
}

/** Inline creation from the content editors' tag selector. */
export async function createTagInline(rawName: string): Promise<InsertTagResult> {
  await requireAdmin();
  return insertTag(typeof rawName === "string" ? rawName : "");
}

export async function renameTag(
  _prev: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  await requireAdmin();

  const id = readTagId(formData);
  if (!id) {
    return { status: "error", message: "That tag could not be identified." };
  }

  const name = cleanTagName(String(formData.get("name") ?? ""));
  const invalid = validateTagName(name);
  if (invalid) {
    return { status: "error", message: invalid };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .update({ name })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { status: "error", message: await duplicateMessage(supabase, name) };
    }
    console.error("[admin/tags] rename failed:", error.message);
    return { status: "error", message: "The tag could not be renamed. Try again." };
  }
  if (data.length === 0) {
    revalidateTagViews();
    return { status: "error", message: "That tag no longer exists." };
  }

  revalidateTagViews();
  return { status: "success", message: `Renamed to “${name}”.` };
}

export async function deleteTag(
  _prev: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  await requireAdmin();

  const id = readTagId(formData);
  if (!id) {
    return { status: "error", message: "That tag could not be identified." };
  }

  const supabase = await createClient();

  // Checked here for a clear message; the ON DELETE RESTRICT foreign keys
  // on analysis_tags/case_study_tags enforce the same rule in the database
  // (and cover the race where content is tagged between check and delete).
  const [analysisLinks, caseStudyLinks] = await Promise.all([
    supabase
      .from("analysis_tags")
      .select("tag_id", { count: "exact", head: true })
      .eq("tag_id", id),
    supabase
      .from("case_study_tags")
      .select("tag_id", { count: "exact", head: true })
      .eq("tag_id", id),
  ]);

  if (analysisLinks.error || caseStudyLinks.error) {
    console.error(
      "[admin/tags] usage check failed:",
      analysisLinks.error?.message ?? caseStudyLinks.error?.message,
    );
    return { status: "error", message: "The tag could not be deleted. Try again." };
  }

  const inUse = (analysisLinks.count ?? 0) + (caseStudyLinks.count ?? 0);
  if (inUse > 0) {
    return {
      status: "error",
      message: `This tag is attached to ${inUse} ${inUse === 1 ? "entry" : "entries"}. Remove it from that content before deleting it.`,
    };
  }

  const { data, error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .select("name");

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      revalidateTagViews();
      return {
        status: "error",
        message: "This tag is now attached to content. Remove it from that content before deleting it.",
      };
    }
    console.error("[admin/tags] delete failed:", error.message);
    return { status: "error", message: "The tag could not be deleted. Try again." };
  }
  if (data.length === 0) {
    revalidateTagViews();
    return { status: "error", message: "That tag no longer exists." };
  }

  revalidateTagViews();
  return { status: "success", message: `Deleted “${data[0].name}”.` };
}
