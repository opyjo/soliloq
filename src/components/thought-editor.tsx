"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BarChart3,
  Brain,
  CalendarClock,
  Check,
  Cloud,
  CloudOff,
  Eye,
  Edit3,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MoreHorizontal,
  Pin,
  PinOff,
  Sparkles,
  Timer,
  Trash2,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Thought, ThoughtStatus } from "@/lib/database.types";
import type { AudioAttachment, FontFamily } from "@/lib/types";
import { MarkdownPreview } from "@/components/markdown-preview";
import { WritingStatsModal } from "@/components/writing-stats-modal";
import { AudioRecorder } from "@/components/audio-recorder";
import { DeepPromptsModal } from "@/components/deep-prompts";
import { AmbientAudioPlayer } from "@/components/ambient-audio";
import { SprintTimerModal } from "@/components/sprint-timer";
import { AICompanion } from "@/components/ai-companion";
import {
  loadAudioAttachments,
  removeAudioAttachment,
  saveAudioAttachment,
} from "@/lib/audio-attachments";
import {
  loadCloudAudioAttachments,
  removeCloudAudioAttachment,
  syncAudioAttachment,
} from "@/lib/cloud-audio";
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
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onWikiLinkClick?: (title: string) => void;
  onTagClick?: (tag: string) => void;
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
  isFocusMode,
  onToggleFocusMode,
  onWikiLinkClick,
  onTagClick,
}: ThoughtEditorProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans");
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isSprintOpen, setIsSprintOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [audioAttachments, setAudioAttachments] = useState<AudioAttachment[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [leavingAction, setLeavingAction] = useState<"archive" | "delete" | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const leavingTimeoutRef = useRef<number | null>(null);
  const audioAttachmentsRef = useRef<AudioAttachment[]>([]);
  const isAudioMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (leavingTimeoutRef.current) {
        window.clearTimeout(leavingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    isAudioMountedRef.current = true;

    void Promise.allSettled([
      loadAudioAttachments(thought.user_id, thought.id),
      loadCloudAudioAttachments(thought.user_id, thought.id),
    ]).then((results) => {
      const local =
        results[0].status === "fulfilled" ? results[0].value : [];
      const cloud =
        results[1].status === "fulfilled" ? results[1].value : [];
      const merged = new Map<string, AudioAttachment>();
      local.forEach((attachment) => merged.set(attachment.id, attachment));
      cloud.forEach((attachment) => {
        const localAttachment = merged.get(attachment.id);
        if (localAttachment) URL.revokeObjectURL(localAttachment.url);
        merged.set(attachment.id, attachment);
      });
      const attachments = Array.from(merged.values()).toSorted((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      if (cancelled) {
        attachments.forEach((attachment) =>
          URL.revokeObjectURL(attachment.url),
        );
        return;
      }
      audioAttachmentsRef.current = attachments;
      setAudioAttachments(attachments);
      if (results.every((result) => result.status === "rejected")) {
        setAudioError("Voice memos could not be loaded.");
      }
    });

    return () => {
      cancelled = true;
      isAudioMountedRef.current = false;
      audioAttachmentsRef.current.forEach((attachment) =>
        URL.revokeObjectURL(attachment.url),
      );
      audioAttachmentsRef.current = [];
    };
  }, [thought.id, thought.user_id]);

  useEffect(() => {
    audioAttachmentsRef.current = audioAttachments;
  }, [audioAttachments]);

  useEffect(() => {
    if (!isMarkdownPreview) {
      bodyRef.current?.focus();
    }
  }, [thought.id, isMarkdownPreview]);

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
    setLeavingAction("delete");
    leavingTimeoutRef.current = window.setTimeout(onDelete, 240);
  }

  function handleArchive() {
    setIsMenuOpen(false);
    setLeavingAction("archive");
    leavingTimeoutRef.current = window.setTimeout(() => {
      onPatch({ status: "archived" });
      setLeavingAction(null);
    }, 240);
  }

  function reviewOn(dayOffset: number) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    date.setHours(9, 0, 0, 0);
    onPatch({ review_at: date.toISOString() });
  }

  function handleInsertPrompt(template: string) {
    onPatch({ body: `${thought.body}${template}` });
  }

  function handleAppendAIText(content: string) {
    onPatch({ body: `${thought.body}${content}` });
  }

  async function handleAddAudioAttachment(attachment: AudioAttachment) {
    setAudioError(null);
    try {
      await saveAudioAttachment(thought.user_id, thought.id, attachment);
      if (!isAudioMountedRef.current) {
        URL.revokeObjectURL(attachment.url);
        return;
      }
      setAudioAttachments((current) => [attachment, ...current]);
      try {
        const synced = await syncAudioAttachment(
          thought.user_id,
          thought.id,
          attachment,
        );
        if (isAudioMountedRef.current) {
          setAudioAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id ? synced : item,
            ),
          );
        }
      } catch {
        if (isAudioMountedRef.current) {
          setAudioError(
            "Voice memo saved on this device; cloud sync is unavailable.",
          );
        }
      }
    } catch {
      URL.revokeObjectURL(attachment.url);
      setAudioError("This voice memo could not be saved.");
    }
  }

  async function handleRemoveAudioAttachment(id: string) {
    const attachment = audioAttachments.find((item) => item.id === id);
    setAudioError(null);
    try {
      await removeAudioAttachment(thought.user_id, thought.id, id);
      if (attachment?.synced || navigator.onLine) {
        try {
          await removeCloudAudioAttachment(
            thought.user_id,
            thought.id,
            id,
            attachment?.storagePath,
          );
        } catch {
          setAudioError(
            "Removed locally, but cloud cleanup will need another try.",
          );
        }
      }
      setAudioAttachments((current) =>
        current.filter((item) => item.id !== id),
      );
      if (attachment) URL.revokeObjectURL(attachment.url);
    } catch {
      setAudioError("This voice memo could not be deleted.");
    }
  }

  const wordCount = thought.body.trim()
    ? thought.body.trim().split(/\s+/).length
    : 0;

  const fontClass = {
    sans: "font-sans-writing",
    serif: "font-serif-writing",
    mono: "font-mono-writing",
  }[fontFamily];

  return (
    <section
      className={cn(
        "thought-editor relative min-w-0 flex-1 overflow-hidden bg-[var(--editor)]",
        isFocusMode && "is-focus-mode",
        leavingAction && `thought-leaving-${leavingAction}`,
      )}
    >
      <div className="editor-ambient" aria-hidden="true" />
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

          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value as FontFamily)}
            className="hidden sm:block h-9 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium outline-none hover:bg-[var(--surface-hover)]"
            aria-label="Typography style"
            title="Choose Font Style"
          >
            <option value="sans">Sans Serif</option>
            <option value="serif">Serif (Literary)</option>
            <option value="mono">Monospace</option>
          </select>

          <div className="hidden xl:block">
            <AmbientAudioPlayer />
          </div>
        </div>

        {/* Clustered Toolbars */}
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} />

          {/* AI & Insights Cluster */}
          <div className="cluster-pill">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsAIOpen((prev) => !prev)}
              aria-label="Moonshot AI Companion"
              title="AI Socratic Companion"
              className={cn("size-8", isAIOpen && "text-[var(--accent)] glow-accent bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]")}
            >
              <Sparkles className="size-4 text-[var(--accent)]" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPromptsOpen(true)}
              aria-label="Socratic Prompts"
              title="Socratic & Mental Model Prompts"
              className="size-8"
            >
              <Brain className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsStatsOpen(true)}
              aria-label="Writing Metrics"
              title="Writing Insights & Word Counts"
              className="size-8"
            >
              <BarChart3 className="size-4" />
            </Button>
          </div>

          {/* Focus Tools Cluster */}
          <div className="cluster-pill">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSprintOpen(true)}
              aria-label="Sprint Timer"
              title="Monk Mode Writing Sprint"
              className="size-8"
            >
              <Timer className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFocusMode}
              aria-label={isFocusMode ? "Exit focus mode" : "Enter focus mode"}
              title="Zen Focus Mode"
              className="size-8"
            >
              {isFocusMode ? (
                <Minimize2 className="size-4 text-[var(--accent)]" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          </div>

          {/* Editor Actions Cluster */}
          <div className="cluster-pill">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMarkdownPreview((prev) => !prev)}
              aria-label={isMarkdownPreview ? "Switch to editor" : "Switch to markdown preview"}
              title="Toggle Markdown Live Preview"
              className={cn("size-8", isMarkdownPreview && "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]")}
            >
              {isMarkdownPreview ? <Edit3 className="size-4" /> : <Eye className="size-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAudioRecorder((prev) => !prev)}
              aria-label="Toggle voice memo recorder"
              title="Voice Memos"
              className={cn("size-8", showAudioRecorder && "text-[var(--accent)]")}
            >
              <Volume2 className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDictation}
              aria-label={isDictating ? "Stop dictation" : "Start dictation"}
              title="Voice Dictation"
              className={cn("size-8", isDictating && "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]")}
            >
              {isDictating ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onPatch({ is_pinned: !thought.is_pinned })}
              aria-label={thought.is_pinned ? "Unpin thought" : "Pin thought"}
              title="Pin Thought"
              className={cn("size-8", thought.is_pinned && "pin-bloom")}
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
                className="size-8"
              >
                <MoreHorizontal className="size-4" />
              </Button>

              {isMenuOpen ? (
                <div className="absolute right-0 top-11 z-30 w-44 rounded-xl border border-[var(--border)] bg-[var(--popover)] p-1.5 shadow-2xl">
                  <button
                    type="button"
                    onClick={handleArchive}
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
        </div>
      </header>

      <div className="editor-scroll h-[calc(100dvh-4rem)] overflow-y-auto lg:h-[calc(100dvh-4.5rem)]">
        <article className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 pb-20 pt-10 sm:px-10 lg:px-14 lg:pt-16">
          <input
            value={thought.title ?? ""}
            onChange={(event) => onPatch({ title: event.target.value || null })}
            placeholder="Untitled thought"
            className={cn(
              "w-full bg-transparent text-[18px] font-semibold leading-tight tracking-tight text-[var(--foreground)] outline-none placeholder:text-[var(--placeholder)] sm:text-[20px]",
              fontClass,
            )}
            aria-label="Thought title"
          />

          {showAudioRecorder ? (
            <div className="mt-4">
              <AudioRecorder
                attachments={audioAttachments}
                onAddAttachment={(attachment) =>
                  void handleAddAudioAttachment(attachment)
                }
                onRemoveAttachment={(id) =>
                  void handleRemoveAudioAttachment(id)
                }
              />
              {audioError ? (
                <p
                  role="alert"
                  className="mt-2 text-xs text-[var(--danger)]"
                >
                  {audioError}
                </p>
              ) : null}
            </div>
          ) : null}

          {isMarkdownPreview ? (
            <div className="mt-5 min-h-[48dvh] w-full flex-1">
              <MarkdownPreview
                content={thought.body}
                onWikiLinkClick={onWikiLinkClick}
                onTagClick={onTagClick}
                className={fontClass}
              />
            </div>
          ) : (
            <textarea
              ref={bodyRef}
              value={thought.body}
              onChange={(event) => onPatch({ body: event.target.value })}
              placeholder={"Start wherever you are.\n\nYou do not need to make sense of it yet.\n\nTips: Use #tags to categorize, or [[Other Thought]] to link."}
              className={cn(
                "mt-5 min-h-[48dvh] w-full flex-1 resize-none bg-transparent text-[13px] leading-[1.75] text-[var(--writing)] outline-none placeholder:text-[var(--placeholder)] sm:text-[14px]",
                fontClass,
              )}
              aria-label="Thought"
            />
          )}

          <footer className="mt-12 flex flex-wrap items-center justify-between gap-5 border-t border-[var(--border)] pt-5 text-[11px] text-[var(--muted)]">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsStatsOpen(true)}
                className={cn("hover:text-[var(--foreground)]", wordCount >= 100 && "word-milestone")}
              >
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </button>
              <span>
                Created{" "}
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(thought.created_at))}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CalendarClock className="size-3.5" />
              <span className="mr-1">Bring back</span>
              <button
                type="button"
                onClick={() => reviewOn(1)}
                className="review-chip"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => reviewOn(7)}
                className="review-chip"
              >
                Next week
              </button>
              <label className="review-chip cursor-pointer">
                <span>Choose date</span>
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
                  className="sr-only"
                  aria-label="Review date"
                />
              </label>
              {thought.review_at ? (
                <button
                  type="button"
                  onClick={() => onPatch({ review_at: null })}
                  className="review-chip text-[var(--danger)]"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </footer>
        </article>
      </div>

      <WritingStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        title={thought.title}
        body={thought.body}
      />

      <DeepPromptsModal
        isOpen={isPromptsOpen}
        onClose={() => setIsPromptsOpen(false)}
        onInsertPrompt={handleInsertPrompt}
      />

      <SprintTimerModal
        isOpen={isSprintOpen}
        onClose={() => setIsSprintOpen(false)}
        currentWordCount={wordCount}
      />

      <AICompanion
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        thoughtTitle={thought.title}
        thoughtBody={thought.body}
        onAppendToThought={handleAppendAIText}
      />
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
      aria-live="polite"
      className={cn(
        "save-indicator mr-1 hidden items-center gap-1.5 text-[11px] sm:flex",
        `save-${state}`,
        state === "error" ? "text-[var(--danger)]" : "text-[var(--muted)]",
      )}
    >
      <Icon className="size-3.5" />
      <span>{config.label}</span>
    </div>
  );
}
