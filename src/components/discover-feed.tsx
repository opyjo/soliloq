"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Compass,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DiscoverItem } from "@/app/api/discover/route";

type DiscoverFeedProps = {
  onCaptureItem: (title: string, url: string, description: string) => void;
};

export function DiscoverFeed({ onCaptureItem }: DiscoverFeedProps) {
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSource, setActiveSource] = useState<"All" | "Hacker News" | "GitHub Trending">("All");

  const fetchFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/discover");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load discovery feed", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/discover")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (isMounted) {
          setItems(data.items || []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredItems = items.filter((item) => {
    if (activeSource === "All") return true;
    return item.source === activeSource;
  });

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--editor)]">
      <header className="flex h-16 items-center justify-between border-b border-[var(--border)] px-6 lg:h-18 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
            <Compass className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Discover & Build Radar</h1>
            <p className="text-xs text-[var(--muted)]">Cool projects, open source, & maker creations</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchFeed}
            disabled={isLoading}
            title="Refresh feed"
            aria-label="Refresh feed"
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin text-[var(--accent)]" : ""}`} />
          </Button>
        </div>
      </header>

      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium">
          {(["All", "Hacker News", "GitHub Trending"] as const).map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setActiveSource(source)}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeSource === source
                  ? "bg-[var(--surface-hover)] font-semibold text-[var(--accent)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
        {isLoading ? (
          <div className="grid min-h-64 place-items-center text-center">
            <div>
              <Sparkles className="mx-auto size-6 animate-pulse text-[var(--accent)]" />
              <p className="mt-3 text-sm text-[var(--muted)]">Scanning the web for interesting builds…</p>
            </div>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="group flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-1 hover:border-[var(--border-strong)] hover:shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">
                      {item.source}
                    </span>
                    {item.score ? (
                      <span className="flex items-center gap-1 text-[11px] font-mono text-[var(--muted-foreground)]">
                        <Star className="size-3 text-[var(--accent)] fill-current" />
                        {item.score.toLocaleString()}
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-3 text-base font-semibold leading-snug tracking-tight text-[var(--foreground)] group-hover:text-[var(--accent)]">
                    {item.title}
                  </h2>

                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {item.description}
                  </p>

                  {item.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-hover)] px-2 py-0.5 text-[10px] text-[var(--muted)]"
                        >
                          <Tag className="size-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <span>Visit site</span>
                    <ExternalLink className="size-3" />
                  </a>

                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 px-2.5 text-xs"
                    onClick={() => onCaptureItem(item.title, item.url, item.description)}
                  >
                    <Plus className="size-3.5 text-[var(--accent)]" />
                    <span>Capture to Thought</span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center text-center">
            <p className="text-sm text-[var(--muted)]">No items found for this filter.</p>
          </div>
        )}
      </div>
    </section>
  );
}
