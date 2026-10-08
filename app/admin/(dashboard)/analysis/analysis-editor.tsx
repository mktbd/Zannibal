"use client";

import { useActionState, useCallback, useState } from "react";
import { slugify } from "@/lib/slug";
import type { ContentStatus } from "@/lib/types/content";
import { FormField, fieldA11y } from "@/components/admin/form-field";
import { TagSelector, type TagOption } from "@/components/admin/tag-selector";
import { EditorActionBar, FormError, useAutoSlug, useUnsavedChangesWarning } from "@/components/admin/editor-parts";
import { initialEditorState } from "@/components/admin/editor-state";
import { linkButton, textInput } from "@/components/admin/ui";
import type { ArticleOption } from "@/lib/data/admin/content";
import { isArticleLinkVisible } from "@/lib/article-links";
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
  linkedArticleId: string | null;
  readArticleEnabled: boolean;
}

export function AnalysisEditor({
  values,
  allTags,
  articleOptions,
}: {
  values: AnalysisEditorValues;
  allTags: TagOption[];
  articleOptions: ArticleOption[];
}) {
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

      <LinkedArticleSection
        analysisId={values.id}
        analysisStatus={values.status}
        initialArticleId={values.linkedArticleId}
        initialEnabled={values.readArticleEnabled}
        options={articleOptions}
        error={errors.linkedArticle}
      />

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

/**
 * "Read Article": links this Analysis to its written Article (one-to-one;
 * the link is stored only here, on the Analysis). Turning the toggle off
 * keeps the chosen Article -- it is submitted from a hidden field -- but
 * hides the public links. The public "Read Article" / "See Visual Story"
 * links appear only when the toggle is on and both records are published.
 */
function LinkedArticleSection({
  analysisId,
  analysisStatus,
  initialArticleId,
  initialEnabled,
  options,
  error,
}: {
  analysisId: string | null;
  analysisStatus: ContentStatus;
  initialArticleId: string | null;
  initialEnabled: boolean;
  options: ArticleOption[];
  error?: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [articleId, setArticleId] = useState(initialArticleId ?? "");
  const selected = options.find((option) => option.id === articleId) ?? null;
  const visible = isArticleLinkVisible({
    readArticleEnabled: enabled,
    linkedArticleId: selected?.id ?? null,
    analysisStatus,
    articleStatus: selected?.status ?? null,
  });

  let note: string;
  if (!enabled) note = selected ? `Off. “${selected.title}” stays linked but no public link is shown.` : "Off. No public link is shown.";
  else if (!selected) note = "Choose the Article to link.";
  else if (visible) note = "Both are published: the public Read Article link is shown.";
  else note = "The public link appears once both this Analysis and the Article are published.";

  return (
    <section aria-labelledby="linked-article-heading" className="mt-6 border border-light-grey bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h2 id="linked-article-heading" className="text-sm font-semibold">
          Linked Article
        </h2>
        <span className="text-xs text-muted">Optional</span>
      </div>
      <div className="mt-3 flex flex-col gap-4 text-sm">
        <label className="flex w-fit items-center gap-2 font-medium">
          <input
            type="checkbox"
            name="readArticleEnabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            aria-describedby="linkedArticle-message"
            className="size-4 accent-black"
          />
          Read Article
        </label>

        {enabled ? (
          <FormField id="linkedArticle" label="Article" error={error} hint="Drafts can be selected.">
            <select
              {...fieldA11y("linkedArticle", error)}
              name="linkedArticleId"
              value={articleId}
              onChange={(event) => setArticleId(event.target.value)}
              className={`${textInput} sm:max-w-md`}
            >
              <option value="">Choose an Article…</option>
              {options.map((option) => {
                const takenElsewhere = option.linkedAnalysisId !== null && option.linkedAnalysisId !== analysisId;
                return (
                  <option key={option.id} value={option.id} disabled={takenElsewhere}>
                    {option.title}
                    {option.status === "draft" ? " (draft)" : ""}
                    {takenElsewhere ? ` — linked to “${option.linkedAnalysisTitle}”` : ""}
                  </option>
                );
              })}
            </select>
          </FormField>
        ) : (
          <>
            <input type="hidden" name="linkedArticleId" value={articleId} />
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </>
        )}

        <p id={enabled ? undefined : "linkedArticle-message"} className="text-muted" aria-live="polite">
          {note}
          {options.length === 0 ? " No Articles exist yet." : ""}
        </p>
      </div>
    </section>
  );
}
