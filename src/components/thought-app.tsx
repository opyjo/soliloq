"use client";

import {
  Archive,
  BookOpenText,
  Clock3,
  Command as CommandIcon,
  Compass,
  Dices,
  Download,
  Feather,
  Inbox,
  KeyRound,
  LoaderCircle,
  Lock,
  LogOut,
  Palette,
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
import {
  CommandPalette,
  type PaletteCommand,
} from "@/components/command-palette";
import { ThoughtEditor } from "@/components/thought-editor";
import { ThoughtList } from "@/components/thought-list";
import { PasscodeLock, PasscodeSettingsModal } from "@/components/passcode-lock";
import { ExportImportDialog } from "@/components/export-import-dialog";
import { DiscoverFeed } from "@/components/discover-feed";
import { Button } from "@/components/ui/button";
import type { Thought } from "@/lib/database.types";
import type { AppTheme } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, deriveThoughtTitle } from "@/lib/utils";

type View = "all" | "inbox" | "developing" | "pinned" | "review" | "archived" | "discover";
type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const viewDetails: Record<View, { title: string; description: string }> = {
  all: { title: "Your thoughts", description: "Everything still in motion" },
  inbox: { title: "Inbox", description: "New and unshaped" },
  developing: { title: "Developing", description: "Thoughts worth returning to" },
  pinned: { title: "Pinned", description: "Kept close at hand" },
  review: { title: "For today", description: "Ready to be seen again" },
  archived: { title: "Archive", description: "Quietly kept, out of the way" },
  discover: { title: "Discover Radar", description: "Cool things people are building" },
};

const navigation = [
  { view: "all" as const, label: "Thoughts", icon: BookOpenText },
  { view: "inbox" as const, label: "Inbox", icon: Inbox },
  { view: "developing" as const, label: "Developing", icon: Sparkles },
  { view: "pinned" as const, label: "Pinned", icon: Pin },
  { view: "review" as const, label: "For today", icon: Clock3 },
  { view: "discover" as const, label: "Discover", icon: Compass },
  { view: "archived" as const, label: "Archive", icon: Archive },
];

function pendingStorageKey(userId: string) {
  return `still:pending:${userId}`;
}

function lockStorageKey(userId: string) {
  return `still:lock:${userId}`;
}

function themeStorageKey(userId: string) {
  return `still:theme:${userId}`;
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
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [showMobileEditor, setShowMobileEditor] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pendingThought, setPendingThought] = useState<Thought | null>(null);
  const [reviewClock] = useState(() => Date.now());
  const pendingRef = useRef<Thought | null>(null);
  const persistedIdsRef = useRef(new Set<string>());

  // Features State
  const [hashedPin, setHashedPin] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isPasscodeSettingsOpen, setIsPasscodeSettingsOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);

  const loadThoughts = useCallback(async (currentUser: User) => {
    // Load local lock & theme configuration
    const savedPin = window.localStorage.getItem(lockStorageKey(currentUser.id));
    if (savedPin) {
      setHashedPin(savedPin);
      setIsLocked(true);
    }

    const savedTheme = window.localStorage.getItem(themeStorageKey(currentUser.id)) as AppTheme;
    if (savedTheme) {
      if (savedTheme === "default") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    }

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("thoughts")
      .select(
        "id,user_id,title,body,status,is_pinned,review_at,created_at,updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) {
      setSaveState("error");
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

  const closeCommandPalette = useCallback(
    () => setIsCommandPaletteOpen(false),
    [],
  );

  const handleSelectRandomThought = useCallback(() => {
    if (thoughts.length === 0) return;
    const randomIndex = Math.floor(Math.random() * thoughts.length);
    const chosen = thoughts[randomIndex];
    setActiveId(chosen.id);
    setShowMobileEditor(true);
  }, [thoughts]);

  const changeTheme = useCallback(
    (nextTheme: AppTheme) => {
      if (nextTheme === "default") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", nextTheme);
      }
      if (user) {
        window.localStorage.setItem(themeStorageKey(user.id), nextTheme);
      }
    },
    [user],
  );

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;

      if (isCmdOrCtrl && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }

      if (isCmdOrCtrl && event.key.toLowerCase() === "l") {
        event.preventDefault();
        if (hashedPin) {
          setIsLocked(true);
        } else {
          setIsPasscodeSettingsOpen(true);
        }
      }

      if (isCmdOrCtrl && event.key.toLowerCase() === "r" && !event.shiftKey) {
        event.preventDefault();
        handleSelectRandomThought();
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [hashedPin, handleSelectRandomThought]);

  const activeThought = useMemo(
    () => thoughts.find((thought) => thought.id === activeId) ?? null,
    [activeId, thoughts],
  );

  const filteredThoughts = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return thoughts.filter((thought) => {
      const matchesView = (() => {
        switch (view) {
          case "all":
            return thought.status !== "archived";
          case "inbox":
            return thought.status === "inbox";
          case "developing":
            return thought.status === "developing";
          case "pinned":
            return thought.is_pinned && thought.status !== "archived";
          case "review":
            return (
              Boolean(thought.review_at) &&
              new Date(thought.review_at!).getTime() <= reviewClock &&
              thought.status !== "archived" &&
              thought.status !== "finished"
            );
          case "archived":
            return thought.status === "archived";
          case "discover":
            return false;
        }
      })();

      if (!matchesView) return false;
      if (!needle) return true;

      const title = (thought.title ?? "").toLowerCase();
      const body = thought.body.toLowerCase();
      return title.includes(needle) || body.includes(needle);
    });
  }, [reviewClock, search, thoughts, view]);

  const patchActiveThought = useCallback(
    (patch: Partial<Thought>) => {
      if (!activeId || !user) return;

      const updatedTime = new Date().toISOString();
      let updatedThought: Thought | null = null;

      setThoughts((current) =>
        current.map((thought) => {
          if (thought.id !== activeId) return thought;
          updatedThought = {
            ...thought,
            ...patch,
            updated_at: updatedTime,
          };
          return updatedThought;
        }),
      );

      if (updatedThought) {
        pendingRef.current = updatedThought;
        setPendingThought(updatedThought);
        window.localStorage.setItem(
          pendingStorageKey(user.id),
          JSON.stringify(updatedThought),
        );
        setSaveState(navigator.onLine ? "saving" : "offline");
      }
    },
    [activeId, user],
  );

  const createThought = useCallback(() => {
    if (!user) return;

    const newThought: Thought = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title: null,
      body: "",
      status: "inbox",
      is_pinned: false,
      review_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setThoughts((current) => [newThought, ...current]);
    setActiveId(newThought.id);
    setView("all");
    setShowMobileEditor(true);
    setSaveState("idle");
  }, [user]);

  const handleCaptureProject = useCallback(
    (itemTitle: string, itemUrl: string, itemDescription: string) => {
      if (!user) return;

      const cleanTitle = itemTitle.trim();
      const cleanUrl = itemUrl.trim();
      const cleanDesc = itemDescription.trim();

      const bodyText = `🔗 **Link**: [${cleanUrl}](${cleanUrl})\n\n> ${cleanDesc}\n\n### 💡 Key Takeaways & Reflections:\n- \n\n### 🚀 Action Items / Ideas:\n- `;

      const newThought: Thought = {
        id: crypto.randomUUID(),
        user_id: user.id,
        title: cleanTitle,
        body: bodyText,
        status: "inbox",
        is_pinned: false,
        review_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setThoughts((current) => [newThought, ...current]);
      setActiveId(newThought.id);
      setView("all");
      setShowMobileEditor(true);
    },
    [user],
  );

  function deleteActiveThought() {
    if (!activeId || !user) return;

    const targetId = activeId;
    const isPersisted = persistedIdsRef.current.has(targetId);

    setThoughts((current) => {
      const remaining = current.filter((thought) => thought.id !== targetId);
      setActiveId(remaining[0]?.id ?? null);
      if (!remaining.length) setShowMobileEditor(false);
      return remaining;
    });

    if (pendingRef.current?.id === targetId) {
      pendingRef.current = null;
      setPendingThought(null);
      window.localStorage.removeItem(pendingStorageKey(user.id));
    }

    if (isPersisted) {
      const supabase = getSupabaseBrowserClient();
      void supabase.from("thoughts").delete().eq("id", targetId);
    }
  }

  function changeView(nextView: View) {
    setView(nextView);
    setShowMobileEditor(false);
  }

  function handleWikiLinkClick(targetTitle: string) {
    const needle = targetTitle.trim().toLowerCase();
    const match = thoughts.find((t) =>
      (t.title ?? deriveThoughtTitle(t.body)).toLowerCase().includes(needle)
    );
    if (match) {
      setActiveId(match.id);
      setShowMobileEditor(true);
    } else {
      if (!user) return;
      const newThought: Thought = {
        id: crypto.randomUUID(),
        user_id: user.id,
        title: targetTitle,
        body: "",
        status: "inbox",
        is_pinned: false,
        review_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setThoughts((current) => [newThought, ...current]);
      setActiveId(newThought.id);
      setShowMobileEditor(true);
    }
  }

  async function handleImportThoughts(imported: Partial<Thought>[]) {
    if (!user) return;
    const now = new Date().toISOString();
    const supabase = getSupabaseBrowserClient();

    const formatted: Thought[] = imported.map((item) => ({
      id: item.id || crypto.randomUUID(),
      user_id: user.id,
      title: item.title || null,
      body: item.body || "",
      status: (item.status as Thought["status"]) || "inbox",
      is_pinned: Boolean(item.is_pinned),
      review_at: item.review_at || null,
      created_at: item.created_at || now,
      updated_at: item.updated_at || now,
    }));

    setThoughts((prev) => [...formatted, ...prev]);

    for (const t of formatted) {
      const { search_document, ...insertable } = t;
      void search_document;
      await supabase.from("thoughts").upsert(insertable);
    }
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setThoughts([]);
    setActiveId(null);
  }

  const paletteCommands: PaletteCommand[] = useMemo(() => {
    const actions: PaletteCommand[] = [
      {
        id: "new-thought",
        label: "Create a thought",
        description: "Start a fresh, unshaped thought in your inbox",
        shortcut: "N",
        icon: Plus,
        action: createThought,
      },
      {
        id: "view-discover",
        label: "Discover & Build Radar",
        description: "Browse cool things people are building across the web",
        icon: Compass,
        action: () => changeView("discover"),
      },
      {
        id: "random-thought",
        label: "Resurface random thought",
        description: "Serendipity Engine: Surprise yourself with a past thought",
        shortcut: "⌘R",
        icon: Dices,
        action: handleSelectRandomThought,
      },
      {
        id: "lock-app",
        label: hashedPin ? "Lock Still now" : "Set passcode lock",
        description: "Secure your session behind a PIN code",
        shortcut: "⌘L",
        icon: Lock,
        action: () => {
          if (hashedPin) setIsLocked(true);
          else setIsPasscodeSettingsOpen(true);
        },
      },
      {
        id: "export-import",
        label: "Export & Backup Data",
        description: "Download JSON or Markdown exports and restore backups",
        icon: Download,
        action: () => setIsExportImportOpen(true),
      },
      {
        id: "theme-default",
        label: "Theme: Dark Forest (Default)",
        description: "Minimal warm dark background",
        icon: Palette,
        action: () => changeTheme("default"),
      },
      {
        id: "theme-sepia",
        label: "Theme: Warm Sepia",
        description: "Soft parchment paper aesthetic",
        icon: Palette,
        action: () => changeTheme("sepia"),
      },
      {
        id: "theme-oled",
        label: "Theme: OLED Night",
        description: "True black contrast mode",
        icon: Palette,
        action: () => changeTheme("oled"),
      },
      {
        id: "theme-cream",
        label: "Theme: Warm Cream",
        description: "Clean light paper mode",
        icon: Palette,
        action: () => changeTheme("cream"),
      },
      {
        id: "theme-nord",
        label: "Theme: Polar Nord",
        description: "Cool arctic palette",
        icon: Palette,
        action: () => changeTheme("nord"),
      },
    ];

    navigation.forEach((item) => {
      actions.push({
        id: `view-${item.view}`,
        label: `Go to ${item.label}`,
        description: viewDetails[item.view].description,
        icon: item.icon,
        action: () => changeView(item.view),
      });
    });

    actions.push({
      id: "sign-out",
      label: "Sign out",
      description: "Securely end your session",
      icon: LogOut,
      action: handleSignOut,
    });

    return actions;
  }, [changeTheme, createThought, handleSelectRandomThought, hashedPin]);

  if (isAuthLoading) {
    return (
      <div className="grid h-dvh w-dvw place-items-center bg-[var(--background)]">
        <LoaderCircle className="size-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <main className="still-shell relative h-dvh w-dvw overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <PasscodeLock
        isLocked={isLocked}
        hashedPin={hashedPin}
        onUnlock={() => setIsLocked(false)}
      />

      <PasscodeSettingsModal
        isOpen={isPasscodeSettingsOpen}
        onClose={() => setIsPasscodeSettingsOpen(false)}
        hashedPin={hashedPin}
        onSetPin={(hashed) => {
          setHashedPin(hashed);
          window.localStorage.setItem(lockStorageKey(user.id), hashed);
        }}
        onRemovePin={() => {
          setHashedPin(null);
          setIsLocked(false);
          window.localStorage.removeItem(lockStorageKey(user.id));
        }}
      />

      <ExportImportDialog
        isOpen={isExportImportOpen}
        onClose={() => setIsExportImportOpen(false)}
        thoughts={thoughts}
        onImportThoughts={handleImportThoughts}
      />

      <div className="still-ambient still-ambient-one" aria-hidden="true" />
      <div className="still-ambient still-ambient-two" aria-hidden="true" />

      <div className="relative z-10 flex h-full min-w-0">
        <aside className="hidden w-64 flex-col justify-between border-r border-[var(--border)] bg-[var(--sidebar)] p-4 lg:flex xl:w-72">
          <div>
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
                  <Feather className="size-4" />
                </span>
                <span className="font-semibold tracking-[-0.04em]">Still</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCommandPaletteOpen(true)}
                aria-label="Open command palette"
                className="size-8 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <CommandIcon className="size-3.5" />
              </Button>
            </div>

            <Button
              className="mt-5 h-11 w-full justify-start gap-2.5 rounded-2xl font-medium"
              onClick={createThought}
            >
              <Plus className="size-4" />
              Start a thought
            </Button>

            <nav className="mt-6 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = view === item.view;
                const count = item.view === "discover" ? 0 : thoughts.filter((t) => {
                  if (item.view === "all") return t.status !== "archived";
                  if (item.view === "inbox") return t.status === "inbox";
                  if (item.view === "developing") return t.status === "developing";
                  if (item.view === "pinned") return t.is_pinned && t.status !== "archived";
                  if (item.view === "review")
                    return (
                      Boolean(t.review_at) &&
                      new Date(t.review_at!).getTime() <= reviewClock &&
                      t.status !== "archived" &&
                      t.status !== "finished"
                    );
                  if (item.view === "archived") return t.status === "archived";
                  return false;
                }).length;

                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => changeView(item.view)}
                    className={cn(
                      "flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[11px] font-medium transition",
                      isActive
                        ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-[var(--accent)]" />
                      <span>{item.label}</span>
                    </div>
                    {count > 0 ? (
                      <span className="rounded-md bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--muted)]">
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-between rounded-xl bg-[var(--surface)] p-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-[10px] font-bold text-[var(--accent-foreground)]">
                  {user.email?.[0]?.toUpperCase() || "U"}
                </span>
                <span className="truncate text-[11px] font-medium text-[var(--foreground)]" title={user.email || ""}>
                  {user.email || "Account"}
                </span>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setIsExportImportOpen(true)}
                  title="Backup / Export Data"
                  aria-label="Backup / Export"
                >
                  <Download className="size-3 text-[var(--muted-foreground)]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setIsPasscodeSettingsOpen(true)}
                  title="Passcode Lock Settings"
                  aria-label="Passcode Lock"
                >
                  <KeyRound className="size-3 text-[var(--muted-foreground)]" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 hover:text-[var(--danger)]"
                  onClick={handleSignOut}
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {view === "discover" ? (
          <DiscoverFeed onCaptureItem={handleCaptureProject} />
        ) : (
          <>
            <ThoughtList
              title={viewDetails[view].title}
              description={viewDetails[view].description}
              thoughts={filteredThoughts}
              allThoughts={thoughts}
              activeId={activeId}
              search={search}
              onSearch={setSearch}
              onSelect={(id) => {
                setActiveId(id);
                setShowMobileEditor(true);
              }}
              onNew={createThought}
              onSelectRandom={handleSelectRandomThought}
              className={cn(
                "w-full lg:w-80 lg:flex xl:w-96",
                showMobileEditor ? "hidden lg:flex" : "flex",
              )}
            />

            <div
              className={cn(
                "min-w-0 flex-1",
                showMobileEditor ? "flex" : "hidden lg:flex",
              )}
            >
              {activeThought ? (
                <ThoughtEditor
                  key={activeThought.id}
                  thought={activeThought}
                  saveState={saveState}
                  onPatch={patchActiveThought}
                  onDelete={deleteActiveThought}
                  onBack={() => setShowMobileEditor(false)}
                  isFocusMode={isFocusMode}
                  onToggleFocusMode={() => setIsFocusMode((current) => !current)}
                  onWikiLinkClick={handleWikiLinkClick}
                  onTagClick={(tag) => setSearch(tag)}
                />
              ) : (
                <EmptyEditor onNew={createThought} />
              )}
            </div>
          </>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--sidebar)_94%,transparent)] px-2 backdrop-blur-xl lg:hidden">
          <MobileNavButton
            active={view === "all" && !showMobileEditor}
            icon={BookOpenText}
            label="Thoughts"
            onClick={() => changeView("all")}
          />
          <MobileNavButton
            active={view === "discover" && !showMobileEditor}
            icon={Compass}
            label="Discover"
            onClick={() => changeView("discover")}
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
                      'input[placeholder="Search words or #tags"]',
                    )
                    ?.focus(),
                0,
              );
            }}
          />
        </nav>
      </div>

      <CommandPalette
        commands={paletteCommands}
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
      />
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
