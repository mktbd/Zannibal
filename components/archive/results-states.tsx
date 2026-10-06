import type { Ref } from "react";

const textButton = "mt-4 inline-flex min-h-11 items-center font-medium underline decoration-1 underline-offset-[0.2em] hover:decoration-2";

/** A search/topic request failed: plain message + retry. */
export function ResultsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-12">
      <p className="max-w-[44ch] text-lede text-black">Results couldn’t be loaded right now.</p>
      <button type="button" onClick={onRetry} className={textButton}>
        Try again
      </button>
    </div>
  );
}

/** Nothing matches: names the search and topic, offers a reset. */
export function NoResults({ noun, query, topic, onClear }: { noun: string; query: string; topic: string | null; onClear: () => void }) {
  return (
    <div className="py-12">
      <p className="max-w-[44ch] text-lede text-black">
        No {noun} match
        {query.trim() ? <> “{query.trim()}”</> : null}
        {topic ? <> in {topic}</> : null}.
      </p>
      <button type="button" onClick={onClear} className={textButton}>
        Clear search and filter
      </button>
    </div>
  );
}

/**
 * "Showing 18 of 43 …" and the Load More control: an explicit request for
 * the next batch -- never triggered by scrolling, so the footer stays
 * reachable. While loading it reads "Loading…" and ignores clicks.
 */
export function LoadMore({
  shown,
  total,
  singular,
  plural,
  label,
  loading,
  failed,
  failedMessage,
  onLoadMore,
  buttonRef,
}: {
  shown: number;
  total: number;
  singular: string;
  plural: string;
  label: string;
  loading: boolean;
  failed: boolean;
  failedMessage: string;
  onLoadMore: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="mt-12 flex flex-col items-center gap-2 text-center sm:mt-14">
      <p aria-live="polite" className="text-sm text-muted">
        Showing {shown} of {total} {total === 1 ? singular : plural}
      </p>
      <button
        ref={buttonRef}
        type="button"
        onClick={onLoadMore}
        aria-disabled={loading}
        className="group inline-flex min-h-11 items-center gap-2 font-medium aria-disabled:cursor-progress aria-disabled:text-muted"
      >
        <span className={loading ? "" : "underline decoration-1 underline-offset-[0.25em] group-hover:decoration-2"}>
          {loading ? "Loading…" : label}
        </span>
        {loading ? null : (
          <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-y-0.5">
            ↓
          </span>
        )}
      </button>
      {failed ? (
        <p role="alert" className="text-sm text-black">
          {failedMessage}
        </p>
      ) : null}
    </div>
  );
}
