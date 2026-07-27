"use client";

import {
  Archive,
  BookOpenText,
  Clock3,
  Feather,
  Inbox,
  LoaderCircle,
  LogOut,
  Pin,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AuthScreen } from "@/components/auth-screen";
import { ThoughtEditor } from "@/components/thought-editor";
import { ThoughtList } from "@/components/thought-list";
import { Button } from "@/components/ui/button";
import type { Thought } from "@/lib/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type View = "all" | "inbox" | "developing" | "pinned" | "review" | "archived";
type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const viewDetails: Record<View, { title: string; description: string }> = {
  all: { title: "Your thoughts", description: "Everything still in motion" },
  inbox: { title: "Inbox", description: "New and unshaped" },
  developing: { title: "Developing", description: "Thoughts worth returning to" },
  pinned: { title: "Pinned", description: "Kept close at hand" },
  review: { title: "For today", description: "Ready to be seen again" },
  archived: { title: "Archive", description: "Quietly kept, out of the way" },
};

const navigation = [
  { view: "all" as const, label: "Thoughts", icon: BookOpenText },
  { view: "inbox" as const, label: "Inbox", icon: Inbox },
  { view: "developing" as const, label: "Developing", icon: Sparkles },
  { view: "pinned" as const, label: "Pinned", icon: Pin },
  { view: "review" as const, label: "For today", icon: Clock3 },
  { view: "archived" as const, label: "Archive", icon: Archive },
];

function pendingStorageKey(userId: string) {
  return `still:pending:${userId}`;
}

function isThought(value: unknown): value is Thought {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Thought>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.user_id === "string" &&
    typeof candidate.body === "string"
  );
}

export function ThoughtApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [showMobileEditor, setShowMobileEditor] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pendingThought, setPendingThought] = useState<Thought | null>(null);
  const [reviewClock] = useState(() => Date.now());
  const pendingRef = useRef<Thought | null>(null);
  const persistedIdsRef = useRef(new Set<string>());

  const loadThoughts = useCallback(async (currentUser: User) => {
    setIsDataLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("thoughts")
      .select(
        "id,user_id,title,body,status,is_pinned,review_at,created_at,updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) {
      setSaveState("error");
      setIsDataLoading(false);
      return;
    }

    const remoteThoughts = data ?? [];
    persistedIdsRef.current = new Set(remoteThoughts.map((thought) => thought.id));

    let recoveredThought: Thought | null = null;
    const rawPending = window.localStorage.getItem(
      pendingStorageKey(currentUser.id),
    );

    if (rawPending) {
      try {
        const parsed: unknown = JSON.parse(rawPending);
        if (isThought(parsed) && parsed.user_id === currentUser.id) {
          recoveredThought = parsed;
        }
      } catch {
        window.localStorage.removeItem(pendingStorageKey(currentUser.id));
      }
    }

    const mergedThoughts = recoveredThought
      ? [
          recoveredThought,
          ...remoteThoughts.filter((thought) => thought.id !== recoveredThought?.id),
        ]
      : remoteThoughts;

    setThoughts(mergedThoughts);
    setActiveId(mergedThoughts[0]?.id ?? null);

    if (recoveredThought) {
      pendingRef.current = recoveredThought;
      setPendingThought(recoveredThought);
      setSaveState(navigator.onLine ? "saving" : "offline");
    }

    setIsDataLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setIsAuthLoading(false);
      if (data.user) void loadThoughts(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAuthLoading(false);

      if (event === "SIGNED_IN" && currentUser) {
        void loadThoughts(currentUser);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadThoughts]);

  useEffect(() => {
    if (!pendingThought || !user) return;

    const isPersisted = persistedIdsRef.current.has(pendingThought.id);
    if (
      !isPersisted &&
      !pendingThought.title?.trim() &&
      !pendingThought.body.trim()
    ) {
      return;
    }

    const snapshot = pendingThought;
    const timeout = window.setTimeout(async () => {
      if (!navigator.onLine) {
        setSaveState("offline");
        return;
      }

      setSaveState("saving");
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("thoughts")
        .upsert(
          {
            id: snapshot.id,
            user_id: snapshot.user_id,
            title: snapshot.title,
            body: snapshot.body,
            status: snapshot.status,
            is_pinned: snapshot.is_pinned,
            review_at: snapshot.review_at,
            created_at: snapshot.created_at,
            updated_at: snapshot.updated_at,
          },
          { onConflict: "id" },
        )
        .select(
          "id,user_id,title,body,status,is_pinned,review_at,created_at,updated_at",
        )
        .single();

      if (error) {
        setSaveState(navigator.onLine ? "error" : "offline");
        return;
      }

      persistedIdsRef.current.add(data.id);
      setThoughts((current) =>
        current.map((thought) => (thought.id === data.id ? data : thought)),
      );
      setSaveState("saved");

      if (pendingRef.current?.updated_at === snapshot.updated_at) {
        pendingRef.current = null;
        setPendingThought(null);
        window.localStorage.removeItem(pendingStorageKey(user.id));
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [pendingThought, user]);

  useEffect(() => {
    function retryPending() {
      if (!pendingRef.current) return;
      setPendingThought({
        ...pendingRef.current,
        updated_at: new Date().toISOString(),
      });
    }

    window.addEventListener("online", retryPending);
    return () => window.removeEventListener("online", retryPending);
  }, []);

  const activeThought =
    thoughts.find((thought) => thought.id === activeId) ?? null;

  const filteredThoughts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();

    return thoughts
      .filter((thought) => {
        if (view === "all" && thought.status === "archived") return false;
        if (view === "inbox" && thought.status !== "inbox") return false;
        if (view === "developing" && thought.status !== "developing") return false;
        if (view === "pinned" && !thought.is_pinned) return false;
        if (
          view === "review" &&
          (!thought.review_at ||
            new Date(thought.review_at).getTime() > reviewClock ||
            thought.status === "archived" ||
            thought.status === "finished")
        ) {
          return false;
        }
        if (view === "archived" && thought.status !== "archived") return false;

        if (!needle) return true;
        return `${thought.title ?? ""} ${thought.body}`
          .toLocaleLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [reviewClock, search, thoughts, view]);

  function createThought() {
    if (!user) return;
    const timestamp = new Date().toISOString();
    const thought: Thought = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title: null,
      body: "",
      status: "inbox",
      is_pinned: false,
      review_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    setThoughts((current) => [thought, ...current]);
    setActiveId(thought.id);
    setView("all");
    setSearch("");
    setShowMobileEditor(true);
    setSaveState("idle");
  }

  function patchActiveThought(patch: Partial<Thought>) {
    if (!activeThought || !user) return;
    const nextThought = {
      ...activeThought,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    setThoughts((current) =>
      current.map((thought) =>
        thought.id === nextThought.id ? nextThought : thought,
      ),
    );
    pendingRef.current = nextThought;
    setPendingThought(nextThought);
    setSaveState(navigator.onLine ? "saving" : "offline");
    window.localStorage.setItem(
      pendingStorageKey(user.id),
      JSON.stringify(nextThought),
    );
  }

  async function deleteActiveThought() {
    if (!activeThought || !user) return;
    const deletingId = activeThought.id;
    const remaining = thoughts.filter((thought) => thought.id !== deletingId);

    setThoughts(remaining);
    setActiveId(remaining[0]?.id ?? null);
    setShowMobileEditor(false);

    if (pendingRef.current?.id === deletingId) {
      pendingRef.current = null;
      setPendingThought(null);
      window.localStorage.removeItem(pendingStorageKey(user.id));
    }

    if (!persistedIdsRef.current.has(deletingId)) return;

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("thoughts").delete().eq("id", deletingId);
    if (error) {
      setThoughts((current) => [activeThought, ...current]);
      setActiveId(deletingId);
      setSaveState("error");
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  }

  function selectThought(id: string) {
    setActiveId(id);
    setShowMobileEditor(true);
  }

  function changeView(nextView: View) {
    setView(nextView);
    setSearch("");
    setShowMobileEditor(false);
  }

  if (isAuthLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--background)]">
        <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="size-4 animate-spin" />
          Opening Still
        </div>
      </main>
    );
  }

  if (!user) return <AuthScreen />;

  const details = viewDetails[view];

  return (
    <main className="h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid h-full lg:grid-cols-[244px_340px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] p-4 lg:flex">
          <div className="flex h-14 items-center gap-3 px-2">
            <div className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Feather className="size-4.5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[-0.02em]">Still</div>
              <div className="text-[10px] text-[var(--muted)]">Your private writing space</div>
            </div>
          </div>

          <Button className="mt-5 w-full justify-start" onClick={createThought}>
            <Plus className="size-4" />
            New thought
          </Button>

          <nav className="mt-6 space-y-1" aria-label="Thought views">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.view;
              const count =
                item.view === "inbox"
                  ? thoughts.filter((thought) => thought.status === "inbox").length
                  : item.view === "developing"
                    ? thoughts.filter((thought) => thought.status === "developing").length
                    : item.view === "pinned"
                      ? thoughts.filter((thought) => thought.is_pinned).length
                      : null;

              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => changeView(item.view)}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition",
                    isActive
                      ? "bg-[var(--surface-selected)] text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className={cn("size-4", isActive && "text-[var(--accent)]")} />
                  <span>{item.label}</span>
                  {count ? (
                    <span className="ml-auto rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-[var(--border)] pt-4">
            <div className="mb-3 px-2">
              <p className="truncate text-xs text-[var(--muted-foreground)]">{user.email}</p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {thoughts.length} {thoughts.length === 1 ? "thought" : "thoughts"} kept
              </p>
            </div>
            <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--sidebar)] px-4 lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
              <Feather className="size-4" />
            </div>
            <span className="text-sm font-semibold">Still</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="max-w-40 truncate text-xs text-[var(--muted)]"
          >
            {user.email}
          </button>
        </header>

        <ThoughtList
          title={details.title}
          description={details.description}
          thoughts={filteredThoughts}
          activeId={activeId}
          search={search}
          onSearch={setSearch}
          onSelect={selectThought}
          onNew={createThought}
          className={cn(
            "pt-16 pb-16 lg:flex lg:pt-0 lg:pb-0",
            showMobileEditor ? "hidden" : "flex",
          )}
        />

        <div
          className={cn(
            "min-w-0 pt-16 pb-16 lg:flex lg:pt-0 lg:pb-0",
            showMobileEditor ? "flex" : "hidden",
          )}
        >
          {isDataLoading ? (
            <div className="grid flex-1 place-items-center bg-[var(--editor)]">
              <LoaderCircle className="size-5 animate-spin text-[var(--muted)]" />
            </div>
          ) : activeThought ? (
            <ThoughtEditor
              thought={activeThought}
              saveState={saveState}
              onPatch={patchActiveThought}
              onDelete={deleteActiveThought}
              onBack={() => setShowMobileEditor(false)}
            />
          ) : (
            <EmptyEditor onNew={createThought} />
          )}
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--sidebar)_94%,transparent)] px-2 backdrop-blur-xl lg:hidden">
          <MobileNavButton
            active={view === "all" && !showMobileEditor}
            icon={BookOpenText}
            label="Thoughts"
            onClick={() => changeView("all")}
          />
          <MobileNavButton
            active={view === "inbox" && !showMobileEditor}
            icon={Inbox}
            label="Inbox"
            onClick={() => changeView("inbox")}
          />
          <button
            type="button"
            onClick={createThought}
            className="grid place-items-center"
            aria-label="New thought"
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)] shadow-lg">
              <Plus className="size-5" />
            </span>
          </button>
          <MobileNavButton
            active={view === "review" && !showMobileEditor}
            icon={Clock3}
            label="Today"
            onClick={() => changeView("review")}
          />
          <MobileNavButton
            active={Boolean(search) && !showMobileEditor}
            icon={Search}
            label="Search"
            onClick={() => {
              changeView("all");
              window.setTimeout(
                () =>
                  document
                    .querySelector<HTMLInputElement>(
                      'input[placeholder="Search your words"]',
                    )
                    ?.focus(),
                0,
              );
            }}
          />
        </nav>
      </div>
    </main>
  );
}

function EmptyEditor({ onNew }: { onNew: () => void }) {
  return (
    <section className="grid flex-1 place-items-center bg-[var(--editor)] p-8 text-center">
      <div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <Feather className="size-5 text-[var(--accent)]" />
        </div>
        <h2 className="mt-5 text-xl font-medium tracking-[-0.035em]">
          What is moving through your mind?
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
          Start with a sentence, a question, or the part you cannot stop thinking about.
        </p>
        <Button className="mt-6" onClick={onNew}>
          <Plus className="size-4" />
          Start a thought
        </Button>
      </div>
    </section>
  );
}

function MobileNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof BookOpenText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-[9px] font-medium",
        active ? "text-[var(--accent)]" : "text-[var(--muted)]",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
