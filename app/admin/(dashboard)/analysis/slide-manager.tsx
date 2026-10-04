"use client";

import { useEffect, useRef, useState } from "react";
import {
  isMediaType,
  MEDIA_ACCEPT,
  mediaPublicUrl,
  newAnalysisSlidePath,
  validateImageFile,
} from "@/lib/media";
import { discardUnsavedMedia, uploadMedia } from "@/components/admin/upload";
import { buttonSecondary, linkButton } from "@/components/admin/ui";

interface SlideItem {
  key: string;
  /** analysis_slides.id for persisted slides; null for uploads not yet saved. */
  id: string | null;
  path: string;
  src: string;
  state: "ready" | "uploading" | "failed";
  progress: number;
  error?: string;
  fileName?: string;
}

/**
 * Ordered slide list for one Analysis. Files go straight to Storage from
 * the browser (admin session, Storage RLS); the order and paths are sent
 * to the Server Action as the hidden `slides` field when the editor saves.
 * Nothing here deletes a persisted slide's object -- the server does that
 * after the save that removes the row succeeds.
 */
export function SlideManager({
  analysisId,
  initialSlides,
  error,
  onChange,
  onBusyChange,
}: {
  analysisId: string;
  initialSlides: { id: string; storagePath: string }[];
  error?: string;
  onChange: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<SlideItem[]>(() =>
    initialSlides.map((slide) => ({
      key: slide.id,
      id: slide.id,
      path: slide.storagePath,
      src: mediaPublicUrl(slide.storagePath),
      state: "ready",
      progress: 1,
    })),
  );
  const [rejected, setRejected] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  const busy = items.some((item) => item.state === "uploading");
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const update = (key: string, patch: Partial<SlideItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const addFiles = async (files: File[]) => {
    const problems: string[] = [];
    const queued: { item: SlideItem; file: File }[] = [];
    for (const file of files) {
      const invalid = validateImageFile(file);
      if (invalid || !isMediaType(file.type)) {
        problems.push(invalid ?? `“${file.name}” is not a supported image.`);
        continue;
      }
      const src = URL.createObjectURL(file);
      objectUrls.current.push(src);
      const path = newAnalysisSlidePath(analysisId, file.type);
      queued.push({
        file,
        item: { key: path, id: null, path, src, state: "uploading", progress: 0, fileName: file.name },
      });
    }
    setRejected(problems);
    if (queued.length === 0) return;

    setItems((list) => [...list, ...queued.map((q) => q.item)]);
    onChange();
    setAnnouncement(`Uploading ${queued.length} ${queued.length === 1 ? "image" : "images"}.`);

    // One at a time keeps progress readable and the order deterministic.
    let failed = 0;
    for (const { item, file } of queued) {
      const result = await uploadMedia(item.path, file, (progress) => update(item.key, { progress }));
      if (result.ok) {
        update(item.key, { state: "ready", progress: 1 });
      } else {
        failed += 1;
        update(item.key, { state: "failed", error: result.message });
      }
    }
    setAnnouncement(
      failed === 0
        ? `${queued.length} ${queued.length === 1 ? "image" : "images"} uploaded. Save to keep ${queued.length === 1 ? "it" : "them"}.`
        : `${failed} of ${queued.length} uploads failed.`,
    );
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((list) => {
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    onChange();
    setAnnouncement(`Slide moved from position ${from + 1} to position ${to + 1} of ${items.length}.`);
  };

  const remove = (index: number) => {
    const item = items[index];
    setItems((list) => list.filter((_, i) => i !== index));
    onChange();
    setAnnouncement(`Slide ${index + 1} removed. Save to apply.`);
    // A slide uploaded in this session but never saved is referenced by
    // nothing, so it can go immediately. Persisted slides are removed from
    // Storage by the server only after the save succeeds.
    if (item.id === null && item.state === "ready") void discardUnsavedMedia(item.path);
  };

  const ready = items.filter((item) => item.state === "ready");
  const payload = JSON.stringify(ready.map((item) => ({ id: item.id, path: item.path })));

  return (
    <div>
      <input type="hidden" name="slides" value={payload} />

      <div
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) {
            event.preventDefault();
            setFileDragActive(true);
          }
        }}
        onDragLeave={() => setFileDragActive(false)}
        onDrop={(event) => {
          if (event.dataTransfer.files.length > 0) {
            event.preventDefault();
            setFileDragActive(false);
            void addFiles([...event.dataTransfer.files]);
          }
        }}
        className={`flex flex-col items-start gap-2 border border-dashed px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
          fileDragActive ? "border-black bg-white" : "border-light-grey bg-white"
        }`}
      >
        <p className="text-sm text-muted">
          JPEG, PNG or WebP, up to 5 MB each. Drop files here or choose them.
          Slides are shown uncropped, in this order.
        </p>
        <input
          ref={fileInputRef}
          id="slide-files"
          type="file"
          accept={MEDIA_ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            void addFiles(files);
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonSecondary}>
          Add images
        </button>
      </div>

      {rejected.length > 0 ? (
        <ul role="alert" className="mt-2 space-y-0.5 text-sm text-red-700">
          {rejected.map((problem) => (
            <li key={problem}>{problem} Not uploaded.</li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id="slides-message" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No slides yet. At least one is needed to publish.</p>
      ) : (
        <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Slides in order">
          {items.map((item, index) => (
            <li
              key={item.key}
              draggable={item.state === "ready"}
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(event) => {
                if (dragIndex !== null) {
                  event.preventDefault();
                  setDropIndex(index);
                }
              }}
              onDrop={(event) => {
                if (dragIndex !== null) {
                  event.preventDefault();
                  move(dragIndex, index);
                }
                setDragIndex(null);
                setDropIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDropIndex(null);
              }}
              className={`flex flex-col border bg-white ${
                dropIndex === index && dragIndex !== index ? "border-black" : "border-light-grey"
              } ${dragIndex === index ? "opacity-50" : ""} ${item.state === "ready" ? "cursor-grab" : ""}`}
            >
              <div className="relative flex h-44 items-center justify-center bg-off-white p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an arbitrary uploaded image; shown uncropped */}
                <img
                  src={item.src}
                  alt={`Slide ${index + 1}`}
                  className={`max-h-full max-w-full object-contain ${item.state !== "ready" ? "opacity-40" : ""}`}
                  draggable={false}
                />
                <span className="absolute left-1.5 top-1.5 bg-black px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white">
                  {index + 1}
                </span>
                {item.state === "uploading" ? (
                  <div className="absolute inset-x-3 bottom-3">
                    <div
                      role="progressbar"
                      aria-label={`Uploading ${item.fileName ?? "image"}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(item.progress * 100)}
                      className="h-1 bg-light-grey"
                    >
                      <div className="h-1 bg-black" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                    </div>
                  </div>
                ) : null}
              </div>
              {item.state === "failed" ? (
                <p className="px-2 pt-1.5 text-xs text-red-700">{item.error}</p>
              ) : item.id === null && item.state === "ready" ? (
                <p className="px-2 pt-1.5 text-xs text-muted">New — save to keep</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-1.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0 || item.state !== "ready"}
                    aria-label={`Move slide ${index + 1} up`}
                    className={linkButton}
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === items.length - 1 || item.state !== "ready"}
                    aria-label={`Move slide ${index + 1} down`}
                    className={linkButton}
                  >
                    ↓ Down
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={item.state === "uploading"}
                  aria-label={`Remove slide ${index + 1}`}
                  className={`${linkButton} text-red-700`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
