"use client";

import { useActionState, useState } from "react";
import { TAG_NAME_MAX_LENGTH } from "@/lib/tags";
import { buttonPrimary, textInput } from "@/components/admin/ui";
import { createTag, type TagActionState } from "./actions";

const initialState: TagActionState = { status: "idle" };

export function TagCreateForm() {
  // Controlled so a failed submission keeps what was typed (React resets
  // uncontrolled fields after every form action).
  const [name, setName] = useState("");

  const [state, formAction, pending] = useActionState(
    async (prev: TagActionState, formData: FormData) => {
      const result = await createTag(prev, formData);
      if (result.status === "success") {
        setName("");
      }
      return result;
    },
    initialState,
  );

  const hasError = state.status === "error";

  return (
    <form action={formAction} className="border border-light-grey bg-white p-4">
      <label htmlFor="new-tag-name" className="text-sm font-medium">
        New tag
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          id="new-tag-name"
          name="name"
          type="text"
          required
          maxLength={TAG_NAME_MAX_LENGTH}
          autoComplete="off"
          placeholder="e.g. Fintech"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={hasError}
          aria-describedby="new-tag-feedback"
          className={`${textInput} sm:max-w-sm`}
        />
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "Creating…" : "Create tag"}
        </button>
      </div>
      <p
        id="new-tag-feedback"
        aria-live="polite"
        className={`mt-2 min-h-5 text-sm ${hasError ? "text-red-700" : "text-muted"}`}
      >
        {state.status === "idle" ? "" : state.message}
      </p>
    </form>
  );
}
