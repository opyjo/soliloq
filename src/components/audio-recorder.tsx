"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AudioAttachment } from "@/lib/types";

type AudioRecorderProps = {
  attachments: AudioAttachment[];
  onAddAttachment: (attachment: AudioAttachment) => void;
  onRemoveAttachment: (id: string) => void;
};

export function AudioRecorder({
  attachments,
  onAddAttachment,
  onRemoveAttachment,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayersRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Url = reader.result as string;
          const newAttachment: AudioAttachment = {
            id: `audio-${Date.now()}`,
            url: base64Url,
            durationSeconds: recordingSeconds,
            createdAt: new Date().toISOString(),
          };
          onAddAttachment(newAttachment);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access failed", err);
      window.alert("Microphone permission was denied or unavailable.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  }

  function togglePlay(attachment: AudioAttachment) {
    if (playingId === attachment.id) {
      audioPlayersRef.current.get(attachment.id)?.pause();
      setPlayingId(null);
      return;
    }

    if (playingId) {
      audioPlayersRef.current.get(playingId)?.pause();
    }

    let audio = audioPlayersRef.current.get(attachment.id);
    if (!audio) {
      audio = new Audio(attachment.url);
      audio.onended = () => setPlayingId(null);
      audioPlayersRef.current.set(attachment.id, audio);
    }

    audio.play();
    setPlayingId(attachment.id);
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--foreground)]">
          <Volume2 className="size-4 text-[var(--accent)]" />
          <span>Voice Memos ({attachments.length})</span>
        </div>

        {isRecording ? (
          <Button
            size="sm"
            variant="danger"
            onClick={stopRecording}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Square className="size-3 fill-current" />
            <span>Stop ({formatTime(recordingSeconds)})</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={startRecording}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Mic className="size-3.5 text-[var(--accent)]" />
            <span>Record Voice Note</span>
          </Button>
        )}
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2 pt-1">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--popover)] px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => togglePlay(item)}
                >
                  {playingId === item.id ? (
                    <Pause className="size-3.5 text-[var(--accent)]" />
                  ) : (
                    <Play className="size-3.5 fill-current" />
                  )}
                </Button>
                <span className="font-mono text-[var(--muted-foreground)]">
                  {formatTime(item.durationSeconds || 0)}
                </span>
                <span className="text-[var(--muted)]">
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                onClick={() => onRemoveAttachment(item.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
