/**
 * Result of an editor Server Action that did not redirect. Successful
 * saves redirect (so the editor reloads with exactly what was persisted)
 * and are reported through the `notice` search param instead.
 */
export type EditorState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> };

export const initialEditorState: EditorState = { status: "idle" };

const NOTICES: Record<string, string> = {
  created: "Draft created. You can now add images.",
  saved: "Draft saved.",
  updated: "Changes saved. The published version is updated.",
  published: "Published. It is now publicly visible.",
  unpublished: "Unpublished. It is now a draft and hidden from the public.",
  deleted: "Deleted.",
};

const PROBLEMS: Record<string, string> = {
  tags: "The tags could not be saved. Select them again and save.",
  cleanup:
    "Some replaced or removed images could not be deleted from storage. They are not used anywhere and will be cleaned up on the next save.",
};

export function noticeText(notice: string | undefined): string | null {
  return notice ? (NOTICES[notice] ?? null) : null;
}

export function problemText(problem: string | undefined): string | null {
  return problem ? (PROBLEMS[problem] ?? null) : null;
}
