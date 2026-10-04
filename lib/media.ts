/**
 * Editorial image rules shared by the browser uploader and the Server
 * Actions that record uploaded paths. The bucket itself enforces the same
 * MIME types and 5 MB limit (supabase/migrations/20261003000008_storage.sql);
 * checking here first gives the editor a clear message before uploading.
 *
 * Object paths (collision-resistant, never sequential or user-named):
 *   analysis/{analysis_id}/{uuid}.{ext}           Analysis slides
 *   case-studies/{case_study_id}/cover-{uuid}.{ext} Case Study covers
 */

export const MEDIA_BUCKET = "editorial-media";
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export const MEDIA_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type MediaType = keyof typeof MEDIA_TYPES;

export const MEDIA_ACCEPT = Object.keys(MEDIA_TYPES).join(",");

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EXT = "(jpg|png|webp)";

export function isMediaType(type: string): type is MediaType {
  return Object.hasOwn(MEDIA_TYPES, type);
}

/** Error message for a file that must not be uploaded, or null. */
export function validateImageFile(file: { name: string; type: string; size: number }): string | null {
  if (!isMediaType(file.type)) {
    return `“${file.name}” is not a JPEG, PNG or WebP image.`;
  }
  if (file.size > MEDIA_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `“${file.name}” is ${mb} MB; images can be at most 5 MB.`;
  }
  if (file.size === 0) {
    return `“${file.name}” is empty.`;
  }
  return null;
}

export function analysisSlidePrefix(analysisId: string): string {
  return `analysis/${analysisId}/`;
}

export function caseStudyCoverPrefix(caseStudyId: string): string {
  return `case-studies/${caseStudyId}/`;
}

export function newAnalysisSlidePath(analysisId: string, type: MediaType): string {
  return `${analysisSlidePrefix(analysisId)}${crypto.randomUUID()}.${MEDIA_TYPES[type]}`;
}

export function newCaseStudyCoverPath(caseStudyId: string, type: MediaType): string {
  return `${caseStudyCoverPrefix(caseStudyId)}cover-${crypto.randomUUID()}.${MEDIA_TYPES[type]}`;
}

/** True if `path` is a slide object belonging to this Analysis. */
export function isAnalysisSlidePath(analysisId: string, path: string): boolean {
  return new RegExp(`^analysis/${analysisId}/${UUID}\\.${EXT}$`).test(path);
}

/** True if `path` is a cover object belonging to this Case Study. */
export function isCaseStudyCoverPath(caseStudyId: string, path: string): boolean {
  return new RegExp(`^case-studies/${caseStudyId}/cover-${UUID}\\.${EXT}$`).test(path);
}

/**
 * Public delivery URL. The bucket is public, so objects are served by
 * path without consulting storage.objects RLS; listing stays admin-only
 * (migration 20261004000009).
 */
export function mediaPublicUrl(path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${encoded}`;
}
