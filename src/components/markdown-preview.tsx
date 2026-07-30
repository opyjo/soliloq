"use client";

import React from "react";
import { cn } from "@/lib/utils";

type MarkdownPreviewProps = {
  content: string;
  className?: string;
  onWikiLinkClick?: (title: string) => void;
  onTagClick?: (tag: string) => void;
};

export function MarkdownPreview({
  content,
  className,
  onWikiLinkClick,
  onTagClick,
}: MarkdownPreviewProps) {
  if (!content.trim()) {
    return (
      <div className="italic text-[var(--muted)]">
        Nothing to preview yet. Start typing in the editor.
      </div>
    );
  }

  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];

  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    // Code block handling
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${idx}`}
            className="my-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs font-mono leading-relaxed text-[var(--foreground)]"
          >
            <code>{codeBlockBuffer.join("\n")}</code>
          </pre>
        );
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      return;
    }

    // Headers
    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={idx}
          className="mb-2 mt-4 text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg"
        >
          {parseInlineText(line.slice(2), idx, onWikiLinkClick, onTagClick)}
        </h1>
      );
      return;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={idx}
          className="mb-2 mt-3 text-sm font-semibold tracking-tight text-[var(--foreground)] sm:text-base"
        >
          {parseInlineText(line.slice(3), idx, onWikiLinkClick, onTagClick)}
        </h2>
      );
      return;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={idx}
          className="mb-1 mt-2 text-xs font-semibold text-[var(--foreground)] sm:text-sm"
        >
          {parseInlineText(line.slice(4), idx, onWikiLinkClick, onTagClick)}
        </h3>
      );
      return;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={idx}
          className="my-2 border-l-2 border-[var(--accent)] pl-3 italic text-[var(--muted-foreground)] text-xs sm:text-[13px]"
        >
          {parseInlineText(line.slice(2), idx, onWikiLinkClick, onTagClick)}
        </blockquote>
      );
      return;
    }

    // Unordered List
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const itemText = line.trim().slice(2);
      elements.push(
        <li
          key={idx}
          className="ml-4 list-disc my-0.5 text-[var(--writing)]"
        >
          {parseInlineText(itemText, idx, onWikiLinkClick, onTagClick)}
        </li>
      );
      return;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-3" />);
      return;
    }

    // Normal Paragraph
    elements.push(
      <p key={idx} className="my-1.5 leading-relaxed text-[var(--writing)]">
        {parseInlineText(line, idx, onWikiLinkClick, onTagClick)}
      </p>
    );
  });

  if (inCodeBlock) {
    elements.push(
      <pre
        key="code-unclosed"
        className="my-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs font-mono leading-relaxed text-[var(--foreground)]"
      >
        <code>{codeBlockBuffer.join("\n")}</code>
      </pre>,
    );
  }

  return (
    <div className={cn("markdown-preview text-[13px] sm:text-[14px]", className)}>
      {elements}
    </div>
  );
}

function parseInlineText(
  text: string,
  keyPrefix: number | string,
  onWikiLinkClick?: (title: string) => void,
  onTagClick?: (tag: string) => void
): React.ReactNode {
  // Regex to match [[WikiLinks]], Markdown links, #tags, **bold**, *italic*, `code`
  const regex =
    /(\[\[(.*?)\]\])|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(#[\w-]+)|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`(.*?)`)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // 1. [[WikiLink]]
    if (match[1]) {
      const targetTitle = match[2];
      parts.push(
        <button
          key={`${keyPrefix}-wiki-${match.index}`}
          type="button"
          onClick={() => onWikiLinkClick?.(targetTitle)}
          className="mx-0.5 inline-flex items-center rounded bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-1.5 py-0.5 text-xs font-semibold text-[var(--accent)] hover:underline"
        >
          📄 {targetTitle}
        </button>
      );
    }
    // 2. [label](https://example.com)
    else if (match[3]) {
      parts.push(
        <a
          key={`${keyPrefix}-link-${match.index}`}
          href={match[5]}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] underline decoration-[color-mix(in_srgb,var(--accent)_45%,transparent)] underline-offset-2 hover:decoration-[var(--accent)]"
        >
          {match[4]}
        </a>,
      );
    }
    // 3. #tag
    else if (match[6]) {
      const tagName = match[6];
      parts.push(
        <button
          key={`${keyPrefix}-tag-${match.index}`}
          type="button"
          onClick={() => onTagClick?.(tagName)}
          className="mx-0.5 inline-flex items-center rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] hover:text-[var(--accent)]"
        >
          {tagName}
        </button>
      );
    }
    // 4. **bold**
    else if (match[7]) {
      parts.push(
        <strong key={`${keyPrefix}-bold-${match.index}`} className="font-semibold text-[var(--foreground)]">
          {match[8]}
        </strong>
      );
    }
    // 5. *italic*
    else if (match[9]) {
      parts.push(
        <em key={`${keyPrefix}-italic-${match.index}`} className="italic">
          {match[10]}
        </em>
      );
    }
    // 6. `code`
    else if (match[11]) {
      parts.push(
        <code
          key={`${keyPrefix}-code-${match.index}`}
          className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-mono text-[var(--foreground)]"
        >
          {match[12]}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}
