import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Tiny markdown -> React renderer for our blog body content.
 *
 * We don't need a full markdown/MDX pipeline for 5 hand-written articles
 * with a deliberately small set of formatting needs (headings, paragraphs,
 * bold text, links, and simple lists), so this hand-rolled renderer avoids
 * adding a markdown dependency. Internal links (starting with "/") use
 * `next/link` for client-side navigation; external links open in a new tab.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Matches **bold** or [label](href), left to right.
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-[#0f172a]">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const label = match[2];
      const href = match[3];
      const isInternal = href.startsWith("/");
      nodes.push(
        isInternal ? (
          <Link key={`${keyPrefix}-a-${index}`} href={href} className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700">
            {label}
          </Link>
        ) : (
          <a
            key={`${keyPrefix}-a-${index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            {label}
          </a>
        ),
      );
    }

    lastIndex = pattern.lastIndex;
    index += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let blockIndex = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(" ");
    blocks.push(
      <p key={`p-${blockIndex++}`} className="text-base leading-7 text-[#334155]">
        {renderInline(text, `p-${blockIndex}`)}
      </p>,
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${blockIndex++}`} className="list-disc space-y-2 pl-6 text-base leading-7 text-[#334155]">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blockIndex}-${i}`)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      blocks.push(
        level === 2 ? (
          <h2 key={`h-${blockIndex++}`} className="mt-10 text-2xl font-semibold tracking-tight text-[#0f172a]">
            {renderInline(text, `h-${blockIndex}`)}
          </h2>
        ) : (
          <h3 key={`h-${blockIndex++}`} className="mt-8 text-xl font-semibold tracking-tight text-[#0f172a]">
            {renderInline(text, `h-${blockIndex}`)}
          </h3>
        ),
      );
      continue;
    }

    const listMatch = /^[-*]\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}
