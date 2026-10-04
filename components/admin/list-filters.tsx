import Link from "next/link";
import { buttonSecondary, textInput } from "./ui";

export type StatusFilter = "all" | "published" | "draft";

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return value === "published" || value === "draft" ? value : "all";
}

/**
 * Title search + status filter for content lists. A plain GET form, so it
 * works without JavaScript and the filtered view has a shareable URL.
 */
export function ListFilters({
  basePath,
  query,
  status,
  label,
}: {
  basePath: string;
  query: string;
  status: StatusFilter;
  label: string;
}) {
  const filtered = query !== "" || status !== "all";
  return (
    <form
      method="get"
      action={basePath}
      role="search"
      aria-label={`Filter ${label}`}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1 sm:max-w-sm">
        <label htmlFor="list-q" className="text-xs font-medium text-muted">
          Search by title
        </label>
        <input id="list-q" name="q" type="search" defaultValue={query} className={textInput} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="list-status" className="text-xs font-medium text-muted">
          Status
        </label>
        <select
          id="list-status"
          name="status"
          defaultValue={status}
          className="rounded-sm border border-light-grey bg-white px-2 py-1.5 text-sm hover:border-muted"
        >
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonSecondary}>
          Apply
        </button>
        {filtered ? (
          <Link href={basePath} className={`${buttonSecondary} border-transparent`}>
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
