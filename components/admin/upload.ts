"use client";

import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET } from "@/lib/media";

/**
 * Uploads one file straight from the browser to Supabase Storage under the
 * signed-in admin's own session, so the editorial-media INSERT policy
 * (bucket_id = 'editorial-media' AND is_admin()) decides whether it is
 * allowed. XMLHttpRequest rather than supabase-js so the editor can show
 * real progress; the request is the same one storage.upload() makes.
 *
 * Never overwrites (x-upsert: false): paths are fresh UUIDs.
 */
export async function uploadMedia(
  path: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, message: "Your session has expired. Sign in again to upload." };
  }

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${encodedPath}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve({ ok: true });
        return;
      }
      resolve({ ok: false, message: describeStorageError(xhr.status, xhr.responseText) });
    };
    xhr.onerror = () => resolve({ ok: false, message: "Network error while uploading. Check the connection and try again." });
    xhr.send(file);
  });
}

/** Best-effort removal of an object that was uploaded but never saved. */
export async function discardUnsavedMedia(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}

function describeStorageError(status: number, body: string): string {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    detail = parsed.message ?? parsed.error ?? "";
  } catch {
    // Non-JSON body; fall through to the status-based message.
  }
  if (status === 413 || /maximum allowed size|too large/i.test(detail)) {
    return "The image is larger than the 5 MB limit.";
  }
  if (/mime type/i.test(detail)) {
    return "Only JPEG, PNG and WebP images can be uploaded.";
  }
  if (status === 401 || status === 403 || /row-level security|unauthorized/i.test(detail)) {
    return "Upload not permitted. Sign in again with an admin account.";
  }
  return detail ? `Upload failed: ${detail}` : `Upload failed (HTTP ${status}).`;
}
