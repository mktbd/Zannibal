"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ContentStatus } from "@/lib/types/content";
import { StatusBadge } from "./status-badge";
import { buttonDanger, buttonPrimary, buttonSecondary } from "./ui";
import { initialEditorState, type EditorState } from "./editor-state";

/** Warns before leaving the page (reload/close/external link) with unsaved edits. */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/**
 * Slug that follows the title until the editor changes it by hand. Once
 * touched (or for an existing record) it never changes on its own.
 */
export function useAutoSlug(initialSlug: string, followTitle: boolean, slugify: (text: string) => string) {
  const [slug, setSlug] = useState(initialSlug);
  const [touched, setTouched] = useState(!followTitle);
  return {
    slug,
    touched,
    onTitleChange(title: string) {
      if (!touched) setSlug(slugify(title));
    },
    onSlugChange(value: string) {
      setTouched(true);
      setSlug(value);
    },
    resetToTitle(title: string) {
      setTouched(false);
      setSlug(slugify(title));
    },
  };
}

/** Banner for the outcome of the last save (carried in the URL after redirect). */
export function SaveNotice({ notice, problem }: { notice: string | null; problem: string | null }) {
  if (!notice && !problem) return null;
  return (
    <div className="mt-4 space-y-2">
      {notice ? (
        <p role="status" className="border-l-2 border-black bg-white px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="border-l-2 border-red-700 bg-white px-3 py-2 text-sm text-red-700">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level error summary shown above the fields after a failed save. */
export function FormError({ state }: { state: EditorState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error") ref.current?.focus();
  }, [state]);
  if (state.status !== "error") return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="mt-4 border-l-2 border-red-700 bg-white px-3 py-2 text-sm text-red-700"
    >
      {state.message}
    </div>
  );
}

/**
 * Sticky bar with the explicit status transitions:
 *   new:        Save draft
 *   draft:      Save draft · Publish
 *   published:  Update · Unpublish
 */
export function EditorActionBar({
  mode,
  status,
  pending,
  blocked,
  blockedReason,
  previewHref,
  dirty,
}: {
  mode: "create" | "edit";
  status: ContentStatus;
  pending: boolean;
  blocked: boolean;
  blockedReason?: string;
  previewHref?: string;
  dirty: boolean;
}) {
  const disabled = pending || blocked;
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-light-grey bg-off-white/95 px-4 py-3 backdrop-blur-[2px] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-sm">
          <StatusBadge status={status} />
          <span className="text-muted" aria-live="polite">
            {pending ? "Saving…" : blocked ? blockedReason : dirty ? "Unsaved changes" : null}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {previewHref ? (
            <Link href={previewHref} className={buttonSecondary} target="_blank" rel="noopener">
              Preview
            </Link>
          ) : null}
          {mode === "create" || status === "draft" ? (
            <>
              <button type="submit" name="intent" value="save" disabled={disabled} className={buttonSecondary}>
                Save draft
              </button>
              {mode === "edit" ? (
                <button type="submit" name="intent" value="publish" disabled={disabled} className={buttonPrimary}>
                  Publish
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button type="submit" name="intent" value="unpublish" disabled={disabled} className={buttonSecondary}>
                Unpublish
              </button>
              <button type="submit" name="intent" value="save" disabled={disabled} className={buttonPrimary}>
                Update
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Separate, explicitly confirmed delete form. */
export function DeleteSection({
  id,
  label,
  consequence,
  action,
}: {
  id: string;
  label: string;
  consequence: string;
  action: (prev: EditorState, formData: FormData) => Promise<EditorState>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialEditorState);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Move focus with the confirmation so keyboard users stay in place.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
    else if (wasConfirming.current) openRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  return (
    <section aria-labelledby="delete-heading" className="mt-10 border-t border-light-grey pt-6">
      <h2 id="delete-heading" className="text-sm font-semibold">
        Delete {label}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted">{consequence}</p>
      {confirming ? (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2 border border-red-700 bg-white p-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="confirm" value="delete" />
          <span className="text-sm font-medium">Delete this {label} permanently? This cannot be undone.</span>
          <button type="submit" disabled={pending} className={buttonDanger}>
            {pending ? "Deleting…" : "Delete permanently"}
          </button>
          <button
            ref={cancelRef}
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className={buttonSecondary}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          ref={openRef}
          type="button"
          onClick={() => setConfirming(true)}
          className={`${buttonSecondary} mt-3 text-red-700`}
        >
          Delete {label}…
        </button>
      )}
      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
