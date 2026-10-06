"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendUnique, normalizeSearchText, type FeedPage } from "@/lib/archive-core";

/** Pause after the last keystroke before searching the archive. */
const SEARCH_DELAY_MS = 250;
const NO_FILTER = "|";
const filterKey = (query: string, tagId: string | null) => `${normalizeSearchText(query)}|${tagId ?? ""}`;

export type FeedResults<T> = { key: string; items: T[]; total: number; status: "ready" | "loading" | "error" };

/**
 * Search + topic + Load More state for a public archive whose feed endpoint
 * (e.g. /api/analysis) filters the whole published archive on the server.
 *
 * The page arrives with its first batch (`initialPage`). A new search or
 * topic replaces the results with the first matching batch; Load More
 * appends the next batch of the current results. Every request carries a
 * generation number and an abort signal, so a response that no longer
 * matches the search/topic on screen is dropped, and batches are
 * de-duplicated by id -- fast typing, switching topics mid-load or repeated
 * Load More clicks can't produce stale, duplicated or reordered items.
 *
 * `itemLinkSelector` finds the items' links in document order, so that when
 * a final batch removes the focused Load More control, focus moves to the
 * first newly added item instead of being lost.
 */
export function useArchiveFeed<T extends { id: string }>({
  endpoint,
  initialPage,
  itemLinkSelector,
}: {
  endpoint: string;
  initialPage: FeedPage<T>;
  itemLinkSelector: string;
}) {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagId, setTagId] = useState<string | null>(null);
  const [results, setResults] = useState<FeedResults<T>>(() => ({
    key: NO_FILTER,
    items: initialPage.items,
    total: initialPage.total,
    status: "ready",
  }));
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const generation = useRef(0);
  const requests = useRef<{ list?: AbortController; more?: AbortController }>({});
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  /** Item index to focus once a final batch has rendered (Load More is gone). */
  const focusItemAt = useRef<number | null>(null);

  const filtering = searchQuery.trim() !== "" || tagId !== null;
  const hasMore = results.status === "ready" && results.items.length < results.total;

  const fetchPage = useCallback(
    async (nextQuery: string, nextTag: string | null, offset: number, signal: AbortSignal): Promise<FeedPage<T>> => {
      const params = new URLSearchParams({ offset: String(offset) });
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      if (nextTag) params.set("topic", nextTag);
      const response = await fetch(`${endpoint}?${params}`, { signal });
      if (!response.ok) throw new Error(`archive feed ${response.status}`);
      return response.json();
    },
    [endpoint],
  );

  // Debounce typing; the search runs on the settled text.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(query), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // A new search or topic replaces the results with the first matching batch.
  const runSearch = useCallback(
    (nextQuery: string, nextTag: string | null) => {
      const key = filterKey(nextQuery, nextTag);
      requests.current.list?.abort();
      requests.current.more?.abort();
      const gen = ++generation.current;
      setLoadingMore(false);
      setMoreFailed(false);
      if (key === NO_FILTER) {
        setResults({ key, items: initialPage.items, total: initialPage.total, status: "ready" });
        return;
      }
      const controller = new AbortController();
      requests.current.list = controller;
      setResults((previous) => ({ ...previous, key, status: "loading" }));
      fetchPage(nextQuery, nextTag, 0, controller.signal).then(
        (page) => {
          if (gen === generation.current) setResults({ key, items: page.items, total: page.total, status: "ready" });
        },
        () => {
          if (gen === generation.current && !controller.signal.aborted) setResults((previous) => ({ ...previous, key, status: "error" }));
        },
      );
    },
    [initialPage, fetchPage],
  );

  const lastKey = useRef(NO_FILTER);
  useEffect(() => {
    const key = filterKey(searchQuery, tagId);
    if (key === lastKey.current) return;
    lastKey.current = key;
    runSearch(searchQuery, tagId);
  }, [searchQuery, tagId, runSearch]);

  useEffect(() => () => {
    requests.current.list?.abort();
    requests.current.more?.abort();
  }, []);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    const gen = generation.current;
    const { key, items } = results;
    const controller = new AbortController();
    requests.current.more = controller;
    setLoadingMore(true);
    setMoreFailed(false);
    fetchPage(searchQuery, tagId, items.length, controller.signal).then(
      (page) => {
        if (gen !== generation.current) return;
        setResults((previous) =>
          previous.key === key ? { ...previous, items: appendUnique(previous.items, page.items), total: page.total } : previous,
        );
        setLoadingMore(false);
        // Keep keyboard focus on Load More; if it disappears (all loaded),
        // move focus to the first item of the new batch.
        if (document.activeElement === loadMoreRef.current && items.length + page.items.length >= page.total)
          focusItemAt.current = items.length;
      },
      () => {
        if (gen !== generation.current || controller.signal.aborted) return;
        setLoadingMore(false);
        setMoreFailed(true);
      },
    );
  }

  useEffect(() => {
    if (focusItemAt.current === null) return;
    document.querySelectorAll<HTMLElement>(itemLinkSelector)[focusItemAt.current]?.focus();
    focusItemAt.current = null;
  }, [results.items, itemLinkSelector]);

  function clearFilters() {
    setQuery("");
    setSearchQuery("");
    setTagId(null);
  }

  return {
    query,
    setQuery,
    searchQuery,
    tagId,
    setTagId,
    results,
    filtering,
    hasMore,
    loadingMore,
    moreFailed,
    loadMore,
    loadMoreRef,
    retry: () => runSearch(searchQuery, tagId),
    clearFilters,
  };
}
