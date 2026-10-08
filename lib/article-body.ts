/**
 * Article body: a ProseMirror/Tiptap JSON document (stored in
 * articles.body as jsonb -- never HTML), and the server-side validator
 * every save goes through.
 *
 * The validator rebuilds the document from an allow-list instead of
 * trusting what the browser sent: only the node types, marks and
 * attributes below survive, so no script, event handler, style, iframe or
 * arbitrary HTML can be stored. Anything outside the allow-list (an
 * unknown node or mark, a javascript:/data: link, an image that isn't one
 * of this Article's uploads) rejects the save with a message instead of
 * being silently altered. The public/preview renderer
 * (components/articles/article-body.tsx) turns the same structure into
 * React elements and never interprets HTML.
 *
 * Allowed structure (mirrors the editor's schema exactly):
 *   blocks:  paragraph, heading (level 2|3), bulletList, orderedList (start),
 *            listItem, blockquote, figure (path, alt, caption)
 *   inline:  text (marks: bold, italic, link{href}), hardBreak
 *
 * Framework-free and import-light, so it runs in node:test.
 */
import { isArticleImagePath } from "./media.ts";

/**
 * Serialised size cap, in UTF-8 bytes. Kept under the default 1 MB Server
 * Action request limit (next.config serverActions.bodySizeLimit is not
 * raised), so an oversized body gets this clear message instead of a
 * framework error. Images are stored by path, so they don't count.
 */
export const BODY_MAX_BYTES = 900_000;
export const MAX_FIGURES = 100;
const MAX_NODES = 50_000;
const MAX_DEPTH = 16;
const MAX_TEXT = 20_000;
const MAX_HREF = 2_000;
export const FIGURE_ALT_MAX = 300;
export const FIGURE_CAPTION_MAX = 500;

export type Mark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };
export type InlineNode = { type: "text"; text: string; marks?: Mark[] } | { type: "hardBreak" };
export type BlockNode =
  | { type: "paragraph"; content?: InlineNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: InlineNode[] }
  | { type: "bulletList"; content: ListItemNode[] }
  | { type: "orderedList"; attrs: { start: number }; content: ListItemNode[] }
  | { type: "blockquote"; content: BlockNode[] }
  | { type: "figure"; attrs: { path: string; alt: string; caption: string } };
export type ListItemNode = { type: "listItem"; content: BlockNode[] };
export interface ArticleDoc {
  type: "doc";
  content: BlockNode[];
}

export const EMPTY_ARTICLE_BODY: ArticleDoc = { type: "doc", content: [] };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

class Invalid extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * http(s) and mailto only; everything else (javascript:, data:, vbscript:,
 * relative or protocol-relative URLs) is refused. Returns the trimmed
 * href or null.
 */
export function safeLinkHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (href === "" || href.length > MAX_HREF || /[\s<>"]/.test(href)) return null;
  if (/^mailto:[^@\s]+@[^@\s]+$/i.test(href)) return href;
  try {
    const url = new URL(href);
    if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname) return href;
  } catch {}
  return null;
}

/**
 * What an editor types into the link box -> a safe href, or null.
 * "example.com/x" becomes "https://example.com/x"; an email address
 * becomes a mailto: link.
 */
export function normalizeLinkInput(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return safeLinkHref(`mailto:${value}`);
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return safeLinkHref(value);
  return safeLinkHref(`https://${value.replace(/^\/+/, "")}`);
}

function validate(input: unknown, articleId: string | null): ArticleDoc {
  let nodes = 0;
  let figures = 0;
  const count = () => {
    if (++nodes > MAX_NODES) throw new Invalid("The article is too long.");
  };

  const marks = (raw: unknown): Mark[] | undefined => {
    if (raw === undefined) return undefined;
    if (!Array.isArray(raw)) throw new Invalid("The article contains unsupported formatting.");
    const out: Mark[] = [];
    const seen = new Set<string>();
    for (const mark of raw) {
      if (!isRecord(mark) || typeof mark.type !== "string" || seen.has(mark.type)) {
        throw new Invalid("The article contains unsupported formatting.");
      }
      seen.add(mark.type);
      if (mark.type === "bold" || mark.type === "italic") out.push({ type: mark.type });
      else if (mark.type === "link") {
        const href = safeLinkHref(isRecord(mark.attrs) ? mark.attrs.href : undefined);
        if (!href) throw new Invalid("A link in the article is not a valid web or email address (http, https or mailto).");
        out.push({ type: "link", attrs: { href } });
      } else throw new Invalid("The article contains unsupported formatting.");
    }
    return out.length ? out : undefined;
  };

  const inline = (raw: unknown): InlineNode[] | undefined => {
    if (raw === undefined) return undefined;
    if (!Array.isArray(raw)) throw new Invalid("The article could not be read.");
    const out: InlineNode[] = [];
    for (const node of raw) {
      count();
      if (!isRecord(node)) throw new Invalid("The article could not be read.");
      if (node.type === "text") {
        if (typeof node.text !== "string" || node.text === "" || node.text.length > MAX_TEXT) {
          throw new Invalid("The article contains an invalid text block.");
        }
        const m = marks(node.marks);
        out.push(m ? { type: "text", text: node.text, marks: m } : { type: "text", text: node.text });
      } else if (node.type === "hardBreak") out.push({ type: "hardBreak" });
      else throw new Invalid("The article contains unsupported content.");
    }
    return out.length ? out : undefined;
  };

  const blocks = (raw: unknown, depth: number): BlockNode[] => {
    if (depth > MAX_DEPTH) throw new Invalid("The article is nested too deeply.");
    if (!Array.isArray(raw)) throw new Invalid("The article could not be read.");
    return raw.map((node) => block(node, depth));
  };

  const listItems = (raw: unknown, depth: number): ListItemNode[] => {
    if (!Array.isArray(raw) || raw.length === 0) throw new Invalid("The article contains an empty list.");
    return raw.map((item) => {
      count();
      if (!isRecord(item) || item.type !== "listItem") throw new Invalid("The article contains an invalid list.");
      const content = blocks(item.content ?? [], depth + 1);
      if (content.length === 0) throw new Invalid("The article contains an invalid list.");
      return { type: "listItem", content };
    });
  };

  const block = (node: unknown, depth: number): BlockNode => {
    count();
    if (!isRecord(node)) throw new Invalid("The article could not be read.");
    const attrs = isRecord(node.attrs) ? node.attrs : {};
    switch (node.type) {
      case "paragraph": {
        const content = inline(node.content);
        return content ? { type: "paragraph", content } : { type: "paragraph" };
      }
      case "heading": {
        const level = attrs.level;
        if (level !== 2 && level !== 3) throw new Invalid("Headings can be H2 or H3 only.");
        const content = inline(node.content);
        return content ? { type: "heading", attrs: { level }, content } : { type: "heading", attrs: { level } };
      }
      case "bulletList":
        return { type: "bulletList", content: listItems(node.content, depth) };
      case "orderedList": {
        const start = attrs.start ?? 1;
        if (typeof start !== "number" || !Number.isInteger(start) || start < 1 || start > 100_000) {
          throw new Invalid("The article contains an invalid numbered list.");
        }
        return { type: "orderedList", attrs: { start }, content: listItems(node.content, depth) };
      }
      case "blockquote": {
        const content = blocks(node.content ?? [], depth + 1);
        if (content.length === 0) throw new Invalid("The article contains an empty quote.");
        return { type: "blockquote", content };
      }
      case "figure": {
        const { path, alt = "", caption = "" } = attrs;
        if (articleId === null) throw new Invalid("Save the draft before adding images.");
        if (++figures > MAX_FIGURES) throw new Invalid(`An article can have at most ${MAX_FIGURES} images.`);
        if (typeof path !== "string" || !isArticleImagePath(articleId, path)) {
          throw new Invalid("An image in the article isn’t one of this Article’s uploads. Remove it and upload it again.");
        }
        if (typeof alt !== "string" || alt.length > FIGURE_ALT_MAX) throw new Invalid(`Image descriptions can be at most ${FIGURE_ALT_MAX} characters.`);
        if (typeof caption !== "string" || caption.length > FIGURE_CAPTION_MAX) throw new Invalid(`Image captions can be at most ${FIGURE_CAPTION_MAX} characters.`);
        return { type: "figure", attrs: { path, alt: alt.trim(), caption: caption.trim() } };
      }
      default:
        throw new Invalid("The article contains unsupported content.");
    }
  };

  if (!isRecord(input) || input.type !== "doc") throw new Invalid("The article could not be read.");
  return { type: "doc", content: blocks(input.content ?? [], 0) };
}

export function articleBodyBytes(raw: string): number {
  return new TextEncoder().encode(raw).length;
}

/**
 * Validates and normalises a body sent by the editor. `articleId` is null
 * before the first save, when no image can belong to the Article yet.
 */
export function parseArticleBody(raw: string, articleId: string | null): Result<ArticleDoc> {
  if (articleBodyBytes(raw) > BODY_MAX_BYTES) return { ok: false, error: "The article is too long to save. Split it or remove some text." };
  let input: unknown;
  try {
    input = JSON.parse(raw === "" ? JSON.stringify(EMPTY_ARTICLE_BODY) : raw);
  } catch {
    return { ok: false, error: "The article could not be read. Reload and try again." };
  }
  try {
    return { ok: true, value: validate(input, articleId) };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * A stored body, re-validated before rendering (defence in depth). An
 * invalid stored body renders as empty rather than risking unsafe output.
 */
export function readStoredArticleBody(stored: unknown, articleId: string): ArticleDoc {
  try {
    return validate(stored, articleId);
  } catch {
    return EMPTY_ARTICLE_BODY;
  }
}

function walk(nodes: readonly (BlockNode | ListItemNode)[], visit: (node: BlockNode | ListItemNode) => void) {
  for (const node of nodes) {
    visit(node);
    if (node.type === "bulletList" || node.type === "orderedList" || node.type === "blockquote" || node.type === "listItem") {
      walk(node.content, visit);
    }
  }
}

/** Storage paths of every inline image in the body. */
export function articleImagePaths(doc: ArticleDoc): string[] {
  const paths: string[] = [];
  walk(doc.content, (node) => {
    if (node.type === "figure") paths.push(node.attrs.path);
  });
  return paths;
}

/** True when the body has any visible text or an image. */
export function hasArticleContent(doc: ArticleDoc): boolean {
  let found = false;
  walk(doc.content, (node) => {
    if (found) return;
    if (node.type === "figure") found = true;
    else if ((node.type === "paragraph" || node.type === "heading") && node.content) {
      found = node.content.some((child) => child.type === "text" && child.text.trim() !== "");
    }
  });
  return found;
}
