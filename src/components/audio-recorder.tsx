"use client";

import { useEffect, useRef, useState } from "react";
import { Cloud, Mic, Square, Trash2, Play, Pause, Volume2 } from "lucide-react";
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
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const audioPlayersRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    const audioPlayers = audioPlayersRef.current;
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioPlayers.forEach((audio) => audio.pause());
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      durationRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        if (audioBlob.size > 0) {
          onAddAttachment({
            id: crypto.randomUUID(),
            url: URL.createObjectURL(audioBlob),
            blob: audioBlob,
            durationSeconds: Math.max(1, durationRef.current),
            createdAt: new Date().toISOString(),
          });
        }
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
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
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
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

    void audio.play().then(
      () => setPlayingId(attachment.id),
      () => setPlayingId(null),
    );
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
                  aria-label={
                    playingId === item.id
                      ? "Pause voice memo"
                      : "Play voice memo"
                  }
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
                {item.synced ? (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] text-[var(--accent)]"
                    title="Available across your signed-in devices"
                  >
                    <Cloud className="size-3" />
                    Synced
                  </span>
                ) : null}
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
                onClick={() => onRemoveAttachment(item.id)}
                aria-label="Delete voice memo"
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
