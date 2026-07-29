"use client";

import { useState } from "react";
import { Lock, Unlock, ShieldAlert, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type PasscodeLockProps = {
  isLocked: boolean;
  hashedPin: string | null;
  onUnlock: () => void;
  onSetPin: (pin: string) => void;
  onRemovePin: () => void;
};

export function PasscodeLock({
  isLocked,
  hashedPin,
  onUnlock,
}: PasscodeLockProps) {
  const [pinInput, setPinInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hashedPin) return;

    const inputHash = await hashPin(pinInput);
    if (inputHash === hashedPin) {
      setErrorMsg("");
      setPinInput("");
      onUnlock();
    } else {
      setErrorMsg("Incorrect PIN. Try again.");
      setPinInput("");
    }
  }

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)] p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]">
            <Lock className="size-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Still is Locked
          </h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Enter your passcode to unlock your thoughts
          </p>

          <form onSubmit={handleUnlockSubmit} className="mt-6 space-y-4">
            <input
              type="password"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              autoFocus
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-2xl tracking-[0.5em] text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
            {errorMsg ? (
              <div className="flex items-center justify-center gap-1 text-xs text-[var(--danger)]">
                <ShieldAlert className="size-3.5" />
                <span>{errorMsg}</span>
              </div>
            ) : null}
            <Button type="submit" className="w-full h-11 rounded-xl font-medium">
              Unlock
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}

export function PasscodeSettingsModal({
  isOpen,
  onClose,
  hashedPin,
  onSetPin,
  onRemovePin,
}: {
  isOpen: boolean;
  onClose: () => void;
  hashedPin: string | null;
  onSetPin: (pin: string) => void;
  onRemovePin: () => void;
}) {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  async function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) {
      setErrorMsg("PIN must be at least 4 digits.");
      return;
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashed = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    onSetPin(hashed);
    setPin("");
    setErrorMsg("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--popover)] p-6 shadow-2xl">
        <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
          <KeyRound className="size-5 text-[var(--accent)]" />
          <span>Passcode Lock Settings</span>
        </div>

        {hashedPin ? (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Passcode lock is enabled on this device.
            </p>
            <Button
              variant="danger"
              className="w-full rounded-xl"
              onClick={() => {
                onRemovePin();
                onClose();
              }}
            >
              <Unlock className="mr-2 size-4" /> Remove Passcode Lock
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSavePin} className="mt-4 space-y-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              Set a 4+ digit PIN to lock Still on demand or after inactivity.
            </p>
            <input
              type="password"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter new 4-digit PIN"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-xl tracking-[0.4em] outline-none"
            />
            {errorMsg ? (
              <div className="text-xs text-[var(--danger)]">{errorMsg}</div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Enable Lock</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
