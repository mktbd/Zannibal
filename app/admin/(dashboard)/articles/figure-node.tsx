"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useId } from "react";
import { FIGURE_ALT_MAX, FIGURE_CAPTION_MAX } from "@/lib/article-body";
import { mediaPublicUrl } from "@/lib/media";
import { linkButton, textInput } from "@/components/admin/ui";

/**
 * Inline Article image: an uploaded editorial-media object (stored by its
 * path, never by URL) with alt text and an optional caption. Mirrors the
 * `figure` node of lib/article-body.ts exactly; the server rejects any
 * path that isn't one of this Article's uploads.
 *
 * Only figures this editor rendered itself (data-article-figure) are parsed
 * back from HTML, so pasting an <img> from elsewhere never creates one.
 */
export const ArticleFigure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      path: { default: "", parseHTML: (el) => el.getAttribute("data-path") ?? "", renderHTML: () => ({}) },
      alt: { default: "", parseHTML: (el) => el.getAttribute("data-alt") ?? "", renderHTML: () => ({}) },
      caption: { default: "", parseHTML: (el) => el.getAttribute("data-caption") ?? "", renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-article-figure]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-article-figure": "",
        "data-path": node.attrs.path,
        "data-alt": node.attrs.alt,
        "data-caption": node.attrs.caption,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});

function FigureView({ node, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const id = useId();
  const path = String(node.attrs.path ?? "");
  const alt = String(node.attrs.alt ?? "");
  const caption = String(node.attrs.caption ?? "");

  return (
    <NodeViewWrapper
      as="figure"
      className={`my-6 border bg-white p-3 ${selected ? "border-black" : "border-light-grey"}`}
      data-article-figure=""
    >
      <div data-drag-handle className="cursor-grab bg-off-white" contentEditable={false}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded image */}
        <img src={mediaPublicUrl(path)} alt={alt} className="mx-auto block max-h-96 w-auto max-w-full" />
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2" contentEditable={false}>
        <label className="flex flex-col gap-1" htmlFor={`${id}-alt`}>
          <span className="font-medium">Image description (alt text)</span>
          <input
            id={`${id}-alt`}
            type="text"
            value={alt}
            maxLength={FIGURE_ALT_MAX}
            placeholder="What the image shows, for screen readers"
            onChange={(event) => updateAttributes({ alt: event.target.value })}
            className={textInput}
          />
        </label>
        <label className="flex flex-col gap-1" htmlFor={`${id}-caption`}>
          <span className="font-medium">Caption</span>
          <input
            id={`${id}-caption`}
            type="text"
            value={caption}
            maxLength={FIGURE_CAPTION_MAX}
            placeholder="Optional, e.g. Source: Bangladesh Bank"
            onChange={(event) => updateAttributes({ caption: event.target.value })}
            className={textInput}
          />
        </label>
      </div>
      <div className="mt-2 text-right" contentEditable={false}>
        <button type="button" onClick={() => deleteNode()} className={`${linkButton} text-red-700`}>
          Remove image
        </button>
      </div>
    </NodeViewWrapper>
  );
}
