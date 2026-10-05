/**
 * An Analysis is presented by its first carousel slide (lowest position).
 * Returns that slide's storage path, or null when there is no usable slide
 * -- callers then show a typographic cover instead of an image.
 */
export function coverSlidePath(
  slides: readonly { position: number; storage_path: string | null }[] | null | undefined,
): string | null {
  if (!Array.isArray(slides) || slides.length === 0) return null;
  const usable = slides.filter(
    (slide) => typeof slide.position === "number" && typeof slide.storage_path === "string" && slide.storage_path.trim() !== "",
  );
  if (usable.length === 0) return null;
  return usable.reduce((first, slide) => (slide.position < first.position ? slide : first)).storage_path;
}
