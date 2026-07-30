"use client";

import type { LucideIcon } from "lucide-react";
import { Search, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useDialogAccessibility } from "@/lib/use-dialog-accessibility";

export type PaletteCommand = {
  id: string;
  label: string;
  description: string;
  keywords?: string;
  shortcut?: string;
  icon: LucideIcon;
  disabled?: boolean;
  action: () => void;
};

type CommandPaletteProps = {
  commands: PaletteCommand[];
  isOpen: boolean;
  onClose: () => void;
};

export function CommandPalette({
  commands,
  isOpen,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  function closePalette() {
    setQuery("");
    onClose();
  }

  const dialogRef = useDialogAccessibility<HTMLElement>(
    isOpen,
    closePalette,
  );

  const visibleCommands = (() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return commands;

    return commands.filter((command) =>
      `${command.label} ${command.description} ${command.keywords ?? ""}`
        .toLocaleLowerCase()
        .includes(needle),
    );
  })();

  if (!isOpen) return null;

  return (
    <div
      className="command-backdrop fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePalette();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick actions"
        tabIndex={-1}
        className="command-panel w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--popover)_94%,transparent)] shadow-[0_32px_100px_rgba(0,0,0,0.55)]"
      >
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-4">
          <Search className="size-4 shrink-0 text-[var(--accent)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actions, views, and thoughts…"
            aria-label="Search quick actions"
            className="h-16 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--placeholder)]"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={closePalette}
            aria-label="Close quick actions"
            className="size-9"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {visibleCommands.length ? (
            <div className="space-y-1">
              {visibleCommands.map((command, index) => {
                const Icon = command.icon;

                return (
                  <button
                    key={command.id}
                    type="button"
                    disabled={command.disabled}
                    onClick={() => {
                      command.action();
                      closePalette();
                    }}
                    className="command-item group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition disabled:pointer-events-none disabled:opacity-35"
                    style={{ animationDelay: `${index * 28}ms` }}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition group-hover:border-[var(--border-strong)] group-hover:text-[var(--accent)]">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {command.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                        {command.description}
                      </span>
                    </span>
                    {command.shortcut ? (
                      <kbd className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[10px] text-[var(--muted)]">
                        {command.shortcut}
                      </kbd>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center px-8 text-center">
              <div>
                <Sparkles className="mx-auto size-5 text-[var(--accent)]" />
                <p className="mt-3 text-sm font-medium">No action found</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Try a view name or an action like “pin”.
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-[10px] text-[var(--muted)]">
          <span>Still quick actions</span>
          <span>
            <kbd className="font-mono">esc</kbd> to close
          </span>
        </footer>
      </section>
    </div>
  );
}
