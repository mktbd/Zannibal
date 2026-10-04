"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { normalizeTagName, TAG_NAME_MAX_LENGTH } from "@/lib/tags";
import { createTagInline } from "@/app/admin/(dashboard)/tags/actions";
import { textInput } from "./ui";

export interface TagOption {
  id: string;
  name: string;
}

type Option = { kind: "tag"; tag: TagOption } | { kind: "create"; name: string };

const MAX_SUGGESTIONS = 8;

/**
 * Multi-select over the single shared tag reservoir, used by both the
 * Analysis and Case Study editors. Typeahead matches on the same
 * normalised form the database uses (tags.normalized_name), so "fintech"
 * finds "Fintech" and is never offered as a new tag. Creating a tag goes
 * through the same Server Action path as /admin/tags.
 *
 * Submits the selection as repeated hidden `tagIds` fields.
 */
export function TagSelector({
  allTags: initialTags,
  initialSelectedIds,
  onChange,
  inputId,
}: {
  allTags: TagOption[];
  initialSelectedIds: string[];
  onChange?: () => void;
  inputId: string;
}) {
  const listboxId = useId();
  const feedbackId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [allTags, setAllTags] = useState(initialTags);
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState<{ kind: "error" | "status"; text: string } | null>(null);
  const [creating, startCreate] = useTransition();

  const byId = useMemo(() => new Map(allTags.map((tag) => [tag.id, tag])), [allTags]);
  const selected = selectedIds.map((id) => byId.get(id)).filter((tag): tag is TagOption => !!tag);

  const options: Option[] = useMemo(() => {
    const needle = normalizeTagName(query);
    const selectedSet = new Set(selectedIds);
    const matches = allTags
      .filter((tag) => !selectedSet.has(tag.id))
      .filter((tag) => needle === "" || normalizeTagName(tag.name).includes(needle))
      .sort((a, b) => {
        // Prefix matches first, then alphabetical.
        const aPrefix = normalizeTagName(a.name).startsWith(needle) ? 0 : 1;
        const bPrefix = normalizeTagName(b.name).startsWith(needle) ? 0 : 1;
        return aPrefix - bPrefix || normalizeTagName(a.name).localeCompare(normalizeTagName(b.name));
      })
      .slice(0, MAX_SUGGESTIONS)
      .map((tag): Option => ({ kind: "tag", tag }));

    const exact = allTags.some((tag) => normalizeTagName(tag.name) === needle);
    if (needle !== "" && !exact && needle.length <= TAG_NAME_MAX_LENGTH) {
      matches.push({ kind: "create", name: query.trim().replace(/\s+/g, " ") });
    }
    return matches;
  }, [allTags, query, selectedIds]);

  const showList = open && options.length > 0;
  const active = Math.min(activeIndex, Math.max(options.length - 1, 0));

  const select = (tag: TagOption) => {
    setSelectedIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]));
    setQuery("");
    setActiveIndex(0);
    setMessage({ kind: "status", text: `Added ${tag.name}.` });
    onChange?.();
  };

  const remove = (tag: TagOption) => {
    setSelectedIds((ids) => ids.filter((id) => id !== tag.id));
    setMessage({ kind: "status", text: `Removed ${tag.name}.` });
    onChange?.();
    inputRef.current?.focus();
  };

  const create = (name: string) => {
    startCreate(async () => {
      const result = await createTagInline(name);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setAllTags((tags) => [...tags, result.tag]);
      setSelectedIds((ids) => [...ids, result.tag.id]);
      setQuery("");
      setActiveIndex(0);
      setMessage({ kind: "status", text: `Created and added ${result.tag.name}.` });
      onChange?.();
      inputRef.current?.focus();
    });
  };

  const choose = (option: Option) => {
    if (option.kind === "tag") select(option.tag);
    else create(option.name);
  };

  return (
    <div>
      {selected.length > 0 ? (
        <ul aria-label="Selected tags" className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <li
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-sm border border-black bg-white py-0.5 pl-2 pr-1 text-sm"
            >
              {tag.name}
              <input type="hidden" name="tagIds" value={tag.id} />
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove tag ${tag.name}`}
                className="rounded-sm px-1 leading-none text-muted hover:text-black"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-muted">No tags selected.</p>
      )}

      <div className="relative max-w-md">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listboxId}-${active}` : undefined}
          aria-describedby={feedbackId}
          autoComplete="off"
          placeholder="Search or create a tag"
          maxLength={TAG_NAME_MAX_LENGTH}
          value={query}
          // readOnly, not disabled: a disabled input loses focus, which
          // would strand keyboard users after creating a tag.
          readOnly={creating}
          aria-busy={creating}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
            setMessage(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, options.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter") {
              // Never submit the surrounding editor form from here.
              event.preventDefault();
              if (!creating && showList && options[active]) choose(options[active]);
            } else if (event.key === "Escape") {
              if (showList) {
                event.preventDefault();
                setOpen(false);
              }
            } else if (event.key === "Backspace" && query === "" && selected.length > 0) {
              remove(selected[selected.length - 1]);
            }
          }}
          className={textInput}
        />
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Tag suggestions"
          hidden={!showList}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-sm border border-black bg-white py-1 text-sm shadow-[0_4px_0_0_rgba(0,0,0,0.06)]"
        >
          {options.map((option, index) => (
            <li
              key={option.kind === "tag" ? option.tag.id : "create"}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: keeps focus in the input (no blur first).
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-3 py-1.5 ${index === active ? "bg-off-white" : ""}`}
            >
              {option.kind === "tag" ? (
                option.tag.name
              ) : (
                <span>
                  Create tag <strong className="font-semibold">“{option.name}”</strong>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p
        id={feedbackId}
        aria-live="polite"
        className={`mt-1.5 min-h-5 text-sm ${message?.kind === "error" ? "text-red-700" : "text-muted"}`}
      >
        {creating ? "Creating tag…" : (message?.text ?? "")}
      </p>
    </div>
  );
}
