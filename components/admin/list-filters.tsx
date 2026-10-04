import Link from "next/link";
import { buttonSecondary, textInput } from "./ui";

export type StatusFilter = "all" | "published" | "draft";

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return value === "published" || value === "draft" ? value : "all";
}

const CONTENT_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

/**
 * Search + status filter for admin lists. A plain GET form, so it works
 * without JavaScript and the filtered view has a shareable URL. Defaults
 * to the content (Analysis / Case Studies) title search and statuses.
 */
export function ListFilters({
  basePath,
  query,
  status,
  label,
  searchLabel = "Search by title",
  statusOptions = CONTENT_STATUS_OPTIONS,
}: {
  basePath: string;
  query: string;
  status: string;
  label: string;
  searchLabel?: string;
  statusOptions?: { value: string; label: string }[];
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
          {searchLabel}
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
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
