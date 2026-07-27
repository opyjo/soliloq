"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  Check,
  Cloud,
  CloudOff,
  Mic,
  MicOff,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Thought, ThoughtStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

type BrowserSpeechResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type BrowserSpeechEvent = {
  results: ArrayLike<BrowserSpeechResult>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: BrowserSpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

type ThoughtEditorProps = {
  thought: Thought;
  saveState: SaveState;
  onPatch: (patch: Partial<Thought>) => void;
  onDelete: () => void;
  onBack: () => void;
};

const statusLabels: Record<ThoughtStatus, string> = {
  inbox: "Inbox",
  developing: "Developing",
  finished: "Finished",
  archived: "Archived",
};

export function ThoughtEditor({
  thought,
  saveState,
  onPatch,
  onDelete,
  onBack,
}: ThoughtEditorProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    bodyRef.current?.focus();
  }, [thought.id]);

  function toggleDictation() {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      window.alert(
        "Built-in dictation is not available in this browser. You can still use the microphone on your phone keyboard.",
      );
      return;
    }

    const recognition = new Recognition();
    const startingBody = thought.body;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();

      if (transcript) {
        const spacer = startingBody.trim() ? " " : "";
        onPatch({ body: `${startingBody}${spacer}${transcript}` });
      }
    };
    recognition.onend = () => setIsDictating(false);
    recognition.onerror = () => setIsDictating(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
  }

  function handleDelete() {
    if (!window.confirm("Delete this thought permanently?")) return;
    onDelete();
  }

  const wordCount = thought.body.trim()
    ? thought.body.trim().split(/\s+/).length
    : 0;

  return (
    <section className="relative min-w-0 flex-1 bg-[var(--editor)]">
      <header className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4 sm:px-6 lg:h-18 lg:px-8">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onBack}
            aria-label="Back to thoughts"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <select
            value={thought.status}
            onChange={(event) =>
              onPatch({ status: event.target.value as ThoughtStatus })
            }
            className="h-9 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium outline-none hover:bg-[var(--surface-hover)]"
            aria-label="Thought status"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <SaveIndicator state={saveState} />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDictation}
            aria-label={isDictating ? "Stop dictation" : "Start dictation"}
            className={cn(
              isDictating && "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]",
            )}
          >
            {isDictating ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPatch({ is_pinned: !thought.is_pinned })}
            aria-label={thought.is_pinned ? "Unpin thought" : "Pin thought"}
          >
            {thought.is_pinned ? (
              <PinOff className="size-4 text-[var(--accent)]" />
            ) : (
              <Pin className="size-4" />
            )}
          </Button>

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label="More thought actions"
              aria-expanded={isMenuOpen}
            >
              <MoreHorizontal className="size-4" />
            </Button>

            {isMenuOpen ? (
              <div className="absolute right-0 top-11 z-30 w-44 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1.5 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    onPatch({ status: "archived" });
                    setIsMenuOpen(false);
                  }}
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                >
                  <Archive className="size-3.5" />
                  Archive
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                >
                  <Trash2 className="size-3.5" />
                  Delete forever
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="editor-scroll h-[calc(100dvh-4rem)] overflow-y-auto lg:h-[calc(100dvh-4.5rem)]">
        <article className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 pb-20 pt-10 sm:px-10 lg:px-14 lg:pt-16">
          <input
            value={thought.title ?? ""}
            onChange={(event) => onPatch({ title: event.target.value || null })}
            placeholder="Untitled thought"
            className="w-full bg-transparent text-3xl font-medium leading-tight tracking-[-0.045em] text-[var(--foreground)] outline-none placeholder:text-[var(--placeholder)] sm:text-4xl"
            aria-label="Thought title"
          />

          <textarea
            ref={bodyRef}
            value={thought.body}
            onChange={(event) => onPatch({ body: event.target.value })}
            placeholder={"Start wherever you are.\n\nYou do not need to make sense of it yet."}
            className="mt-8 min-h-[48dvh] w-full flex-1 resize-none bg-transparent text-[17px] leading-[1.9] text-[var(--writing)] outline-none placeholder:text-[var(--placeholder)] sm:text-[18px]"
            aria-label="Thought"
          />

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-5 text-[11px] text-[var(--muted)]">
            <div className="flex items-center gap-4">
              <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
              <span>
                Created{" "}
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(thought.created_at))}
              </span>
            </div>

            <label className="flex items-center gap-2">
              <CalendarClock className="size-3.5" />
              <span>Bring back</span>
              <input
                type="date"
                value={thought.review_at?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  onPatch({
                    review_at: event.target.value
                      ? new Date(`${event.target.value}T09:00:00`).toISOString()
                      : null,
                  })
                }
                className="rounded-md bg-transparent text-[var(--muted-foreground)] outline-none"
                aria-label="Review date"
              />
            </label>
          </footer>
        </article>
      </div>
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const config = {
    idle: { icon: Cloud, label: "Ready" },
    saving: { icon: Cloud, label: "Saving…" },
    saved: { icon: Check, label: "Saved" },
    offline: { icon: CloudOff, label: "Saved locally" },
    error: { icon: CloudOff, label: "Not synced" },
  }[state];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "mr-1 hidden items-center gap-1.5 text-[11px] sm:flex",
        state === "error" ? "text-[var(--danger)]" : "text-[var(--muted)]",
      )}
    >
      <Icon className="size-3.5" />
      <span>{config.label}</span>
    </div>
  );
}
