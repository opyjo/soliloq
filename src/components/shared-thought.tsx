"use client";

import { Check, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ShareCommentRow } from "@/lib/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SharedThoughtProps = {
  shareToken: string;
  title: string | null;
  body: string;
  allowComments: boolean;
  initialComments: ShareCommentRow[];
};

export function SharedThought({
  shareToken,
  title,
  body,
  allowComments,
  initialComments,
}: SharedThoughtProps) {
  const [comments, setComments] = useState(initialComments);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = name.trim();
    const bodyText = comment.trim();
    if (!displayName || !bodyText) return;
    setIsSending(true);
    setStatus(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("add_share_comment", {
      p_share_token: shareToken,
      p_display_name: displayName.slice(0, 60),
      p_body: bodyText.slice(0, 1000),
    });
    const created = data?.[0];
    if (error || !created) {
      setStatus("Your comment could not be sent. Please try again.");
    } else {
      setComments((current) => [...current, created]);
      setComment("");
      setStatus("Comment added.");
    }
    setIsSending(false);
  }

  return (
    <main className="shared-page relative min-h-dvh overflow-hidden bg-[var(--background)] px-5 py-12 text-[var(--foreground)] sm:px-8 lg:py-20">
      <div className="still-ambient still-ambient-one" aria-hidden="true" />
      <div className="still-ambient still-ambient-two" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-[var(--muted)]">
          <span>Shared from Still</span>
          <span className="inline-flex items-center gap-1.5 text-[var(--accent)]">
            <Check className="size-3" />
            Private snapshot
          </span>
        </div>
        <article className="rounded-[2rem] border border-[var(--border)] bg-[color-mix(in_srgb,var(--popover)_90%,transparent)] p-6 shadow-[0_30px_100px_rgba(0,0,0,.25)] sm:p-10 lg:p-14">
          <h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            {title?.trim() || "Untitled thought"}
          </h1>
          <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-[var(--writing)] sm:text-base sm:leading-8">
            {body || "This thought is intentionally empty."}
          </div>
        </article>

        {allowComments ? (
          <section className="mt-8 rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold">Conversation</h2>
              <span className="text-xs text-[var(--muted)]">
                {comments.length}
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {comments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium">
                      {item.display_name}
                    </span>
                    <time className="text-[9px] text-[var(--muted)]">
                      {new Date(item.created_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[var(--muted-foreground)]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
            <form onSubmit={submitComment} className="mt-5 space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                required
                placeholder="Your name"
                aria-label="Your name"
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 text-xs outline-none focus:border-[var(--border-strong)]"
              />
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={1000}
                required
                placeholder="Leave a thoughtful comment…"
                aria-label="Comment"
                className="min-h-28 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--input)] p-3 text-xs leading-5 outline-none focus:border-[var(--border-strong)]"
              />
              <div className="flex items-center justify-between gap-4">
                <p role="status" className="text-[10px] text-[var(--muted)]">
                  {status}
                </p>
                <Button type="submit" disabled={isSending}>
                  {isSending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send
                </Button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}
