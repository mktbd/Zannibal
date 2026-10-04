"use client";

import { useActionState, useCallback, useState } from "react";
import { slugify } from "@/lib/slug";
import type { ContentStatus } from "@/lib/types/content";
import { FormField, fieldA11y } from "@/components/admin/form-field";
import { TagSelector, type TagOption } from "@/components/admin/tag-selector";
import { EditorActionBar, FormError, useAutoSlug, useUnsavedChangesWarning } from "@/components/admin/editor-parts";
import { initialEditorState } from "@/components/admin/editor-state";
import { linkButton, textInput } from "@/components/admin/ui";
import { saveAnalysis } from "./actions";
import { SlideManager } from "./slide-manager";

export interface AnalysisEditorValues {
  id: string | null;
  title: string;
  slug: string;
  publicationDate: string;
  linkedinUrl: string;
  status: ContentStatus;
  tagIds: string[];
  slides: { id: string; storagePath: string }[];
}

export function AnalysisEditor({ values, allTags }: { values: AnalysisEditorValues; allTags: TagOption[] }) {
  const mode = values.id ? "edit" : "create";
  const [state, formAction, pending] = useActionState(saveAnalysis, initialEditorState);
  const errors = state.status === "error" ? state.fieldErrors : {};

  const [title, setTitle] = useState(values.title);
  const slug = useAutoSlug(values.slug, mode === "create", slugify);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);
  useUnsavedChangesWarning(dirty && !pending);

  return (
    <form action={formAction} noValidate onChange={markDirty} className="mt-2">
      <input type="hidden" name="mode" value={mode} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormError state={state} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-labelledby="details-heading" className="flex flex-col gap-5 border border-light-grey bg-white p-5">
          <h2 id="details-heading" className="text-sm font-semibold">
            Details
          </h2>

          <FormField id="title" label="Title" required error={errors.title}>
            <input
              {...fieldA11y("title", errors.title)}
              name="title"
              type="text"
              maxLength={200}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                slug.onTitleChange(event.target.value);
              }}
              className={`${textInput} text-base font-medium`}
            />
          </FormField>

          <FormField
            id="slug"
            label="Slug"
            required
            error={errors.slug}
            hint={
              mode === "create"
                ? slug.touched
                  ? "Edited by hand; title changes no longer update it."
                  : "Generated from the title. Edit it to set your own."
                : "Changing the slug changes the public URL."
            }
          >
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center rounded-sm border border-light-grey bg-white focus-within:border-black">
                <span className="hidden pl-3 text-sm text-muted sm:inline">/analysis/</span>
                <input
                  {...fieldA11y("slug", errors.slug)}
                  name="slug"
                  type="text"
                  maxLength={80}
                  value={slug.slug}
                  onChange={(event) => slug.onSlugChange(event.target.value)}
                  onBlur={(event) => {
                    const normalized = slugify(event.target.value);
                    if (normalized !== event.target.value) slug.onSlugChange(normalized);
                  }}
                  className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-sm outline-none sm:pl-0.5"
                />
              </div>
              {mode === "create" && slug.touched ? (
                <button type="button" onClick={() => slug.resetToTitle(title)} className={linkButton}>
                  Use title
                </button>
              ) : null}
            </div>
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="publicationDate" label="Publication date" required error={errors.publicationDate}>
              <input
                {...fieldA11y("publicationDate", errors.publicationDate)}
                name="publicationDate"
                type="date"
                defaultValue={values.publicationDate}
                className={textInput}
              />
            </FormField>
            <FormField
              id="linkedinUrl"
              label="LinkedIn URL"
              error={errors.linkedinUrl}
              hint="Optional. The original LinkedIn post."
            >
              <input
                {...fieldA11y("linkedinUrl", errors.linkedinUrl)}
                name="linkedinUrl"
                type="url"
                inputMode="url"
                placeholder="https://www.linkedin.com/…"
                maxLength={500}
                defaultValue={values.linkedinUrl}
                className={textInput}
              />
            </FormField>
          </div>

          <FormField id="tags" label="Tags" error={errors.tags}>
            <TagSelector allTags={allTags} initialSelectedIds={values.tagIds} onChange={markDirty} inputId="tags" />
          </FormField>
        </section>

        <aside className="flex flex-col gap-3 text-sm">
          <div className="border border-light-grey bg-white p-4">
            <h2 className="font-semibold">Publishing</h2>
            <p className="mt-1 text-muted">
              {values.status === "published"
                ? "Live. Saving with Update changes the public version immediately."
                : "Draft. Not visible to the public until published."}
            </p>
            <p className="mt-2 text-muted">To publish: title, slug, date and at least one slide.</p>
          </div>
        </aside>
      </div>

      <section aria-labelledby="slides-heading" className="mt-6 border border-light-grey bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h2 id="slides-heading" className="text-sm font-semibold">
            Carousel slides
          </h2>
          <span className="text-xs text-muted">Required to publish</span>
        </div>
        <div className="mt-3">
          {values.id ? (
            <SlideManager
              analysisId={values.id}
              initialSlides={values.slides}
              error={errors.slides}
              onChange={markDirty}
              onBusyChange={setUploading}
            />
          ) : (
            <p className="text-sm text-muted">Save the draft first, then add slides.</p>
          )}
        </div>
      </section>

      <EditorActionBar
        mode={mode}
        status={values.status}
        pending={pending}
        blocked={uploading}
        blockedReason="Waiting for uploads to finish…"
        previewHref={values.id ? `/admin/analysis/${values.id}/preview` : undefined}
        dirty={dirty}
      />
    </form>
  );
}
