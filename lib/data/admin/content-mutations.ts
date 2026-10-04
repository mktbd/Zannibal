import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/media";

/**
 * Building blocks shared by the Analysis and Case Study Server Actions.
 * Every call goes through the admin's own session (anon key + cookies),
 * so Postgres and Storage RLS decide what is allowed -- the service-role
 * client is never used here.
 */

export type SessionClient = Awaited<ReturnType<typeof createClient>>;

// Postgres error codes surfaced by PostgREST.
export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Makes the join table rows for one record exactly `tagIds`: removes links
 * that are no longer selected, adds the new ones. Returns an error message
 * or null.
 */
export async function syncTagLinks(
  supabase: SessionClient,
  table: "analysis_tags" | "case_study_tags",
  ownerColumn: "analysis_id" | "case_study_id",
  ownerId: string,
  tagIds: string[],
): Promise<string | null> {
  const { data: current, error: readError } = await supabase
    .from(table)
    .select("tag_id")
    .eq(ownerColumn, ownerId)
    .overrideTypes<{ tag_id: string }[], { merge: false }>();
  if (readError) return readError.message;

  const currentIds = new Set(current.map((row) => row.tag_id));
  const wanted = new Set(tagIds);
  const toRemove = [...currentIds].filter((id) => !wanted.has(id));
  const toAdd = tagIds.filter((id) => !currentIds.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(ownerColumn, ownerId)
      .in("tag_id", toRemove);
    if (error) return error.message;
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from(table)
      .insert(toAdd.map((tagId) => ({ [ownerColumn]: ownerId, tag_id: tagId })));
    if (error) {
      return error.code === FOREIGN_KEY_VIOLATION
        ? "One of the selected tags no longer exists. Reload and choose again."
        : error.message;
    }
  }

  return null;
}

/** Full paths of every object stored under `prefix` (a "folder"). */
export async function listMediaObjects(
  supabase: SessionClient,
  prefix: string,
): Promise<{ paths: string[]; error: string | null }> {
  const folder = prefix.replace(/\/$/, "");
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list(folder, { limit: 1000 });
  if (error) return { paths: [], error: error.message };
  return {
    // Folder placeholders have no id; only real objects are returned.
    paths: data.filter((item) => item.id).map((item) => `${folder}/${item.name}`),
    error: null,
  };
}

/**
 * Removes every object under `prefix` that is not in `keep`. Called only
 * AFTER the database write that stopped referencing them has succeeded, so
 * a failed save can never leave a row pointing at a deleted image. Also
 * sweeps up uploads from earlier sessions that were never saved.
 * Returns how many unreferenced objects could not be removed.
 */
export async function removeUnreferencedMedia(
  supabase: SessionClient,
  prefix: string,
  keep: Iterable<string>,
): Promise<number> {
  const keepSet = new Set(keep);
  const { paths, error } = await listMediaObjects(supabase, prefix);
  if (error) {
    console.error(`[admin/media] list ${prefix} failed:`, error);
    return 1;
  }
  const stale = paths.filter((path) => !keepSet.has(path));
  if (stale.length === 0) return 0;

  const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove(stale);
  if (removeError) {
    console.error(`[admin/media] remove under ${prefix} failed:`, removeError.message);
    return stale.length;
  }
  return 0;
}

/** Title of the other record that already uses `slug`, if any. */
export async function slugOwnerTitle(
  supabase: SessionClient,
  table: "analyses" | "case_studies",
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(table)
    .select("title")
    .eq("slug", slug)
    .maybeSingle<{ title: string }>();
  return data?.title ?? null;
}
