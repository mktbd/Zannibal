import type { ContentStatus } from "@/lib/types/content";

/**
 * Draft / Published marker. Published carries the one yellow accent so
 * live content is recognisable at a glance; Draft stays neutral.
 */
export function StatusBadge({ status }: { status: ContentStatus }) {
  return status === "published" ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-black px-1.5 py-0.5 text-xs font-medium">
      <span aria-hidden="true" className="inline-block size-2 bg-accent-yellow ring-1 ring-black" />
      Published
    </span>
  ) : (
    <span className="inline-flex items-center whitespace-nowrap rounded-sm border border-light-grey px-1.5 py-0.5 text-xs font-medium text-muted">
      Draft
    </span>
  );
}
