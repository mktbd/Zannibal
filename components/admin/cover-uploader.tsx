"use client";

import { useEffect, useRef, useState } from "react";
import { isMediaType, MEDIA_ACCEPT, mediaPublicUrl, validateImageFile, type MediaType } from "@/lib/media";
import { discardUnsavedMedia, uploadMedia } from "@/components/admin/upload";
import { buttonSecondary, linkButton } from "@/components/admin/ui";

interface CoverState {
  path: string;
  src: string;
  /** Uploaded in this session and not yet saved. */
  unsaved: boolean;
}

/**
 * Single cover image for a Case Study (portrait) or an Article
 * (landscape). Uploads go straight to Storage under the admin session to a
 * fresh path from `newPath`; the chosen path is submitted as `coverPath`.
 * A replaced or removed cover that was already saved is deleted by the
 * server after the save succeeds, never before.
 */
export function CoverUploader({
  newPath,
  frame = "portrait",
  hint = "JPEG, PNG or WebP, up to 5 MB.",
  initialPath,
  error,
  onChange,
  onBusyChange,
}: {
  /** A new, unused Storage path for an image of this type. */
  newPath: (type: MediaType) => string;
  frame?: "portrait" | "landscape";
  hint?: string;
  initialPath: string | null;
  error?: string;
  onChange: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [cover, setCover] = useState<CoverState | null>(
    initialPath ? { path: initialPath, src: mediaPublicUrl(initialPath), unsaved: false } : null,
  );
  const [upload, setUpload] = useState<{ progress: number; name: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => onBusyChange(upload !== null), [upload, onBusyChange]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const replaceWith = (next: CoverState | null) => {
    if (cover?.unsaved) void discardUnsavedMedia(cover.path);
    setCover(next);
    onChange();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid || !isMediaType(file.type)) {
      setProblem(`${invalid ?? "Unsupported image."} Not uploaded.`);
      return;
    }
    setProblem(null);
    const path = newPath(file.type);
    setUpload({ progress: 0, name: file.name });
    setAnnouncement("Uploading cover.");
    const result = await uploadMedia(path, file, (progress) => setUpload({ progress, name: file.name }));
    setUpload(null);
    if (!result.ok) {
      setProblem(result.message);
      setAnnouncement("Cover upload failed.");
      return;
    }
    const src = URL.createObjectURL(file);
    objectUrls.current.push(src);
    replaceWith({ path, src, unsaved: true });
    setAnnouncement("Cover uploaded. Save to keep it.");
  };

  return (
    <div>
      <input type="hidden" name="coverPath" value={cover?.path ?? ""} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={`flex shrink-0 items-center justify-center border border-light-grey bg-off-white p-1.5 ${
            frame === "landscape" ? "aspect-[16/9] w-full sm:w-72" : "h-56 w-44"
          }`}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded cover, uncropped
            <img src={cover.src} alt="Cover image" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-3 text-center text-xs text-muted">No cover</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-muted">{hint}</p>
          <input
            ref={inputRef}
            id="cover-file"
            type="file"
            accept={MEDIA_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload !== null}
            className={buttonSecondary}
          >
            {cover ? "Replace cover" : "Upload cover"}
          </button>
          {cover ? (
            <button
              type="button"
              onClick={() => {
                replaceWith(null);
                setAnnouncement("Cover removed. Save to apply.");
              }}
              disabled={upload !== null}
              className={`${linkButton} text-red-700`}
            >
              Remove cover
            </button>
          ) : null}
          {cover?.unsaved ? <p className="text-xs text-muted">New cover — save to keep it.</p> : null}
          {upload ? (
            <div className="w-48">
              <div
                role="progressbar"
                aria-label={`Uploading ${upload.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(upload.progress * 100)}
                className="h-1 bg-light-grey"
              >
                <div className="h-1 bg-black" style={{ width: `${Math.round(upload.progress * 100)}%` }} />
              </div>
            </div>
          ) : null}
          {problem ? (
            <p role="alert" className="text-sm text-red-700">
              {problem}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>
      </div>
    </div>
  );
}
