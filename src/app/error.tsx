"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  unstable_retry,
}: {
  unstable_retry: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-center text-[var(--foreground)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Still
        </p>
        <h1 className="mt-3 text-2xl font-medium tracking-[-0.04em]">
          Something interrupted the quiet.
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Your local draft is safe. Try opening the app again.
        </p>
        <Button className="mt-6" onClick={unstable_retry}>
          <RotateCcw className="size-4" />
          Try again
        </Button>
      </div>
    </main>
  );
}
