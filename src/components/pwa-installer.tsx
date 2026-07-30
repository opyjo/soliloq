"use client";

import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const [isStandalone] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });

  const [showIOSPrompt, setShowIOSPrompt] = useState(() => {
    if (typeof window === "undefined" || isStandalone) return false;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    if (!isIOS) return false;
    return !window.localStorage.getItem("still_pwa_ios_dismissed");
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) =>
                registration.active?.scriptURL.endsWith("/sw.js"),
              )
              .map((registration) => registration.unregister()),
          ),
        );
      }
      if ("caches" in window) {
        void caches.keys().then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("still-app-"))
              .map((key) => caches.delete(key)),
          ),
        );
      }
      return;
    }

    // Register Service Worker
    const registerServiceWorker = () => {
      void navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("ServiceWorker registration failed:", err);
      });
    };

    if ("serviceWorker" in navigator) {
      if (document.readyState === "complete") {
        registerServiceWorker();
      } else {
        window.addEventListener("load", registerServiceWorker);
      }
    }

    // Capture Android/Chrome Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("load", registerServiceWorker);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  function dismissIOSPrompt() {
    setShowIOSPrompt(false);
    window.localStorage.setItem("still_pwa_ios_dismissed", "true");
  }

  if (isStandalone) return null;

  return (
    <>
      {/* Android / Desktop Install Toast */}
      {deferredPrompt ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--popover)] p-3.5 shadow-2xl backdrop-blur-xl">
          <div className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
            <Smartphone className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[var(--foreground)]">Install Still App</h4>
            <p className="text-[10px] text-[var(--muted-foreground)]">Add to Home Screen for fast offline writing</p>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <Button size="sm" onClick={handleInstallClick} className="h-8 gap-1 px-3 text-xs">
              <Download className="size-3.5" />
              Install
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setDeferredPrompt(null)}
              aria-label="Close install banner"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* iOS Safari Guidance Modal */}
      {showIOSPrompt ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex w-[90%] max-w-sm flex-col gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--popover)] p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold text-[var(--foreground)]">Add Still to Home Screen</span>
            </div>
            <Button variant="ghost" size="icon" className="size-7" onClick={dismissIOSPrompt}>
              <X className="size-3.5" />
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            To install on iPhone or iPad:
          </p>
          <ol className="text-[11px] leading-relaxed text-[var(--foreground)] list-decimal pl-4 space-y-1">
            <li>
              Tap the <Share className="inline size-3.5 text-[var(--accent)]" /> <strong>Share</strong> button in Safari toolbar.
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
          </ol>
        </div>
      ) : null}
    </>
  );
}
