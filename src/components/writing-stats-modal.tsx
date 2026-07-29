"use client";

import { BarChart3, Clock, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WritingStats } from "@/lib/types";

type WritingStatsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string | null;
  body: string;
};

export function WritingStatsModal({
  isOpen,
  onClose,
  title,
  body,
}: WritingStatsModalProps) {
  if (!isOpen) return null;

  const text = `${title ?? ""} ${body}`.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s+/g, "").length;
  const sentences = text ? text.split(/[.!?]+/).filter(Boolean).length : 0;
  const paragraphs = body ? body.split(/\n\s*\n/).filter(Boolean).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  // Simple Flesch Kincaid Grade estimate
  const gradeLevel =
    words > 0 && sentences > 0
      ? (0.39 * (words / sentences) + 11.8 * 4.5 - 15.59).toFixed(1)
      : "0";

  const stats: WritingStats = {
    words,
    characters,
    charactersNoSpaces,
    sentences,
    paragraphs,
    readingTimeMinutes,
    gradeLevel: `${gradeLevel}`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
            <BarChart3 className="size-5 text-[var(--accent)]" />
            <span>Writing Insights</span>
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 py-5">
          <StatBox label="Words" value={stats.words.toLocaleString()} icon={Type} />
          <StatBox
            label="Est. Read Time"
            value={`${stats.readingTimeMinutes} min`}
            icon={Clock}
          />
          <StatBox label="Characters" value={stats.characters.toLocaleString()} />
          <StatBox
            label="Characters (no space)"
            value={stats.charactersNoSpaces.toLocaleString()}
          />
          <StatBox label="Sentences" value={stats.sentences.toLocaleString()} />
          <StatBox label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">Reading Ease: </span>
          Grade Level ~{stats.gradeLevel} (Estimated complexity based on sentence length)
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
        <span>{label}</span>
        {Icon ? <Icon className="size-3.5 text-[var(--accent)]" /> : null}
      </div>
      <div className="mt-1 text-xl font-bold tracking-tight text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}
