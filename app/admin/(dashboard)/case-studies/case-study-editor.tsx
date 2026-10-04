"use client";

import { useActionState, useCallback, useState } from "react";
import { slugify } from "@/lib/slug";
import type { ContentStatus } from "@/lib/types/content";
import { FormField, fieldA11y } from "@/components/admin/form-field";
import { TagSelector, type TagOption } from "@/components/admin/tag-selector";
import { EditorActionBar, FormError, useAutoSlug, useUnsavedChangesWarning } from "@/components/admin/editor-parts";
import { initialEditorState } from "@/components/admin/editor-state";
import { linkButton, textInput } from "@/components/admin/ui";
import { saveCaseStudy } from "./actions";
import { CoverUploader } from "./cover-uploader";

export interface CaseStudyEditorValues {
  id: string | null;
  title: string;
  slug: string;
  coverImagePath: string | null;
  shortDescription: string;
  productDescription: string;
  /** Blank when unset (stored as 0 -- see saveCaseStudy). */
  priceBdt: string;
  industry: string;
  pageCount: string;
  publicationDate: string;
  status: ContentStatus;
  tagIds: string[];
}

export function CaseStudyEditor({ values, allTags }: { values: CaseStudyEditorValues; allTags: TagOption[] }) {
  const mode = values.id ? "edit" : "create";
  const [state, formAction, pending] = useActionState(saveCaseStudy, initialEditorState);
  const errors = state.status === "error" ? state.fieldErrors : {};

  const [title, setTitle] = useState(values.title);
  const slug = useAutoSlug(values.slug, mode === "create", slugify);
  const [shortDescription, setShortDescription] = useState(values.shortDescription);
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
        <div className="flex flex-col gap-6">
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
                  <span className="hidden pl-3 text-sm text-muted sm:inline">/case-studies/</span>
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
              publishRequired
              error={errors.shortDescription}
              hint={`${shortDescription.length}/300 · Shown in the catalogue.`}
            >
              <textarea
                {...fieldA11y("shortDescription", errors.shortDescription)}
                name="shortDescription"
                rows={2}
                maxLength={300}
                value={shortDescription}
                onChange={(event) => setShortDescription(event.target.value)}
                className={`${textInput} resize-y`}
              />
            </FormField>

            <FormField
              id="productDescription"
              label="Product description"
              publishRequired
              error={errors.productDescription}
              hint="Plain text; blank lines separate paragraphs. Describe the situation and what readers will understand, without giving away paid conclusions."
            >
              <textarea
                {...fieldA11y("productDescription", errors.productDescription)}
                name="productDescription"
                rows={10}
                maxLength={10000}
                defaultValue={values.productDescription}
                className={`${textInput} resize-y leading-relaxed`}
              />
            </FormField>

            <FormField id="tags" label="Tags" error={errors.tags} hint="Shown as Related Topics.">
              <TagSelector allTags={allTags} initialSelectedIds={values.tagIds} onChange={markDirty} inputId="tags" />
            </FormField>
          </section>

          <section aria-labelledby="product-heading" className="border border-light-grey bg-white p-5">
            <h2 id="product-heading" className="text-sm font-semibold">
              Product information
            </h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <FormField id="priceBdt" label="Price (BDT)" publishRequired error={errors.priceBdt}>
                <div className="flex items-center rounded-sm border border-light-grey bg-white focus-within:border-black">
                  <span className="pl-3 text-sm text-muted">BDT</span>
                  <input
                    {...fieldA11y("priceBdt", errors.priceBdt)}
                    name="priceBdt"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="1500"
                    defaultValue={values.priceBdt}
                    className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm tabular-nums outline-none"
                  />
                </div>
              </FormField>
              <FormField id="industry" label="Industry" publishRequired error={errors.industry}>
                <input
                  {...fieldA11y("industry", errors.industry)}
                  name="industry"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Fintech"
                  defaultValue={values.industry}
                  className={textInput}
                />
              </FormField>
              <FormField id="pageCount" label="Page count" publishRequired error={errors.pageCount}>
                <input
                  {...fieldA11y("pageCount", errors.pageCount)}
                  name="pageCount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5000}
                  step={1}
                  defaultValue={values.pageCount}
                  className={textInput}
                />
              </FormField>
              <FormField id="publicationDate" label="Publication date" required error={errors.publicationDate}>
                <input
                  {...fieldA11y("publicationDate", errors.publicationDate)}
                  name="publicationDate"
                  type="date"
                  defaultValue={values.publicationDate}
                  className={textInput}
                />
              </FormField>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Format</span>
                <p className="py-1.5 text-sm">PDF</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="cover-heading" className="border border-light-grey bg-white p-5">
            <div className="flex items-baseline justify-between">
              <h2 id="cover-heading" className="text-sm font-semibold">
                Cover image
              </h2>
              <span className="text-xs text-muted">Required to publish</span>
            </div>
            <div className="mt-3">
              {values.id ? (
                <CoverUploader
                  caseStudyId={values.id}
                  initialPath={values.coverImagePath}
                  error={errors.cover}
                  onChange={markDirty}
                  onBusyChange={setUploading}
                />
              ) : (
                <p className="text-sm text-muted">Save the draft first, then add the cover.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-3 text-sm">
          <div className="border border-light-grey bg-white p-4 lg:sticky lg:top-8">
            <h2 className="font-semibold">Publishing</h2>
            <p className="mt-1 text-muted">
              {values.status === "published"
                ? "Live. Saving with Update changes the public version immediately."
                : "Draft. Not visible to the public until published."}
            </p>
            <p className="mt-2 text-muted">
              To publish: cover, short and product descriptions, a price above 0, industry and page count.
            </p>
            <p className="mt-2 text-muted">
              The paid PDF is not uploaded here; it is delivered manually.
            </p>
          </div>
        </aside>
      </div>

      <EditorActionBar
        mode={mode}
        status={values.status}
        pending={pending}
        blocked={uploading}
        blockedReason="Waiting for the upload to finish…"
        previewHref={values.id ? `/admin/case-studies/${values.id}/preview` : undefined}
        dirty={dirty}
      />
    </form>
  );
}
