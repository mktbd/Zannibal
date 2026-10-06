"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ArchiveTag } from "@/lib/analysis-archive";

const ALL = "All topics";

/**
 * Topic filter as a quiet editorial dropdown: the "TOPICS" label and a
 * text trigger naming the current selection ("All topics ↓"). It opens a
 * listbox -- "All topics" first, then every published topic A-Z -- laid out
 * in one column on phones and in up to three columns on wider screens once
 * the list is long; the panel scrolls if it would be too tall.
 *
 * Follows the WAI-ARIA select-only combobox pattern: the trigger announces
 * the listbox and its state; when open, focus sits on the listbox and
 * aria-activedescendant tracks the highlighted option. ↑/↓, Home/End and
 * type-ahead move; Enter/Space selects; Escape closes (focus back on the
 * trigger); Tab or a click outside closes. Selecting closes immediately --
 * there is no Apply step.
 */
export function TopicMenu({
  tags,
  value,
  onChange,
}: {
  tags: ArchiveTag[];
  value: string | null;
  onChange: (tagId: string | null) => void;
}) {
  const options = [{ id: null as string | null, name: ALL }, ...tags];
  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === value));
  const [open, setOpen] = useState(false);
  const [active, setActiveState] = useState(selectedIndex);
  // Keys can arrive faster than React re-renders (type-ahead then Enter):
  // the handlers read the highlighted option from this ref, never a stale render.
  const activeRef = useRef(selectedIndex);
  const setActive = (index: number) => {
    activeRef.current = index;
    setActiveState(index);
  };
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** More options below the panel's fold: shows a soft fade so the list reads as scrollable. */
  const [moreBelow, setMoreBelow] = useState(false);
  const measureFold = () => {
    const panel = panelRef.current;
    setMoreBelow(!!panel && panel.scrollHeight - panel.scrollTop - panel.clientHeight > 4);
  };
  const typeahead = useRef({ text: "", at: 0 });
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const current = options[selectedIndex];
  const columns = tags.length > 16 ? "sm:columns-2 lg:columns-3" : tags.length > 8 ? "sm:columns-2" : "";

  function show() {
    typeahead.current = { text: "", at: 0 };
    setActive(selectedIndex);
    setOpen(true);
  }

  function hide(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(index: number) {
    const option = options[index];
    hide(true);
    if (option && option.id !== value) onChange(option.id);
  }

  // When opened, move focus into the list, and if the panel runs past the
  // bottom of the viewport (a phone, mid-page), scroll just enough to show it.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    measureFold();
    const panel = panelRef.current?.getBoundingClientRect();
    if (panel && panel.bottom > window.innerHeight - 12) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: panel.bottom - window.innerHeight + 16, behavior: reduce ? "auto" : "smooth" });
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId is stable for this component instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  // A press anywhere outside closes it (focus stays where the user put it).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive(Math.min(last, activeRef.current + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive(Math.max(0, activeRef.current - 1));
        return;
      case "Home":
      case "PageUp":
        event.preventDefault();
        setActive(0);
        return;
      case "End":
      case "PageDown":
        event.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(activeRef.current);
        return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        hide(true);
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    // Type-ahead: jump to the next topic starting with the typed letters.
    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const now = event.timeStamp;
      const state = typeahead.current;
      state.text = now - state.at < 600 ? state.text + event.key.toLowerCase() : event.key.toLowerCase();
      state.at = now;
      const find = (text: string, from: number) => {
        for (let step = 0; step < options.length; step++) {
          const index = (from + step) % options.length;
          if (options[index].name.toLowerCase().startsWith(text)) return index;
        }
        return -1;
      };
      let match = find(state.text, state.text.length === 1 ? activeRef.current + 1 : activeRef.current);
      // Nothing starts with the whole buffer: start over from this letter.
      if (match === -1 && state.text.length > 1) {
        state.text = event.key.toLowerCase();
        match = find(state.text, activeRef.current + 1);
      }
      if (match !== -1) setActive(match);
    }
  }

  return (
    // Close to the search field above it: the two are one filtering system.
    <div ref={wrapperRef} className="relative mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:mt-3">
      {/* On phones the label sits above the trigger; from sm it leads the line. */}
      <span id={labelId} className="w-full text-xs font-medium tracking-[0.14em] text-muted uppercase sm:w-auto">
        Topics
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => (open ? hide(false) : show())}
        onKeyDown={onTriggerKeyDown}
        className="group -ml-0.5 inline-flex min-h-11 max-w-full items-center gap-2 px-0.5 text-left text-base font-medium text-black"
      >
        {/* Plain text, not a link: only the chevron answers hover; keyboard
            focus gets the site's standard focus ring. */}
        <span id={valueId} className="truncate">
          {current.name}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`size-4 shrink-0 text-black/55 transition-[color,transform] group-hover:text-black motion-reduce:transition-none ${
            open ? "rotate-180" : "group-hover:translate-y-px"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        // The panel scrolls; the list inside it may flow into columns (a
        // height-limited multi-column box would spill sideways instead).
        <div
          ref={panelRef}
          onScroll={measureFold}
          className={`absolute top-full left-0 z-30 mt-1 max-h-[min(26rem,calc(100dvh-12rem))] lg:max-h-[min(30rem,calc(100dvh-12rem))] w-full overflow-y-auto overscroll-contain border border-black/15 bg-white p-2 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] sm:w-auto sm:min-w-64 ${
            tags.length > 16 ? "sm:w-[34rem] lg:w-[46rem]" : tags.length > 8 ? "sm:w-[34rem]" : "sm:max-w-sm"
          }`}
        >
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={optionId(active)}
            onKeyDown={onListKeyDown}
            className={`gap-x-4 outline-none! ${columns}`}
          >
            {options.map((option, index) => {
              const selected = index === selectedIndex;
              const highlighted = index === active;
              return (
                <li
                  key={option.id ?? "all"}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(index)}
                  onPointerMove={() => setActive(index)}
                  className={`flex min-h-11 cursor-pointer break-inside-avoid lg:min-h-10 items-center gap-2 px-2 py-1.5 text-[0.9375rem] leading-snug text-black ${
                    index === 0 ? "mb-1 border-b border-black/10 [column-span:all]" : ""
                  } ${selected ? "font-semibold" : "font-normal"} ${highlighted ? "underline decoration-1 underline-offset-4" : ""}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className={`size-4 shrink-0 ${selected ? "visible" : "invisible"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  <span className="min-w-0 break-words">{option.name}</span>
                </li>
              );
            })}
          </ul>
          {moreBelow ? (
            <div aria-hidden="true" className="pointer-events-none sticky -bottom-2 -mx-2 -mb-2 h-10 bg-gradient-to-t from-white to-transparent" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
