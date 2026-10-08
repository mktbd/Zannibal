import { Fragment, type ReactNode } from "react";
import type { ArticleDoc, BlockNode, InlineNode, Mark } from "@/lib/article-body";
import { mediaPublicUrl } from "@/lib/media";

/**
 * Renders a validated Article body (lib/article-body.ts) as React
 * elements. Every node type maps to a fixed element; text is always
 * rendered as text, never as HTML (no dangerouslySetInnerHTML), and links
 * carry only an href the validator has already restricted to
 * http/https/mailto. Callers must pass a body that went through
 * readStoredArticleBody / parseArticleBody.
 *
 * Used by the Admin preview now and by the public /articles/[slug] page
 * in Stage 5C, so both read the same way.
 */
export function ArticleBody({ doc }: { doc: ArticleDoc }) {
  return <div className="article-body">{doc.content.map((node, index) => renderBlock(node, index))}</div>;
}

function renderBlock(node: BlockNode, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{renderInline(node.content)}</p>;
    case "heading":
      return node.attrs.level === 2 ? (
        <h2 key={key}>{renderInline(node.content)}</h2>
      ) : (
        <h3 key={key}>{renderInline(node.content)}</h3>
      );
    case "bulletList":
      return (
        <ul key={key}>
          {node.content.map((item, index) => (
            <li key={index}>{item.content.map((child, i) => renderBlock(child, i))}</li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} start={node.attrs.start === 1 ? undefined : node.attrs.start}>
          {node.content.map((item, index) => (
            <li key={index}>{item.content.map((child, i) => renderBlock(child, i))}</li>
          ))}
        </ol>
      );
    case "blockquote":
      return <blockquote key={key}>{node.content.map((child, i) => renderBlock(child, i))}</blockquote>;
    case "figure":
      return (
        <figure key={key}>
          {/* eslint-disable-next-line @next/next/no-img-element -- editorial image at its natural ratio; sizes are unknown */}
          <img src={mediaPublicUrl(node.attrs.path)} alt={node.attrs.alt} loading="lazy" decoding="async" />
          {node.attrs.caption ? <figcaption>{node.attrs.caption}</figcaption> : null}
        </figure>
      );
  }
}

function renderInline(content: InlineNode[] | undefined): ReactNode {
  if (!content) return null;
  return content.map((node, index) =>
    node.type === "hardBreak" ? <br key={index} /> : applyMarks(node.text, node.marks ?? [], index),
  );
}

function applyMarks(text: string, marks: Mark[], key: number): ReactNode {
  let out: ReactNode = text;
  // Link outermost, so bold/italic text inside a citation stays one link.
  for (const mark of [...marks].sort((a, b) => (a.type === "link" ? 1 : 0) - (b.type === "link" ? 1 : 0))) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else {
      const external = !mark.attrs.href.startsWith("mailto:");
      out = (
        <a
          href={mark.attrs.href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {out}
          {external ? (
            <>
              <span aria-hidden="true" className="article-external">
                ↗
              </span>
              <span className="sr-only"> (opens in a new tab)</span>
            </>
          ) : null}
        </a>
      );
    }
  }
  return <Fragment key={key}>{out}</Fragment>;
}
