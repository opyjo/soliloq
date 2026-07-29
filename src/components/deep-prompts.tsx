"use client";

import { useState } from "react";
import { Brain, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MentalModelPrompt = {
  id: string;
  category: "First Principles" | "Inversion" | "5 Whys" | "Second-Order" | "Pre-Mortem";
  title: string;
  question: string;
  template: string;
};

const PROMPT_DECK: MentalModelPrompt[] = [
  {
    id: "first-principles-1",
    category: "First Principles",
    title: "Unpack Fundamental Truths",
    question: "What basic truths do you know for a fact here, stripped of all assumptions?",
    template: "\n\n> 🧠 **First Principles Check**\n> 1. What fundamental facts are guaranteed to be true here?\n> 2. What assumptions am I taking for granted?\n",
  },
  {
    id: "inversion-1",
    category: "Inversion",
    title: "Invert the Problem",
    question: "What would guarantee complete failure here? How do you avoid it?",
    template: "\n\n> 🔄 **Inversion Exercise**\n> 1. How could this idea fail completely?\n> 2. What actions guarantee that failure, and how do I prevent them?\n",
  },
  {
    id: "second-order-1",
    category: "Second-Order",
    title: "Second-Order Thinking",
    question: "And then what happens? What are the long-term ripple effects?",
    template: "\n\n> 🌊 **Second-Order Effects**\n> - Immediate outcome (First order):\n> - What happens next? (Second order):\n> - Long-term ripple effects (Third order):\n",
  },
  {
    id: "whys-1",
    category: "5 Whys",
    title: "Root Cause (5 Whys)",
    question: "Why does this matter to you? Unpack 5 layers deeper.",
    template: "\n\n> ❓ **5 Whys Deep Dive**\n> 1. Why does this matter? \n> 2. Why? \n> 3. Why? \n> 4. Why? \n> 5. Core motivation: \n",
  },
  {
    id: "pre-mortem-1",
    category: "Pre-Mortem",
    title: "Pre-Mortem Reflection",
    question: "Imagine 6 months from now this project failed. What was the cause?",
    template: "\n\n> ⏳ **Pre-Mortem Failure Analysis**\n> - The hypothetical cause of failure:\n> - Early warning signs to watch for today:\n",
  },
];

type DeepPromptsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onInsertPrompt: (template: string) => void;
};

export function DeepPromptsModal({
  isOpen,
  onClose,
  onInsertPrompt,
}: DeepPromptsModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  if (!isOpen) return null;

  const categories = ["All", "First Principles", "Inversion", "Second-Order", "5 Whys", "Pre-Mortem"];

  const filteredDeck = selectedCategory === "All"
    ? PROMPT_DECK
    : PROMPT_DECK.filter((p) => p.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
            <Brain className="size-5 text-[var(--accent)]" />
            <span>Deep Thinking & Socratic Prompts</span>
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 py-4 border-b border-[var(--border)]">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedCategory === cat
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--surface-hover)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto py-4">
          {filteredDeck.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
                  {prompt.category}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 gap-1 px-2.5 text-xs"
                  onClick={() => {
                    onInsertPrompt(prompt.template);
                    onClose();
                  }}
                >
                  <Plus className="size-3 text-[var(--accent)]" />
                  <span>Insert Prompt</span>
                </Button>
              </div>

              <h3 className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                {prompt.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {prompt.question}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
