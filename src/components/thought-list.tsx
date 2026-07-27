"use client";

import { Search, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Thought } from "@/lib/database.types";
import { cn, deriveThoughtTitle, formatRelativeDate } from "@/lib/utils";

type ThoughtListProps = {
  title: string;
  description: string;
  thoughts: Thought[];
  activeId: string | null;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  className?: string;
};

export function ThoughtList({
  title,
  description,
  thoughts,
  activeId,
  search,
  onSearch,
  onSelect,
  onNew,
  className,
}: ThoughtListProps) {
  return (
    <section
      className={cn(
        "min-h-0 flex-col border-r border-[var(--border)] bg-[var(--panel)]",
        className,
      )}
    >
      <header className="border-b border-[var(--border)] px-5 pb-4 pt-5 lg:px-6 lg:pt-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.035em]">{title}</h1>
            <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
          </div>
          <Button
            size="icon"
            onClick={onNew}
            aria-label="Create a new thought"
            className="lg:hidden"
          >
            <SquarePen className="size-4" />
          </Button>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search your words"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] pl-9 pr-3 text-sm outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
          />
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {thoughts.length ? (
          <div className="space-y-1">
            {thoughts.map((thought) => {
              const displayTitle = thought.title?.trim() || deriveThoughtTitle(thought.body);
              const preview = thought.body
                .replace(/\s+/g, " ")
                .trim()
                .replace(displayTitle, "")
                .trim();

              return (
                <button
                  key={thought.id}
                  type="button"
                  onClick={() => onSelect(thought.id)}
                  className={cn(
                    "group relative w-full rounded-2xl border px-4 py-3.5 text-left transition",
                    activeId === thought.id
                      ? "border-[var(--border-strong)] bg-[var(--surface-selected)] shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
                      : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface)]",
                  )}
                >
                  {thought.is_pinned ? (
                    <span className="absolute right-3 top-3 size-1.5 rounded-full bg-[var(--accent)]" />
                  ) : null}
                  <div className="pr-4 text-[15px] font-medium leading-5 tracking-[-0.015em]">
                    {displayTitle}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                    {preview || "A fresh page, waiting for you."}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
                    <span>{thought.status === "developing" ? "Developing" : thought.status}</span>
                    <time>{formatRelativeDate(thought.updated_at)}</time>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid h-full min-h-64 place-items-center px-7 text-center">
            <div>
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <SquarePen className="size-5 text-[var(--muted-foreground)]" />
              </div>
              <p className="text-sm font-medium">
                {search ? "No matching thoughts" : "A quiet beginning"}
              </p>
              <p className="mx-auto mt-2 max-w-52 text-xs leading-5 text-[var(--muted)]">
                {search
                  ? "Try a different word or phrase."
                  : "Write whatever is on your mind. You can make sense of it later."}
              </p>
              {!search ? (
                <Button variant="secondary" size="sm" className="mt-5" onClick={onNew}>
                  Start writing
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
