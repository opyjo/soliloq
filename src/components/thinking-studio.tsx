"use client";

import {
  Activity,
  BrainCircuit,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Flame,
  GitMerge,
  History,
  LayoutTemplate,
  Lightbulb,
  Link2,
  LoaderCircle,
  Network,
  Plus,
  RefreshCcw,
  Share2,
  Sparkles,
  Tags,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Thought } from "@/lib/database.types";
import {
  buildThoughtGraph,
  extractTags,
  findDuplicatePairs,
  getConnections,
  getThoughtMood,
  getWeeklyReflection,
  getWritingActivity,
  rankForResurfacing,
  THOUGHT_TEMPLATES,
} from "@/lib/thought-intelligence";
import {
  getThoughtVersions,
  type ThoughtVersion,
} from "@/lib/thought-history";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, deriveThoughtTitle, formatRelativeDate } from "@/lib/utils";

type StudioTab =
  | "overview"
  | "graph"
  | "resurface"
  | "timeline"
  | "create"
  | "share";

type ThinkingStudioProps = {
  userId: string;
  thoughts: Thought[];
  activeThought: Thought | null;
  onSelect: (id: string) => void;
  onCreate: (title: string | null, body: string) => void;
  onPatchActive: (patch: Partial<Thought>) => void;
  onMerge: (primaryId: string, duplicateId: string) => void;
  onRestore: (version: ThoughtVersion) => void;
};

const tabs: Array<{
  id: StudioTab;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "overview", label: "Pulse", icon: Activity },
  { id: "graph", label: "Graph", icon: Network },
  { id: "resurface", label: "Resurface", icon: RefreshCcw },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "create", label: "Create", icon: LayoutTemplate },
  { id: "share", label: "Share", icon: Share2 },
];

const moods = [
  { id: "clear", label: "Clear", symbol: "◌" },
  { id: "curious", label: "Curious", symbol: "✦" },
  { id: "energized", label: "Energized", symbol: "↗" },
  { id: "tender", label: "Tender", symbol: "◇" },
  { id: "stuck", label: "Stuck", symbol: "≈" },
];

function titleFor(thought: Thought) {
  return thought.title?.trim() || deriveThoughtTitle(thought.body);
}

export function ThinkingStudio({
  userId,
  thoughts,
  activeThought,
  onSelect,
  onCreate,
  onPatchActive,
  onMerge,
  onRestore,
}: ThinkingStudioProps) {
  const [tab, setTab] = useState<StudioTab>("overview");
  const [quickCapture, setQuickCapture] = useState("");
  const [reflection, setReflection] = useState<string | null>(null);
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shares, setShares] = useState<
    Array<{ id: string; token: string; created_at: string }>
  >([]);

  const graph = useMemo(() => buildThoughtGraph(thoughts), [thoughts]);
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const resurfacing = useMemo(
    () => rankForResurfacing(thoughts).slice(0, 6),
    [thoughts],
  );
  const duplicates = useMemo(() => findDuplicatePairs(thoughts), [thoughts]);
  const connections = useMemo(() => getConnections(thoughts), [thoughts]);
  const activity = useMemo(() => getWritingActivity(thoughts), [thoughts]);
  void historyTick;
  const versions = activeThought
    ? getThoughtVersions(userId, activeThought.id)
    : [];
  const weeklyReflection = useMemo(
    () => getWeeklyReflection(thoughts),
    [thoughts],
  );
  const collections = useMemo(() => {
    const map = new Map<string, number>();
    thoughts.forEach((thought) =>
      extractTags(thought.body)
        .filter((tag) => !tag.startsWith("#mood-"))
        .forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1)),
    );
    return Array.from(map.entries())
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [thoughts]);

  useEffect(() => {
    if (tab !== "share" || !activeThought) return;
    const supabase = getSupabaseBrowserClient();
    void supabase
      .from("thought_shares")
      .select("id,token,created_at")
      .eq("thought_id", activeThought.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setShares(data ?? []));
  }, [activeThought, tab, userId]);

  function captureQuickThought() {
    const body = quickCapture.trim();
    if (!body) return;
    onCreate(null, body);
    setQuickCapture("");
  }

  function setMood(mood: string) {
    if (!activeThought) return;
    const cleanBody = activeThought.body
      .replace(/(?:^|\s)#mood-[\w-]+/g, "")
      .trimEnd();
    onPatchActive({
      body: `${cleanBody}${cleanBody ? "\n\n" : ""}#mood-${mood}`,
    });
  }

  async function generateReflection() {
    setIsReflecting(true);
    setReflectionError(null);
    const context = thoughts
      .filter(
        (thought) =>
          new Date(thought.updated_at).getTime() >
          Date.now() - 7 * 86_400_000,
      )
      .slice(0, 12)
      .map((thought) => `${titleFor(thought)}\n${thought.body.slice(0, 600)}`)
      .join("\n\n---\n\n");
    try {
      const response = await fetch("/api/ai-companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thoughtTitle: "Weekly reflection",
          thoughtBody: context,
          mode: "freeform",
          messages: [
            {
              role: "user",
              content:
                "Write a short weekly reflection: recurring themes, one tension, and one thoughtful next question. Do not use generic encouragement.",
            },
          ],
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok || !data.message) {
        throw new Error(data.error ?? "Reflection could not be generated.");
      }
      setReflection(data.message);
    } catch (error) {
      setReflectionError(
        error instanceof Error
          ? error.message
          : "Reflection could not be generated.",
      );
    } finally {
      setIsReflecting(false);
    }
  }

  async function createShare() {
    if (!activeThought) return;
    setIsSharing(true);
    setShareStatus(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("thought_shares")
      .insert({
        user_id: userId,
        thought_id: activeThought.id,
        title: activeThought.title,
        body: activeThought.body,
        allow_comments: true,
        expires_at: null,
      })
      .select("id,token,created_at")
      .single();
    if (error || !data) {
      setShareStatus(
        "Cloud sharing is not ready yet. Apply the latest Supabase migration, then try again.",
      );
      setIsSharing(false);
      return;
    }
    setShares((current) => [data, ...current]);
    const url = `${window.location.origin}/share/${data.token}`;
    await navigator.clipboard.writeText(url);
    setShareStatus("Private link copied. Only people with the link can open it.");
    setIsSharing(false);
  }

  async function copyShare(token: string) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/share/${token}`,
    );
    setShareStatus("Link copied.");
  }

  async function revokeShare(id: string) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("thought_shares")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      setShareStatus("This link could not be revoked.");
      return;
    }
    setShares((current) => current.filter((share) => share.id !== id));
    setShareStatus("Link revoked.");
  }

  return (
    <section className="studio-shell min-w-0 flex-1 overflow-y-auto bg-[var(--editor)]">
      <header className="studio-hero sticky top-0 z-20 border-b border-[var(--border)] px-5 pb-4 pt-6 backdrop-blur-2xl sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              <Sparkles className="size-3.5" />
              Thinking studio
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">
              See the shape of your mind.
            </h1>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Connections, patterns, history, and gentle ways back in.
            </p>
          </div>
          <div className="studio-tabs flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[11px] font-medium transition",
                    tab === item.id
                      ? "bg-[var(--surface-selected)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:px-10 lg:py-9">
        {tab === "overview" ? (
          <div className="studio-grid grid gap-4 lg:grid-cols-12">
            <StudioCard className="lg:col-span-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardEyebrow icon={BrainCircuit}>Weekly reflection</CardEyebrow>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--writing)]">
                    {reflection ?? weeklyReflection}
                  </p>
                  {reflectionError ? (
                    <p role="alert" className="mt-3 text-xs text-[var(--danger)]">
                      {reflectionError}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void generateReflection()}
                  disabled={isReflecting}
                  className="shrink-0"
                >
                  {isReflecting ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <WandSparkles className="size-3.5" />
                  )}
                  AI reflect
                </Button>
              </div>
            </StudioCard>

            <StudioCard className="lg:col-span-4">
              <CardEyebrow icon={Flame}>Writing rhythm</CardEyebrow>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-semibold tracking-[-0.06em]">
                  {activity.streak}
                </span>
                <span className="pb-1 text-xs text-[var(--muted)]">
                  day streak
                </span>
              </div>
              <div className="mt-5 grid grid-cols-12 gap-1">
                {activity.activity.map((day) => (
                  <span
                    key={day.date}
                    title={`${day.date}: ${day.count} updates`}
                    className={cn(
                      "aspect-square rounded-[3px] border border-[var(--border)]",
                      day.count === 0 && "bg-[var(--surface)]",
                      day.count === 1 &&
                        "bg-[color-mix(in_srgb,var(--accent)_28%,transparent)]",
                      day.count === 2 &&
                        "bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]",
                      day.count >= 3 && "bg-[var(--accent)]",
                    )}
                  />
                ))}
              </div>
            </StudioCard>

            <StudioCard className="lg:col-span-7">
              <CardEyebrow icon={Tags}>Living collections</CardEyebrow>
              <div className="mt-4 flex flex-wrap gap-2">
                {collections.length > 0 ? (
                  collections.map(([tag, count]) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const match = thoughts.find((thought) =>
                          extractTags(thought.body).includes(tag),
                        );
                        if (match) onSelect(match.id);
                      }}
                      className="studio-tag"
                    >
                      {tag}
                      <span>{count}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    Add #tags while writing and they will grow into collections here.
                  </p>
                )}
              </div>
            </StudioCard>

            <StudioCard className="lg:col-span-5">
              <CardEyebrow icon={Sparkles}>Mood marker</CardEyebrow>
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                Mark the emotional weather around the active thought.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {moods.map((mood) => (
                  <button
                    key={mood.id}
                    type="button"
                    disabled={!activeThought}
                    onClick={() => setMood(mood.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs transition",
                      activeThought &&
                      getThoughtMood(activeThought) === mood.id
                        ? "border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:-translate-y-0.5 hover:text-[var(--foreground)]",
                    )}
                  >
                    <span className="mr-1.5">{mood.symbol}</span>
                    {mood.label}
                  </button>
                ))}
              </div>
            </StudioCard>
          </div>
        ) : null}

        {tab === "graph" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <StudioCard className="min-h-[34rem] overflow-hidden p-0">
              {graph.nodes.length > 0 ? (
                <svg
                  viewBox="0 0 800 520"
                  className="thought-graph h-full min-h-[34rem] w-full"
                  role="img"
                  aria-label={`Map of ${graph.nodes.length} thoughts and ${graph.edges.length} connections`}
                >
                  <defs>
                    <radialGradient id="nodeGlow">
                      <stop offset="0" stopColor="var(--accent)" stopOpacity=".92" />
                      <stop offset="1" stopColor="var(--accent)" stopOpacity=".28" />
                    </radialGradient>
                  </defs>
                  {graph.edges.map((edge, index) => {
                    const source = nodeById.get(edge.sourceId);
                    const target = nodeById.get(edge.targetId);
                    if (!source || !target) return null;
                    return (
                      <line
                        key={`${edge.sourceId}-${edge.targetId}`}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        className="graph-edge"
                        style={{ animationDelay: `${index * 30}ms` }}
                        strokeWidth={Math.max(0.7, edge.strength * 2)}
                      />
                    );
                  })}
                  {graph.nodes.map((node, index) => (
                    <g
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${node.title}`}
                      onClick={() => onSelect(node.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(node.id);
                        }
                      }}
                      className="graph-node cursor-pointer outline-none"
                      style={{ animationDelay: `${index * 35}ms` }}
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.size + 8}
                        fill="transparent"
                      />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.size}
                        fill="url(#nodeGlow)"
                        opacity={
                          activeThought?.id === node.id ? 1 : 0.72
                        }
                      />
                      <text
                        x={node.x}
                        y={node.y + node.size + 16}
                        textAnchor="middle"
                        className="graph-label"
                      >
                        {node.title.slice(0, 24)}
                      </text>
                    </g>
                  ))}
                </svg>
              ) : (
                <EmptyStudioState
                  icon={Network}
                  title="Your constellation starts with two thoughts"
                  description="Write naturally; Still links wiki references, shared tags, and related meaning."
                />
              )}
            </StudioCard>
            <StudioCard>
              <CardEyebrow icon={Link2}>Connection suggestions</CardEyebrow>
              <div className="mt-4 space-y-3">
                {connections.slice(0, 8).map((connection) => {
                  const source = thoughts.find(
                    (thought) => thought.id === connection.sourceId,
                  );
                  const target = thoughts.find(
                    (thought) => thought.id === connection.targetId,
                  );
                  if (!source || !target) return null;
                  return (
                    <button
                      key={`${connection.sourceId}-${connection.targetId}`}
                      type="button"
                      onClick={() => onSelect(target.id)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
                    >
                      <p className="line-clamp-1 text-xs font-medium">
                        {titleFor(source)}
                      </p>
                      <p className="my-1 text-[9px] uppercase tracking-wider text-[var(--accent)]">
                        {connection.reason}
                      </p>
                      <p className="line-clamp-1 text-xs text-[var(--muted)]">
                        {titleFor(target)}
                      </p>
                    </button>
                  );
                })}
                {connections.length === 0 ? (
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    Use [[wiki links]] or recurring #tags to make connections visible.
                  </p>
                ) : null}
              </div>
            </StudioCard>
          </div>
        ) : null}

        {tab === "resurface" ? (
          <div>
            <div className="mb-5 max-w-xl">
              <CardEyebrow icon={RefreshCcw}>Smart resurfacing</CardEyebrow>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Ranked by age, open questions, review dates, and how much room a thought still has to grow.
              </p>
            </div>
            <div className="resurface-stack grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {resurfacing.map(({ thought, reason }, index) => (
                <button
                  key={thought.id}
                  type="button"
                  onClick={() => onSelect(thought.id)}
                  className="resurface-card min-h-56 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,.14)] transition hover:-translate-y-1 hover:border-[var(--border-strong)]"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                    {reason}
                  </span>
                  <h2 className="mt-5 text-lg font-medium tracking-[-0.035em]">
                    {titleFor(thought)}
                  </h2>
                  <p className="mt-3 line-clamp-5 text-xs leading-5 text-[var(--muted)]">
                    {thought.body || "An empty thought waiting for a first return."}
                  </p>
                  <div className="mt-5 flex items-center justify-between text-[10px] text-[var(--muted)]">
                    <span>{thought.status}</span>
                    <span>{formatRelativeDate(thought.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "timeline" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <StudioCard>
              <CardEyebrow icon={Clock3}>Thought timeline</CardEyebrow>
              <div className="timeline-line mt-6 space-y-1">
                {thoughts
                  .toSorted((a, b) =>
                    b.updated_at.localeCompare(a.updated_at),
                  )
                  .slice(0, 40)
                  .map((thought, index) => (
                    <button
                      key={thought.id}
                      type="button"
                      onClick={() => onSelect(thought.id)}
                      className="timeline-item group relative flex w-full gap-4 rounded-xl px-2 py-3 text-left transition hover:bg-[var(--surface-hover)]"
                      style={{ animationDelay: `${index * 25}ms` }}
                    >
                      <span className="relative z-10 mt-1.5 size-2 shrink-0 rounded-full bg-[var(--accent)] ring-4 ring-[var(--popover)]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {titleFor(thought)}
                        </span>
                        <span className="mt-1 block text-[10px] text-[var(--muted)]">
                          {new Date(thought.updated_at).toLocaleDateString(
                            undefined,
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            </StudioCard>

            <div className="space-y-4">
              <StudioCard>
                <div className="flex items-center justify-between gap-3">
                  <CardEyebrow icon={History}>Version history</CardEyebrow>
                  <button
                    type="button"
                    onClick={() => setHistoryTick((tick) => tick + 1)}
                    className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    Refresh
                  </button>
                </div>
                <p className="mt-2 line-clamp-1 text-xs text-[var(--muted)]">
                  {activeThought
                    ? titleFor(activeThought)
                    : "Select a thought to see its history"}
                </p>
                <div className="mt-4 space-y-2">
                  {versions.slice(0, 8).map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => onRestore(version)}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-[10px] transition hover:border-[var(--border-strong)]"
                    >
                      <span>
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                      <span className="text-[var(--accent)]">Restore</span>
                    </button>
                  ))}
                  {versions.length === 0 ? (
                    <p className="text-xs leading-5 text-[var(--muted)]">
                      Still keeps spaced snapshots as you write. Earlier versions will appear here.
                    </p>
                  ) : null}
                </div>
              </StudioCard>

              <StudioCard>
                <CardEyebrow icon={GitMerge}>Possible duplicates</CardEyebrow>
                <div className="mt-4 space-y-3">
                  {duplicates.slice(0, 4).map(({ first, second, score }) => (
                    <div
                      key={`${first.id}-${second.id}`}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                    >
                      <p className="line-clamp-1 text-xs">{titleFor(first)}</p>
                      <p className="my-1 text-[9px] text-[var(--accent)]">
                        {Math.round(score * 100)}% related
                      </p>
                      <p className="line-clamp-1 text-xs text-[var(--muted)]">
                        {titleFor(second)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onMerge(first.id, second.id)}
                        className="mt-2 text-[10px] font-medium text-[var(--accent)]"
                      >
                        Merge into first
                      </button>
                    </div>
                  ))}
                  {duplicates.length === 0 ? (
                    <p className="text-xs leading-5 text-[var(--muted)]">
                      No strong duplicates found. Your garden is nicely distinct.
                    </p>
                  ) : null}
                </div>
              </StudioCard>
            </div>
          </div>
        ) : null}

        {tab === "create" ? (
          <div>
            <StudioCard className="mb-5">
              <CardEyebrow icon={Lightbulb}>Quick capture</CardEyebrow>
              <div className="mt-4 flex gap-2">
                <input
                  value={quickCapture}
                  onChange={(event) => setQuickCapture(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") captureQuickThought();
                  }}
                  placeholder="Catch the thought before it disappears…"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--input)] px-4 text-sm outline-none transition focus:border-[var(--border-strong)]"
                />
                <Button onClick={captureQuickThought} className="h-12 px-5">
                  <Plus className="size-4" />
                  Capture
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-[var(--muted)]">
                Works offline and syncs automatically when your connection returns.
              </p>
            </StudioCard>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {THOUGHT_TEMPLATES.map((template, index) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onCreate(template.title, template.body)}
                  className="template-card rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:-translate-y-1 hover:border-[var(--border-strong)]"
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <span className="grid size-10 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] text-[var(--accent)]">
                    <LayoutTemplate className="size-4" />
                  </span>
                  <h2 className="mt-5 font-medium tracking-[-0.025em]">
                    {template.name}
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "share" ? (
          <div className="mx-auto max-w-2xl">
            <StudioCard>
              <CardEyebrow icon={Share2}>Private sharing & collaboration</CardEyebrow>
              <h2 className="mt-4 text-xl font-medium tracking-[-0.035em]">
                {activeThought
                  ? titleFor(activeThought)
                  : "Choose a thought first"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Create a revocable snapshot link. Readers can leave a name and a thoughtful comment without seeing anything else in your account.
              </p>
              <Button
                onClick={() => void createShare()}
                disabled={!activeThought || isSharing}
                className="mt-5"
              >
                {isSharing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                Create private link
              </Button>
              {shareStatus ? (
                <p
                  role="status"
                  className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]"
                >
                  {shareStatus}
                </p>
              ) : null}
              <div className="mt-6 space-y-2 border-t border-[var(--border)] pt-5">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[10px] text-[var(--muted-foreground)]">
                        …/{share.token.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-[9px] text-[var(--muted)]">
                        Created {formatRelativeDate(share.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => void copyShare(share.token)}
                        aria-label="Copy share link"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] text-[var(--danger)]"
                        onClick={() => void revokeShare(share.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
                {shares.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] p-4 text-xs text-[var(--muted)]">
                    <Check className="size-4 text-[var(--accent)]" />
                    No active links for this thought.
                  </div>
                ) : null}
              </div>
            </StudioCard>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StudioCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "studio-card rounded-3xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--popover)_88%,transparent)] p-5 shadow-[0_24px_70px_rgba(0,0,0,.12)] sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardEyebrow({
  icon: Icon,
  children,
}: {
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
      <Icon className="size-3.5" />
      {children}
    </div>
  );
}

function EmptyStudioState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-[34rem] place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
          <Icon className="size-5 text-[var(--accent)]" />
        </span>
        <h2 className="mt-5 text-lg font-medium">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[var(--muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}
