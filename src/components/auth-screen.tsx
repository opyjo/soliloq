"use client";

import { type FormEvent, useState } from "react";
import { ArrowRight, Feather, LockKeyhole, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm your account, then come back here.");
    }
  }

  function switchMode() {
    setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
    setError(null);
    setMessage(null);
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-7xl lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Feather className="size-5" strokeWidth={2.2} />
            </div>
            <span className="text-lg font-semibold tracking-[-0.03em]">Still</span>
          </div>

          <div className="my-20 max-w-2xl lg:my-0">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
              <Sparkles className="size-3.5 text-[var(--accent)]" />
              A private place for unfinished thoughts
            </div>
            <h1 className="max-w-xl text-balance text-5xl font-medium leading-[0.98] tracking-[-0.065em] sm:text-6xl lg:text-7xl">
              Catch the thought before it leaves.
            </h1>
            <p className="mt-7 max-w-lg text-pretty text-lg leading-8 text-[var(--muted-foreground)]">
              Write without organizing. Still quietly saves your words, then
              brings them back when you are ready to continue.
            </p>
          </div>

          <p className="hidden max-w-sm text-sm leading-6 text-[var(--muted)] lg:block">
            “The beginning is the most important part of the work.”
            <span className="ml-2 text-[var(--muted-foreground)]">— Plato</span>
          </p>
        </section>

        <section className="flex items-center border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] px-6 py-12 backdrop-blur-xl sm:px-10 lg:border-l lg:border-t-0 lg:px-16">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                {mode === "sign-in" ? "Welcome back" : "Make some space"}
              </p>
              <h2 className="text-3xl font-medium tracking-[-0.045em]">
                {mode === "sign-in" ? "Return to your thoughts" : "Create your account"}
              </h2>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm text-[var(--muted-foreground)]">
                  Email
                </span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-4 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-[var(--muted-foreground)]">
                  Password
                </span>
                <input
                  required
                  minLength={6}
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  className="h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-4 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
                />
              </label>

              {error ? (
                <p role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </p>
              ) : null}

              {message ? (
                <p className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--muted-foreground)]">
                  {message}
                </p>
              ) : null}

              <Button className="h-12 w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Please wait…"
                  : mode === "sign-in"
                    ? "Open Still"
                    : "Create account"}
                {!isSubmitting ? <ArrowRight className="size-4" /> : null}
              </Button>
            </form>

            <button
              type="button"
              onClick={switchMode}
              className="mt-6 w-full text-center text-sm text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            >
              {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>

            <div className="mt-10 flex items-start gap-3 border-t border-[var(--border)] pt-6 text-xs leading-5 text-[var(--muted)]">
              <LockKeyhole className="mt-0.5 size-4 shrink-0" />
              <p>Your writing is private and protected per account by database-level access rules.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
