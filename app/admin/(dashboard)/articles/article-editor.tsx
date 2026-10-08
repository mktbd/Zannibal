"use client";

import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { slugify } from "@/lib/slug";
import { newArticleCoverPath } from "@/lib/media";
import type { ArticleDoc } from "@/lib/article-body";
import type { ContentStatus } from "@/lib/types/content";
import type { LinkedAnalysis } from "@/lib/data/admin/content";
import { FormField, fieldA11y } from "@/components/admin/form-field";
import { TagSelector, type TagOption } from "@/components/admin/tag-selector";
import { EditorActionBar, FormError, useAutoSlug, useUnsavedChangesWarning } from "@/components/admin/editor-parts";
import { initialEditorState } from "@/components/admin/editor-state";
import { CoverUploader } from "@/components/admin/cover-uploader";
import { StatusBadge } from "@/components/admin/status-badge";
import { linkButton, textInput } from "@/components/admin/ui";
import { saveArticle } from "./actions";
import { BodyEditor } from "./body-editor";

export interface ArticleEditorValues {
  id: string | null;
  title: string;
  slug: string;
  shortDescription: string;
  coverImagePath: string | null;
  body: ArticleDoc;
  publicationDate: string;
  status: ContentStatus;
  tagIds: string[];
  linkedAnalysis: LinkedAnalysis | null;
}

export function ArticleEditor({ values, allTags }: { values: ArticleEditorValues; allTags: TagOption[] }) {
  const mode = values.id ? "edit" : "create";
  const [state, formAction, pending] = useActionState(saveArticle, initialEditorState);
  const errors = state.status === "error" ? state.fieldErrors : {};

  const [title, setTitle] = useState(values.title);
  const [description, setDescription] = useState(values.shortDescription);
  const slug = useAutoSlug(values.slug, mode === "create", slugify);
  const [dirty, setDirty] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [bodyBusy, setBodyBusy] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);
  useUnsavedChangesWarning(dirty && !pending);

  return (
    <form action={formAction} noValidate onChange={markDirty} className="mt-2">
      <input type="hidden" name="mode" value={mode} />
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormError state={state} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-6">
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
                  <span className="hidden pl-3 text-sm text-muted sm:inline">/articles/</span>
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

            <FormField
              id="shortDescription"
              label="Short description"
              error={errors.shortDescription}
              hint={`Optional. One or two sentences for listings and search results. ${description.length}/300`}
            >
              <textarea
                {...fieldA11y("shortDescription", errors.shortDescription)}
                name="shortDescription"
                rows={2}
                maxLength={300}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={textInput}
              />
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
            </div>

            <FormField id="tags" label="Tags" error={errors.tags}>
              <TagSelector allTags={allTags} initialSelectedIds={values.tagIds} onChange={markDirty} inputId="tags" />
            </FormField>
          </section>

          <section aria-labelledby="cover-heading" className="border border-light-grey bg-white p-5">
            <div className="flex items-baseline justify-between">
              <h2 id="cover-heading" className="text-sm font-semibold">
                Cover image
              </h2>
              <span className="text-xs text-muted">Optional · landscape</span>
            </div>
            <div className="mt-3">
              {values.id ? (
                <CoverUploader
                  newPath={(type) => newArticleCoverPath(values.id!, type)}
                  frame="landscape"
                  hint="Landscape (about 16:9). JPEG, PNG or WebP, up to 5 MB."
                  initialPath={values.coverImagePath}
                  error={errors.cover}
                  onChange={markDirty}
                  onBusyChange={setCoverBusy}
                />
              ) : (
                <p className="text-sm text-muted">Save the draft first, then add the cover.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-3 text-sm">
          <div className="border border-light-grey bg-white p-4">
            <h2 className="font-semibold">Publishing</h2>
            <p className="mt-1 text-muted">
              {values.status === "published"
                ? "Live. Saving with Update changes the public version immediately."
                : "Draft. Not visible to the public until published."}
            </p>
            <p className="mt-2 text-muted">To publish: title, slug, date and body text.</p>
          </div>
          {values.id ? <LinkedAnalysisPanel linked={values.linkedAnalysis} articleStatus={values.status} /> : null}
        </aside>
      </div>

      <section aria-labelledby="body-label" className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="body-label" className="text-sm font-semibold">
            Body
          </h2>
          <span className="text-xs text-muted">Required to publish</span>
        </div>
        <BodyEditor
          articleId={values.id}
          initialBody={values.body}
          error={errors.body}
          onChange={markDirty}
          onBusyChange={setBodyBusy}
        />
        <p id="body-message" className={errors.body ? "mt-1.5 text-sm text-red-700" : "mt-1.5 text-xs text-muted"}>
          {errors.body ??
            "Paste from a document or type. Use H2/H3 for sections; link sources to cite them. Formatting outside the toolbar is removed."}
        </p>
      </section>

      <EditorActionBar
        mode={mode}
        status={values.status}
        pending={pending}
        blocked={coverBusy || bodyBusy}
        blockedReason="Waiting for uploads to finish…"
        previewHref={values.id ? `/admin/articles/${values.id}/preview` : undefined}
        dirty={dirty}
      />
    </form>
  );
}

/**
 * Read-only: the link is owned and edited on the Analysis ("Linked
 * Article"), so it can never be set in two places.
 */
function LinkedAnalysisPanel({ linked, articleStatus }: { linked: LinkedAnalysis | null; articleStatus: ContentStatus }) {
  return (
    <div className="border border-light-grey bg-white p-4">
      <h2 className="font-semibold">Linked Analysis</h2>
      {linked ? (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <Link href={`/admin/analysis/${linked.id}/edit`} className="font-medium underline-offset-4 hover:underline">
              {linked.title}
            </Link>
            <StatusBadge status={linked.status} />
          </p>
          <p className="mt-2 text-muted">
            {!linked.readArticleEnabled
              ? "“Read Article” is turned off on that Analysis, so no links are shown."
              : linked.status === "published" && articleStatus === "published"
                ? "Both are published, so the “Read Article” and “See Visual Story” links are enabled."
                : "Links appear once both the Analysis and this Article are published."}
          </p>
        </>
      ) : (
        <p className="mt-1 text-muted">None. Link this Article from an Analysis’s “Linked Article” section.</p>
      )}
    </div>
  );
}
