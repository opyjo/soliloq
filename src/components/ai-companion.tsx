"use client";

import { useState } from "react";
import {
  AlertCircle,
  Bot,
  LoaderCircle,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CompanionMode, ChatMessage } from "@/app/api/ai-companion/route";
import { useDialogAccessibility } from "@/lib/use-dialog-accessibility";

type AICompanionProps = {
  isOpen: boolean;
  onClose: () => void;
  thoughtTitle: string | null;
  thoughtBody: string;
  onAppendToThought: (content: string) => void;
};

export function AICompanion({
  isOpen,
  onClose,
  thoughtTitle,
  thoughtBody,
  onAppendToThought,
}: AICompanionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useDialogAccessibility<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  async function triggerMode(mode: CompanionMode) {
    setIsLoading(true);
    setErrorMessage(null);

    const userPromptText = {
      "devils-advocate": "Play Devil's Advocate against my thought.",
      "socratic-questions": "Ask me 3 deep follow-up questions about this.",
      "blind-spots": "What blind spots or unstated assumptions am I making?",
      summarize: "Synthesize the core thesis of this thought.",
      freeform: inputQuery,
    }[mode];

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userPromptText },
    ];

    setMessages(newMessages);

    try {
      const res = await fetch("/api/ai-companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thoughtTitle,
          thoughtBody,
          mode,
          messages: newMessages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to reach AI Companion.");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message },
        ]);
      }
    } catch {
      setErrorMessage("Network error connecting to Moonshot AI API.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSendCustom() {
    if (!inputQuery.trim() || isLoading) return;
    triggerMode("freeform");
    setInputQuery("");
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-companion-title"
      tabIndex={-1}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--popover)] shadow-2xl backdrop-blur-xl outline-none"
    >
      <header className="flex h-16 items-center justify-between border-b border-[var(--border)] px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2
              id="ai-companion-title"
              className="text-sm font-semibold text-[var(--foreground)]"
            >
              AI Socratic Companion
            </h2>
            <p className="text-[10px] text-[var(--muted-foreground)]">
              Powered by Moonshot AI
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClose}
          aria-label="Close AI companion"
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="border-b border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
          Socratic Modes
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={isLoading}
            onClick={() => triggerMode("devils-advocate")}
            className="h-8 justify-start text-[11px] font-medium"
          >
            😈 Devil&apos;s Advocate
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isLoading}
            onClick={() => triggerMode("socratic-questions")}
            className="h-8 justify-start text-[11px] font-medium"
          >
            ❓ 3 Questions
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isLoading}
            onClick={() => triggerMode("blind-spots")}
            className="h-8 justify-start text-[11px] font-medium"
          >
            🔍 Blind Spots
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isLoading}
            onClick={() => triggerMode("summarize")}
            className="h-8 justify-start text-[11px] font-medium"
          >
            📝 Synthesize
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !errorMessage ? (
          <div className="grid h-full place-items-center text-center p-6">
            <div>
              <Bot className="mx-auto size-8 text-[var(--accent)] mb-2 opacity-80" />
              <p className="text-xs font-semibold text-[var(--foreground)]">
                Ask Moonshot AI to challenge or expand your thought
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                Select a Socratic mode above or type a custom question below.
              </p>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-3 text-xs text-[var(--danger)]">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        ) : null}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.role === "assistant" ? (
                <div className="mt-2.5 flex justify-end border-t border-[var(--border)] pt-2">
                  <button
                    type="button"
                    onClick={() => onAppendToThought(`\n\n> 🤖 **AI Socratic Insights:**\n> ${msg.content.replace(/\n/g, "\n> ")}`)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] hover:underline"
                  >
                    <Plus className="size-3" />
                    Append to thought
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] pt-2">
            <LoaderCircle className="size-3.5 animate-spin text-[var(--accent)]" />
            <span>Moonshot AI is contemplating…</span>
          </div>
        ) : null}
      </div>

      <footer className="border-t border-[var(--border)] p-3 bg-[var(--surface)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendCustom();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Moonshot AI about this thought…"
            aria-label="Ask the AI companion"
            className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 text-xs outline-none focus:border-[var(--accent)]"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputQuery.trim() || isLoading}
            className="size-10 shrink-0"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </footer>
    </div>
  );
}
