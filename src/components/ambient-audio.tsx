"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SoundscapeType = "brown" | "pink" | "alpha-binaural" | "gamma-binaural";

export function AmbientAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundType, setSoundType] = useState<SoundscapeType>("brown");
  const [volume, setVolume] = useState(0.2);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  function stopAudio() {
    if (sourceNodeRef.current) {
      try {
        const src = sourceNodeRef.current as AudioBufferSourceNode | OscillatorNode;
        src.stop();
        src.disconnect();
      } catch {}
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
  }

  function startAudio(type: SoundscapeType, vol: number) {
    stopAudio();

    const windowAudio = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtx = windowAudio.AudioContext || windowAudio.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
    gainNode.connect(ctx.destination);
    gainNodeRef.current = gainNode;

    const bufferSize = 2 * ctx.sampleRate;

    if (type === "brown" || type === "pink") {
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === "brown") {
          data[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
        } else {
          data[i] = white * 0.1;
        }
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;
      noiseSource.connect(gainNode);
      noiseSource.start();
      sourceNodeRef.current = noiseSource;
    } else {
      const beatFreq = type === "alpha-binaural" ? 10 : 40;
      const baseFreq = 200;

      const merger = ctx.createChannelMerger(2);

      const oscLeft = ctx.createOscillator();
      oscLeft.frequency.value = baseFreq;

      const oscRight = ctx.createOscillator();
      oscRight.frequency.value = baseFreq + beatFreq;

      oscLeft.connect(merger, 0, 0);
      oscRight.connect(merger, 0, 1);
      merger.connect(gainNode);

      oscLeft.start();
      oscRight.start();
      sourceNodeRef.current = oscLeft;
    }

    setIsPlaying(true);
  }

  function togglePlay() {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio(soundType, volume);
    }
  }

  function handleTypeChange(newType: SoundscapeType) {
    setSoundType(newType);
    if (isPlaying) {
      startAudio(newType, volume);
    }
  }

  function handleVolumeChange(newVol: number) {
    setVolume(newVol);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(newVol, audioCtxRef.current.currentTime);
    }
  }

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs">
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={togglePlay}
        title={isPlaying ? "Pause ambient focus sound" : "Play ambient focus sound"}
      >
        {isPlaying ? (
          <Pause className="size-3.5 text-[var(--accent)]" />
        ) : (
          <Play className="size-3.5 fill-current" />
        )}
      </Button>

      <select
        value={soundType}
        onChange={(e) => handleTypeChange(e.target.value as SoundscapeType)}
        className="h-7 cursor-pointer rounded-md bg-transparent text-xs font-medium text-[var(--foreground)] outline-none"
      >
        <option value="brown">Deep Brown Noise</option>
        <option value="pink">Pink Rain Noise</option>
        <option value="alpha-binaural">10Hz Alpha Waves</option>
        <option value="gamma-binaural">40Hz Gamma Focus</option>
      </select>

      <div className="flex items-center gap-1.5 border-l border-[var(--border)] pl-2">
        <Volume2 className="size-3.5 text-[var(--muted)]" />
        <input
          type="range"
          min="0"
          max="0.5"
          step="0.02"
          value={volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="h-1 w-16 cursor-pointer accent-[var(--accent)]"
        />
      </div>
    </div>
  );
}
