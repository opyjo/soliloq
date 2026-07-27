"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finishSignIn() {
      const code = new URLSearchParams(window.location.search).get("code");

      if (!code) {
        setError("The sign-in link is incomplete. Please request a new one.");
        return;
      }

      const { error: exchangeError } = await getSupabaseBrowserClient().auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        window.location.replace("/");
    }

    void finishSignIn();
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] px-6 text-center text-[var(--foreground)]">
      {error ? (
        <div>
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <Link
            className="mt-5 inline-block text-sm text-[var(--accent)] hover:underline"
            href="/"
          >
            Return to sign in
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="size-4 animate-spin" />
          Finishing sign in…
        </div>
      )}
    </main>
  );
}
