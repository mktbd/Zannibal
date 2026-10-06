"use client";

import { useId } from "react";
import type { ArchiveTag } from "@/lib/archive-core";
import { TopicMenu } from "./topic-menu";

/**
 * The editorial discovery block shared by the public archives: a labelled
 * search line (hairline rule, regular weight, held to a readable width;
 * focus darkens and thickens the rule without a box or layout shift) and,
 * close beneath it, the Topics dropdown. No submit button -- the archive
 * searches as the text settles.
 */
export function DiscoveryControls({
  searchLabel,
  placeholder,
  query,
  onQueryChange,
  tags,
  tagId,
  onTagChange,
}: {
  searchLabel: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  tags: ArchiveTag[];
  tagId: string | null;
  onTagChange: (tagId: string | null) => void;
}) {
  const searchId = useId();
  return (
    <div role="search" className="border-b border-black/15 pb-6">
      <label htmlFor={searchId} className="text-xs font-medium tracking-[0.14em] text-muted uppercase">
        {searchLabel}
      </label>
      <div className="relative mt-2 max-w-xl">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute top-1/2 left-0 size-5 -translate-y-1/2 text-black/45"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="M15 15l5 5" />
        </svg>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full appearance-none rounded-none border-0 border-b border-black/30 bg-transparent py-2.5 pr-11 pl-8 text-lg text-black transition-[border-color,box-shadow] placeholder:text-muted hover:border-black/60 focus-visible:border-black focus-visible:shadow-[0_1px_0_0_var(--color-black)] focus-visible:outline-none! sm:text-xl [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 items-center justify-center text-black/60 hover:text-black"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </div>

      {tags.length > 0 ? <TopicMenu tags={tags} value={tagId} onChange={onTagChange} /> : null}
    </div>
  );
}
