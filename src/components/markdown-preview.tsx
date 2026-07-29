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
          className="mb-4 mt-6 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl"
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
          className="mb-3 mt-5 text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl"
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
          className="mb-2 mt-4 text-lg font-semibold text-[var(--foreground)] sm:text-xl"
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
          className="my-3 border-l-2 border-[var(--accent)] pl-4 italic text-[var(--muted-foreground)]"
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
          className="ml-5 list-disc my-1 text-[var(--writing)]"
        >
          {parseInlineText(itemText, idx, onWikiLinkClick, onTagClick)}
        </li>
      );
      return;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-4" />);
      return;
    }

    // Normal Paragraph
    elements.push(
      <p key={idx} className="my-2 leading-relaxed text-[var(--writing)]">
        {parseInlineText(line, idx, onWikiLinkClick, onTagClick)}
      </p>
    );
  });

  return (
    <div className={cn("markdown-preview text-[17px] sm:text-[18px]", className)}>
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
  // Regex to match [[WikiLinks]], #tags, **bold**, *italic*, `code`
  const regex = /(\[\[(.*?)\]\])|(#[\w\-]+)|(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`(.*?)`)/g;

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
    // 2. #tag
    else if (match[3]) {
      const tagName = match[3];
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
    // 3. **bold**
    else if (match[4]) {
      parts.push(
        <strong key={`${keyPrefix}-bold-${match.index}`} className="font-semibold text-[var(--foreground)]">
          {match[5]}
        </strong>
      );
    }
    // 4. *italic*
    else if (match[6]) {
      parts.push(
        <em key={`${keyPrefix}-italic-${match.index}`} className="italic">
          {match[7]}
        </em>
      );
    }
    // 5. `code`
    else if (match[8]) {
      parts.push(
        <code
          key={`${keyPrefix}-code-${match.index}`}
          className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-xs font-mono text-[var(--foreground)]"
        >
          {match[9]}
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
