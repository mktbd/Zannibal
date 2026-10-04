"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { TagWithUsage } from "@/lib/data/admin/tags";
import { TAG_NAME_MAX_LENGTH } from "@/lib/tags";
import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  linkButton,
  textInput,
} from "@/components/admin/ui";
import { deleteTag, renameTag, type TagActionState } from "./actions";

type Mode = "view" | "rename" | "confirm-delete";

// Each rename/delete attempt carries the edit session it came from, so an
// error from an earlier session isn't shown again after Cancel + reopen.
type RowActionState = TagActionState & { session?: number };

const initialState: RowActionState = { status: "idle" };

function withSession(
  action: (prev: TagActionState, formData: FormData) => Promise<TagActionState>,
) {
  return async (prev: RowActionState, formData: FormData): Promise<RowActionState> => ({
    ...(await action(prev, formData)),
    session: Number(formData.get("session")),
  });
}

const deleteWithSession = withSession(deleteTag);
const renameWithSession = withSession(renameTag);

export function TagRow({ tag }: { tag: TagWithUsage }) {
  const [mode, setMode] = useState<Mode>("view");
  const [draftName, setDraftName] = useState(tag.name);
  const [session, setSession] = useState(0);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const renameButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusToRow = useRef(false);

  const [renameState, renameAction, renaming] = useActionState(
    async (prev: RowActionState, formData: FormData) => {
      const result = await renameWithSession(prev, formData);
      if (result.status === "success") {
        returnFocusToRow.current = true;
        setMode("view");
      }
      return result;
    },
    initialState,
  );

  const [deleteState, deleteAction, deleting] = useActionState(deleteWithSession, initialState);

  // Move focus with the mode so keyboard users stay in place.
  useEffect(() => {
    if (mode === "rename") {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    } else if (mode === "confirm-delete") {
      cancelDeleteRef.current?.focus();
    } else if (returnFocusToRow.current) {
      returnFocusToRow.current = false;
      renameButtonRef.current?.focus();
    }
  }, [mode]);

  const startRename = () => {
    setDraftName(tag.name);
    setSession((n) => n + 1);
    setMode("rename");
  };

  const startDelete = () => {
    setSession((n) => n + 1);
    setMode("confirm-delete");
  };

  const backToView = () => {
    returnFocusToRow.current = true;
    setMode("view");
  };

  const inUse = tag.totalCount > 0;
  const formId = `rename-tag-${tag.id}`;
  const feedbackId = `tag-feedback-${tag.id}`;

  // The latest error for the action the row is currently showing.
  const error =
    mode === "rename" && renameState.status === "error" && renameState.session === session
      ? renameState.message
      : mode === "confirm-delete" && deleteState.status === "error" && deleteState.session === session
        ? deleteState.message
        : null;

  return (
    <tr className="border-b border-light-grey align-top last:border-b-0">
      <th scope="row" className="px-4 py-3 text-left font-medium">
        {mode === "rename" ? (
          <form id={formId} action={renameAction}>
            <input type="hidden" name="id" value={tag.id} />
            <input type="hidden" name="session" value={session} />
            <label htmlFor={`${formId}-name`} className="sr-only">
              New name for {tag.name}
            </label>
            <input
              ref={renameInputRef}
              id={`${formId}-name`}
              name="name"
              type="text"
              required
              maxLength={TAG_NAME_MAX_LENGTH}
              autoComplete="off"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  backToView();
                }
              }}
              aria-invalid={error !== null}
              aria-describedby={feedbackId}
              className={textInput}
            />
          </form>
        ) : (
          <span className="break-words">{tag.name}</span>
        )}
        {/* Narrow screens hide the per-type columns; show the split here. */}
        <span className="mt-0.5 block text-xs font-normal text-muted sm:hidden">
          Analysis {tag.analysisCount} · Case Studies {tag.caseStudyCount}
        </span>
        <p
          id={feedbackId}
          aria-live="polite"
          className={error ? "mt-1.5 text-sm font-normal text-red-700" : "sr-only"}
        >
          {error ?? ""}
        </p>
      </th>
      <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{tag.analysisCount}</td>
      <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{tag.caseStudyCount}</td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums">{tag.totalCount}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {/* Distinct keys per mode: without them React reuses the same
              <button> nodes across modes (Save becomes Rename, Cancel
              becomes Delete), and a click can land on a node whose type or
              handler changed mid-event -- e.g. reopening rename would
              instantly submit the form. */}
          {mode === "rename" ? (
            <>
              <button key="save" type="submit" form={formId} disabled={renaming} className={buttonPrimary}>
                {renaming ? "Saving…" : "Save"}
              </button>
              <button key="cancel-rename" type="button" onClick={backToView} disabled={renaming} className={buttonSecondary}>
                Cancel
              </button>
            </>
          ) : mode === "confirm-delete" ? (
            <form key="confirm-delete" action={deleteAction} className="flex flex-wrap items-center justify-end gap-2">
              <input type="hidden" name="id" value={tag.id} />
              <input type="hidden" name="session" value={session} />
              <span className="text-sm">Delete permanently?</span>
              <button type="submit" disabled={deleting} className={buttonDanger}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                ref={cancelDeleteRef}
                type="button"
                onClick={backToView}
                disabled={deleting}
                className={buttonSecondary}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button
                key="rename"
                ref={renameButtonRef}
                type="button"
                onClick={startRename}
                className={linkButton}
                aria-label={`Rename ${tag.name}`}
              >
                Rename
              </button>
              {inUse ? (
                <span key="in-use" className="text-sm text-muted">
                  In use
                  <span className="sr-only">
                    , cannot be deleted while attached to content
                  </span>
                </span>
              ) : (
                <button
                  key="delete"
                  type="button"
                  onClick={startDelete}
                  className={`${linkButton} text-red-700`}
                  aria-label={`Delete ${tag.name}`}
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
