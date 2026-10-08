/**
 * Which stored objects a cleanup may delete. Pure and framework-free so the
 * rules are unit-tested (tests/unit/media-cleanup.test.mjs); the Storage
 * calls live in lib/data/admin/content-mutations.ts.
 */

export interface StoredObject {
  path: string;
  /** Upload time from the Storage listing (ISO), if known. */
  createdAt: string | null;
}

export interface CleanupOptions {
  /**
   * Only objects this accepts may be deleted (e.g. the record's own
   * cover-/image- names); anything else in the folder is left alone.
   */
  isOwnedPath?: (path: string) => boolean;
  /**
   * Grace period for objects that were never referenced: an upload younger
   * than this may belong to an editor that hasn't saved yet (another tab or
   * session), so it is kept and swept by a later save. Objects in
   * `previouslyReferenced` (replaced or removed by this save) are deleted
   * immediately.
   */
  minAgeMs?: number;
  previouslyReferenced?: Iterable<string>;
}

export function selectStaleMedia(
  objects: readonly StoredObject[],
  keep: Iterable<string>,
  options: CleanupOptions = {},
  now: number = Date.now(),
): string[] {
  const keepSet = new Set(keep);
  const previously = new Set(options.previouslyReferenced ?? []);
  return objects
    .filter(({ path, createdAt }) => {
      if (keepSet.has(path)) return false;
      if (options.isOwnedPath && !options.isOwnedPath(path)) return false;
      if (options.minAgeMs !== undefined && !previously.has(path)) {
        const created = createdAt ? Date.parse(createdAt) : NaN;
        // Unknown age counts as fresh: keeping an orphan is always safe.
        if (!(now - created >= options.minAgeMs)) return false;
      }
      return true;
    })
    .map(({ path }) => path);
}
