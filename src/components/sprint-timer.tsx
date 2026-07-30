"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, Play, Square, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialogAccessibility } from "@/lib/use-dialog-accessibility";

type SprintTimerProps = {
  isOpen: boolean;
  onClose: () => void;
  currentWordCount: number;
};

export function SprintTimerModal({
  isOpen,
  onClose,
  currentWordCount,
}: SprintTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [startingWords, setStartingWords] = useState(0);

  const timerRef = useRef<number | null>(null);
  const dialogRef = useDialogAccessibility<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  function startSprint(minutes: number) {
    setSecondsLeft(minutes * 60);
    setStartingWords(currentWordCount);
    setIsActive(true);

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerRef.current!);
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopSprint() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setIsActive(false);
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  const wordsTypedInSprint = Math.max(0, currentWordCount - startingWords);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sprint-timer-title"
        tabIndex={-1}
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-6 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div
            id="sprint-timer-title"
            className="flex items-center gap-2 font-semibold text-[var(--foreground)]"
          >
            <Timer className="size-5 text-[var(--accent)]" />
            <span>Monk Mode Sprint</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onClose}
            aria-label="Close sprint timer"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="py-6 text-center">
          <div className="text-4xl font-bold font-mono tracking-tight text-[var(--foreground)]">
            {formatTime(secondsLeft)}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {isActive ? "Deep focus session in progress" : "Select session duration"}
          </p>

          {isActive ? (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 text-xs text-[var(--accent)]">
              <Zap className="size-4" />
              <span>
                <strong>{wordsTypedInSprint}</strong> words written this sprint
              </span>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          {!isActive ? (
            <div className="grid grid-cols-3 gap-2">
              {[15, 25, 45].map((mins) => (
                <Button
                  key={mins}
                  variant="secondary"
                  onClick={() => startSprint(mins)}
                  className="h-10 text-xs font-medium"
                >
                  <Play className="mr-1 size-3 text-[var(--accent)]" />
                  {mins} min
                </Button>
              ))}
            </div>
          ) : (
            <Button
              variant="danger"
              onClick={stopSprint}
              className="w-full h-10 text-xs font-medium"
            >
              <Square className="mr-1 size-3 fill-current" />
              End Sprint
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
