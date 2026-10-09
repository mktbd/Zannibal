"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Selection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useEffect, useRef, useState } from "react";
import { normalizeLinkInput, safeLinkHref, type ArticleDoc } from "@/lib/article-body";
import { isMediaType, MEDIA_ACCEPT, newArticleImagePath, validateImageFile } from "@/lib/media";
import { uploadMedia } from "@/components/admin/upload";
import { buttonSecondary, linkButton, textInput } from "@/components/admin/ui";
import { ArticleFigure } from "./figure-node";

/**
 * Rich-text body for an Article (Tiptap, i.e. ProseMirror). The editor
 * schema is the same allow-list the server enforces in lib/article-body.ts:
 * paragraphs, H2/H3, bold, italic, bullet and numbered lists, quotes,
 * links and uploaded images with captions. Anything pasted is parsed
 * through that schema, so pasted scripts, styles, tables, iframes, H1/H4
 * and foreign images are dropped and only their text is kept.
 *
 * The document is submitted as JSON in the hidden `body` field (controlled,
 * so a failed save never resets it) and rebuilt by the server before it is
 * stored -- nothing here is trusted.
 */
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: {
      openOnClick: false,
      // Off: autolink also makes the mark "inclusive", so text typed after a
      // citation would silently extend the link. Links are added with the
      // toolbar, or by pasting a URL over selected text.
      autolink: false,
      linkOnPaste: true,
      defaultProtocol: "https",
      // Same rule as the server: only http(s) and mailto survive, even in
      // pasted content. (mailto is built into linkify; registering it again
      // as a custom protocol warns on every editor mount.)
      isAllowedUri: (url) => safeLinkHref(url) !== null,
      HTMLAttributes: { target: null, rel: null, class: null },
    },
  }),
  ArticleFigure,
];

const EDITOR_PROPS = {
  handleDOMEvents: {
    // A click on the editor's empty surface (below the last block, in the
    // padding) would otherwise leave a whole-document selection behind in
    // Chromium, and the next keystroke would replace everything. Put the
    // caret at the end instead, like a word processor.
    mousedown: (view: EditorView, event: MouseEvent) => {
      if (event.target !== view.dom) return false;
      event.preventDefault();
      view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
      view.focus();
      return true;
    },
  },
  attributes: {
    id: "body",
    role: "textbox",
    "aria-multiline": "true",
    "aria-labelledby": "body-label",
    "aria-describedby": "body-message",
    class: "min-h-[24rem] px-4 py-4 outline-none sm:px-6",
  },
};

export function BodyEditor({
  articleId,
  initialBody,
  error,
  onChange,
  onBusyChange,
}: {
  /** null before the first save: images need the Article's id for their path. */
  articleId: string | null;
  initialBody: ArticleDoc;
  error?: string;
  onChange: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [json, setJson] = useState(() => JSON.stringify(initialBody));
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Options must keep their identity across renders: useEditor compares
  // them on every render and reconfigures the live editor when they change.
  // An empty document has no place for a caret (ProseMirror falls back to
  // a whole-document selection that the first keystroke replaces), so a
  // new body starts with one empty paragraph.
  const [content] = useState<ArticleDoc>(() =>
    initialBody.content.length > 0 ? initialBody : { type: "doc", content: [{ type: "paragraph" }] },
  );
  const editor = useEditor({
    immediatelyRender: false,
    extensions: EXTENSIONS,
    content,
    editorProps: EDITOR_PROPS,
    onUpdate: ({ editor }) => {
      setJson(JSON.stringify(editor.getJSON()));
      onChangeRef.current();
    },
  });

  return (
    <div>
      <input type="hidden" name="body" value={json} />
      <div
        className={`article-editor border bg-white focus-within:border-black ${error ? "border-red-700" : "border-light-grey"}`}
      >
        {editor ? <Toolbar editor={editor} articleId={articleId} onBusyChange={onBusyChange} /> : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  articleId,
  onBusyChange,
}: {
  editor: Editor;
  articleId: string | null;
  onBusyChange: (busy: boolean) => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive("paragraph"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const [upload, setUpload] = useState<{ progress: number; name: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onBusyChange(upload !== null), [upload, onBusyChange]);
  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  const chain = () => editor.chain().focus();

  const openLink = () => {
    setLinkValue(state.href);
    setLinkError(null);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const href = normalizeLinkInput(linkValue);
    if (!href) {
      setLinkError("Enter a web address (https://…) or an email address.");
      return;
    }
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive("link")) {
      // No text selected: insert the address itself as the link text.
      chain()
        .insertContent({ type: "text", text: linkValue.trim(), marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      // Collapse to the end of the link so typing continues after it.
      chain()
        .extendMarkRange("link")
        .setLink({ href })
        .command(({ tr }) => {
          tr.setSelection(TextSelection.create(tr.doc, tr.selection.to));
          return true;
        })
        .run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    chain().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  const onImage = async (file: File | undefined) => {
    if (!file || !articleId) return;
    const invalid = validateImageFile(file);
    if (invalid || !isMediaType(file.type)) {
      setProblem(`${invalid ?? "Unsupported image."} Not uploaded.`);
      return;
    }
    setProblem(null);
    const path = newArticleImagePath(articleId, file.type);
    setUpload({ progress: 0, name: file.name });
    setAnnouncement("Uploading image.");
    const result = await uploadMedia(path, file, (progress) => setUpload({ progress, name: file.name }));
    setUpload(null);
    if (!result.ok) {
      setProblem(result.message);
      setAnnouncement("Image upload failed.");
      return;
    }
    chain().insertContent({ type: "figure", attrs: { path, alt: "", caption: "" } }).run();
    setAnnouncement("Image added. Add a description and caption, then save.");
  };

  return (
    <div className="sticky top-0 z-[5] border-b border-light-grey bg-white">
      <div role="toolbar" aria-label="Formatting" aria-controls="body" className="flex flex-wrap items-center gap-1 px-2 py-1.5">
        <ToolButton label="Paragraph" active={state.paragraph} onClick={() => chain().setParagraph().run()}>
          ¶
        </ToolButton>
        <ToolButton label="Heading 2" named active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
          H2<span className="sr-only"> heading</span>
        </ToolButton>
        <ToolButton label="Heading 3" named active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
          H3<span className="sr-only"> heading</span>
        </ToolButton>
        <Divider />
        <ToolButton label="Bold (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <span className="font-bold">B</span>
        </ToolButton>
        <ToolButton label="Italic (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolButton>
        <ToolButton label="Link" active={state.link || linkOpen} onClick={openLink}>
          Link
        </ToolButton>
        <Divider />
        <ToolButton label="Bulleted list" named active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
          <span aria-hidden="true">•</span> List<span className="sr-only"> (bulleted)</span>
        </ToolButton>
        <ToolButton label="Numbered list" named active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
          <span aria-hidden="true">1.</span> List<span className="sr-only"> (numbered)</span>
        </ToolButton>
        <ToolButton label="Quote" named active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
          <span aria-hidden="true">“</span> Quote
        </ToolButton>
        <Divider />
        <input
          ref={fileRef}
          type="file"
          accept={MEDIA_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onImage(file);
          }}
        />
        <ToolButton
          label={articleId ? "Insert image" : "Insert image (save the draft first)"}
          disabled={!articleId || upload !== null}
          onClick={() => fileRef.current?.click()}
        >
          Image
        </ToolButton>
        <Divider />
        <ToolButton label="Undo (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
          ↶
        </ToolButton>
        <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
          ↷
        </ToolButton>
      </div>

      {linkOpen ? (
        <div className="flex flex-wrap items-start gap-2 border-t border-light-grey px-2 py-2 text-sm">
          <label htmlFor="body-link" className="sr-only">
            Link address
          </label>
          <div className="min-w-0 flex-1 basis-56">
            <input
              ref={linkInputRef}
              id="body-link"
              type="text"
              inputMode="url"
              value={linkValue}
              placeholder="https://… or name@example.com"
              aria-invalid={linkError ? true : undefined}
              aria-describedby="body-link-message"
              onChange={(event) => setLinkValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setLinkOpen(false);
                  editor.commands.focus();
                }
              }}
              className={textInput}
            />
            <p id="body-link-message" className={linkError ? "mt-1 text-red-700" : "sr-only"}>
              {linkError ?? "Web or email address. Press Enter to apply."}
            </p>
          </div>
          <button type="button" onClick={applyLink} className={buttonSecondary}>
            Apply
          </button>
          {state.link ? (
            <button type="button" onClick={removeLink} className={`${linkButton} py-1.5 text-red-700`}>
              Remove link
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setLinkOpen(false);
              editor.commands.focus();
            }}
            className={`${linkButton} py-1.5`}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {upload || problem || !articleId ? (
        <div className="border-t border-light-grey px-3 py-2 text-sm">
          {!articleId ? <p className="text-muted">Save the draft first, then images can be added to the body.</p> : null}
          {upload ? (
            <div className="w-56">
              <div
                role="progressbar"
                aria-label={`Uploading ${upload.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(upload.progress * 100)}
                className="h-1 bg-light-grey"
              >
                <div className="h-1 bg-black" style={{ width: `${Math.round(upload.progress * 100)}%` }} />
              </div>
            </div>
          ) : null}
          {problem ? (
            <p role="alert" className="text-red-700">
              {problem}
            </p>
          ) : null}
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/**
 * A toolbar button. `label` is the tooltip. Glyph buttons (¶, B, I, ↶, ↷)
 * use it as their accessible name; `named` buttons are named by their
 * visible text (plus screen-reader-only hints), so the spoken name always
 * contains what is on screen (WCAG 2.5.3 Label in Name).
 */
function ToolButton({
  label,
  named = false,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  named?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={named ? undefined : label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // Keep the editor's selection while clicking the toolbar.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`min-h-8 min-w-8 rounded-sm px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-black text-white" : "text-black hover:bg-off-white"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-light-grey" />;
}
