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
  Network,
  Palette,
  Pin,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
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
import { removeThoughtAudioAttachments } from "@/lib/audio-attachments";
import { removeCloudThoughtAudioAttachments } from "@/lib/cloud-audio";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  removeThoughtHistory,
  recordThoughtVersion,
  type ThoughtVersion,
} from "@/lib/thought-history";
import { rankThoughts } from "@/lib/thought-intelligence";
import { cn, deriveThoughtTitle } from "@/lib/utils";

type View =
  | "all"
  | "inbox"
  | "developing"
  | "pinned"
  | "review"
  | "archived"
  | "discover"
  | "studio";
type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const viewDetails: Record<View, { title: string; description: string }> = {
  all: { title: "Your thoughts", description: "Everything still in motion" },
  inbox: { title: "Inbox", description: "New and unshaped" },
  developing: { title: "Developing", description: "Thoughts worth returning to" },
  pinned: { title: "Pinned", description: "Kept close at hand" },
  review: { title: "For today", description: "Ready to be seen again" },
  archived: { title: "Archive", description: "Quietly kept, out of the way" },
  discover: { title: "Discover Radar", description: "Cool things people are building" },
  studio: { title: "Thinking Studio", description: "Patterns, connections, and reflection" },
};

const navigation = [
  { view: "all" as const, label: "Thoughts", icon: BookOpenText },
  { view: "inbox" as const, label: "Inbox", icon: Inbox },
  { view: "developing" as const, label: "Developing", icon: Sparkles },
  { view: "pinned" as const, label: "Pinned", icon: Pin },
  { view: "review" as const, label: "For today", icon: Clock3 },
  { view: "studio" as const, label: "Studio", icon: Network },
  { view: "discover" as const, label: "Discover", icon: Compass },
  { view: "archived" as const, label: "Archive", icon: Archive },
];

const thoughtStatuses = new Set<Thought["status"]>([
  "inbox",
  "developing",
  "finished",
  "archived",
]);
const appThemes = new Set<AppTheme>([
  "default",
  "sepia",
  "oled",
  "cream",
  "nord",
]);

const ThinkingStudio = dynamic(
  () =>
    import("@/components/thinking-studio").then(
      (module) => module.ThinkingStudio,
    ),
  {
    loading: () => (
      <div className="grid min-w-0 flex-1 place-items-center bg-[var(--editor)]">
        <LoaderCircle className="size-5 animate-spin text-[var(--accent)]" />
      </div>
    ),
  },
);

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
    (typeof candidate.title === "string" || candidate.title === null) &&
    typeof candidate.body === "string" &&
    typeof candidate.status === "string" &&
    thoughtStatuses.has(candidate.status as Thought["status"]) &&
    typeof candidate.is_pinned === "boolean" &&
    (typeof candidate.review_at === "string" || candidate.review_at === null) &&
    typeof candidate.created_at === "string" &&
    typeof candidate.updated_at === "string"
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function thoughtForPersistence(thought: Thought) {
  return {
    id: thought.id,
    user_id: thought.user_id,
    title: thought.title,
    body: thought.body,
    status: thought.status,
    is_pinned: thought.is_pinned,
    review_at: thought.review_at,
    created_at: thought.created_at,
    updated_at: thought.updated_at,
  };
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
  const [pendingThoughts, setPendingThoughts] = useState<Thought[]>([]);
  const [reviewClock, setReviewClock] = useState(() => Date.now());
  const pendingRef = useRef(new Map<string, Thought>());
  const persistedIdsRef = useRef(new Set<string>());
  const saveInFlightRef = useRef<Promise<void>>(Promise.resolve());

  // Features State
  const [hashedPin, setHashedPin] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isPasscodeSettingsOpen, setIsPasscodeSettingsOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);

  const loadThoughts = useCallback(async (currentUser: User) => {
    pendingRef.current.clear();
    setPendingThoughts([]);
    setSaveState("idle");

    // Load local lock & theme configuration
    const savedPin = window.localStorage.getItem(lockStorageKey(currentUser.id));
    setHashedPin(savedPin);
    setIsLocked(Boolean(savedPin));

    const rawTheme = window.localStorage.getItem(
      themeStorageKey(currentUser.id),
    );
    const savedTheme =
      rawTheme && appThemes.has(rawTheme as AppTheme)
        ? (rawTheme as AppTheme)
        : "default";
    if (savedTheme === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", savedTheme);
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

    let recoveredThoughts: Thought[] = [];
    const rawPending = window.localStorage.getItem(
      pendingStorageKey(currentUser.id),
    );

    if (rawPending) {
      try {
        const parsed: unknown = JSON.parse(rawPending);
        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        recoveredThoughts = candidates.filter(
          (candidate): candidate is Thought =>
            isThought(candidate) && candidate.user_id === currentUser.id,
        );
      } catch {
        window.localStorage.removeItem(pendingStorageKey(currentUser.id));
      }
    }

    const recoveredIds = new Set(
      recoveredThoughts.map((thought) => thought.id),
    );
    const mergedThoughts = [
      ...recoveredThoughts,
      ...remoteThoughts.filter((thought) => !recoveredIds.has(thought.id)),
    ];

    setThoughts(mergedThoughts);
    setActiveId(mergedThoughts[0]?.id ?? null);

    if (recoveredThoughts.length > 0) {
      pendingRef.current = new Map(
        recoveredThoughts.map((thought) => [thought.id, thought]),
      );
      setPendingThoughts(recoveredThoughts);
      setSaveState(navigator.onLine ? "saving" : "offline");
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setIsAuthLoading(false);
      if (data.user) void loadThoughts(data.user);
      else document.documentElement.removeAttribute("data-theme");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAuthLoading(false);

      if (event === "SIGNED_IN" && currentUser) {
        void loadThoughts(currentUser);
      } else if (event === "SIGNED_OUT") {
        pendingRef.current.clear();
        persistedIdsRef.current.clear();
        setPendingThoughts([]);
        setThoughts([]);
        setActiveId(null);
        setHashedPin(null);
        setIsLocked(false);
        setIsFocusMode(false);
        document.documentElement.removeAttribute("data-theme");
      }
    });

    return () => subscription.unsubscribe();
  }, [loadThoughts]);

  useEffect(() => {
    if (pendingThoughts.length === 0 || !user) return;

    const snapshots = pendingThoughts.filter(
      (thought) =>
        persistedIdsRef.current.has(thought.id) ||
        Boolean(thought.title?.trim()) ||
        Boolean(thought.body.trim()),
    );
    if (snapshots.length === 0) return;

    const timeout = window.setTimeout(() => {
      const operation = (async () => {
        if (!navigator.onLine) {
          setSaveState("offline");
          return;
        }

        setSaveState("saving");
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("thoughts")
          .upsert(snapshots.map(thoughtForPersistence), { onConflict: "id" })
          .select(
            "id,user_id,title,body,status,is_pinned,review_at,created_at,updated_at",
          );

        if (error) {
          setSaveState(navigator.onLine ? "error" : "offline");
          return;
        }

        const savedById = new Map(
          (data ?? []).map((thought) => [thought.id, thought]),
        );
        const snapshotById = new Map(
          snapshots.map((thought) => [thought.id, thought]),
        );
        data?.forEach((thought) => persistedIdsRef.current.add(thought.id));

        setThoughts((current) =>
          current.map((thought) => {
            const saved = savedById.get(thought.id);
            const snapshot = snapshotById.get(thought.id);
            return saved && snapshot?.updated_at === thought.updated_at
              ? saved
              : thought;
          }),
        );

        snapshots.forEach((snapshot) => {
          if (
            pendingRef.current.get(snapshot.id)?.updated_at ===
            snapshot.updated_at
          ) {
            pendingRef.current.delete(snapshot.id);
          }
        });

        const remaining = Array.from(pendingRef.current.values());
        setPendingThoughts(remaining);
        setSaveState(remaining.length > 0 ? "saving" : "saved");

        if (remaining.length === 0) {
          window.localStorage.removeItem(pendingStorageKey(user.id));
        } else {
          window.localStorage.setItem(
            pendingStorageKey(user.id),
            JSON.stringify(remaining),
          );
        }
      })();

      const guardedOperation = operation.catch((error) => {
        console.error("Thought autosave failed:", error);
        setSaveState(navigator.onLine ? "error" : "offline");
      });
      saveInFlightRef.current = guardedOperation;
      void guardedOperation.finally(() => {
        if (saveInFlightRef.current === guardedOperation) {
          saveInFlightRef.current = Promise.resolve();
        }
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [pendingThoughts, user]);

  useEffect(() => {
    function retryPending() {
      if (pendingRef.current.size === 0) return;
      setPendingThoughts(Array.from(pendingRef.current.values()));
    }

    window.addEventListener("online", retryPending);
    return () => window.removeEventListener("online", retryPending);
  }, []);

  useEffect(() => {
    const updateClock = () => setReviewClock(Date.now());
    const interval = window.setInterval(updateClock, 60_000);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateClock);
    };
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

  const activeThought = useMemo(
    () => thoughts.find((thought) => thought.id === activeId) ?? null,
    [activeId, thoughts],
  );

  const queueThoughtForSave = useCallback(
    (thought: Thought) => {
      if (!user || thought.user_id !== user.id) return;

      pendingRef.current.set(thought.id, thought);
      const pending = Array.from(pendingRef.current.values());
      setPendingThoughts(pending);
      window.localStorage.setItem(
        pendingStorageKey(user.id),
        JSON.stringify(pending),
      );
      setSaveState(navigator.onLine ? "saving" : "offline");
    },
    [user],
  );

  const filteredThoughts = useMemo(() => {
    const matchingView = thoughts.filter((thought) => {
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
          case "studio":
            return false;
        }
      })();
      return matchesView;
    });
    return rankThoughts(matchingView, search);
  }, [reviewClock, search, thoughts, view]);

  const patchActiveThought = useCallback(
    (patch: Partial<Thought>) => {
      if (!activeId || !user || !activeThought) return;
      if (
        ("title" in patch && patch.title !== activeThought.title) ||
        ("body" in patch && patch.body !== activeThought.body)
      ) {
        recordThoughtVersion(user.id, activeThought);
      }

      const updatedThought: Thought = {
        ...activeThought,
        ...patch,
        id: activeThought.id,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      setThoughts((current) =>
        current.map((thought) =>
          thought.id === activeId ? updatedThought : thought,
        ),
      );
      queueThoughtForSave(updatedThought);
    },
    [activeId, activeThought, queueThoughtForSave, user],
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

  const createThoughtWithContent = useCallback(
    (title: string | null, body: string) => {
      if (!user) return;
      const now = new Date().toISOString();
      const newThought: Thought = {
        id: crypto.randomUUID(),
        user_id: user.id,
        title,
        body,
        status: "inbox",
        is_pinned: false,
        review_at: null,
        created_at: now,
        updated_at: now,
      };
      setThoughts((current) => [newThought, ...current]);
      setActiveId(newThought.id);
      setView("all");
      setShowMobileEditor(true);
      queueThoughtForSave(newThought);
    },
    [queueThoughtForSave, user],
  );

  useEffect(() => {
    if (!user || isAuthLoading) return;
    const url = new URL(window.location.href);
    let action: "capture" | "studio" | null = null;
    if (url.searchParams.get("capture") === "1") {
      action = "capture";
    } else if (url.searchParams.get("studio") === "1") {
      action = "studio";
    } else {
      return;
    }
    url.searchParams.delete("capture");
    url.searchParams.delete("studio");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    const timeout = window.setTimeout(() => {
      if (action === "capture") {
        createThought();
      } else {
        setView("studio");
        setShowMobileEditor(false);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [createThought, isAuthLoading, user]);

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

      if (
        !isCmdOrCtrl &&
        !event.altKey &&
        !isEditableTarget(event.target) &&
        event.key.toLowerCase() === "n"
      ) {
        event.preventDefault();
        createThought();
      }

      if (
        !isCmdOrCtrl &&
        !event.altKey &&
        !isEditableTarget(event.target) &&
        event.key.toLowerCase() === "r"
      ) {
        event.preventDefault();
        handleSelectRandomThought();
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [createThought, hashedPin, handleSelectRandomThought]);

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
      queueThoughtForSave(newThought);
    },
    [queueThoughtForSave, user],
  );

  async function deleteActiveThought() {
    if (!activeId || !user) return;

    const targetId = activeId;
    const target = thoughts.find((thought) => thought.id === targetId);
    if (!target) return;

    const targetIndex = thoughts.findIndex((thought) => thought.id === targetId);
    const isPersisted = persistedIdsRef.current.has(targetId);
    const pendingBeforeDelete = pendingRef.current.get(targetId) ?? null;

    setThoughts((current) => {
      const remaining = current.filter((thought) => thought.id !== targetId);
      setActiveId(remaining[0]?.id ?? null);
      if (!remaining.length) setShowMobileEditor(false);
      return remaining;
    });

    pendingRef.current.delete(targetId);
    const remainingPending = Array.from(pendingRef.current.values());
    setPendingThoughts(remainingPending);
    if (remainingPending.length === 0) {
      window.localStorage.removeItem(pendingStorageKey(user.id));
    } else {
      window.localStorage.setItem(
        pendingStorageKey(user.id),
        JSON.stringify(remainingPending),
      );
    }

    if (isPersisted) {
      await saveInFlightRef.current;
      try {
        await removeCloudThoughtAudioAttachments(user.id, targetId);
      } catch (error) {
        console.warn("Could not remove synced voice memos:", error);
      }
      const supabase = getSupabaseBrowserClient();
      const { data: deleted, error } = await supabase
        .from("thoughts")
        .delete()
        .eq("id", targetId)
        .select("id")
        .single();
      if (error || deleted?.id !== targetId) {
        setThoughts((current) => {
          if (current.some((thought) => thought.id === targetId)) return current;
          const restored = [...current];
          restored.splice(Math.max(0, targetIndex), 0, target);
          return restored;
        });
        setActiveId(targetId);
        setShowMobileEditor(true);
        setSaveState(navigator.onLine ? "error" : "offline");
        if (pendingBeforeDelete) queueThoughtForSave(pendingBeforeDelete);
        window.alert("This thought could not be deleted. It has been restored.");
        return;
      }
      persistedIdsRef.current.delete(targetId);
    }

    try {
      await removeThoughtAudioAttachments(user.id, targetId);
    } catch (error) {
      console.warn("Could not remove local voice memos:", error);
    }
    removeThoughtHistory(user.id, targetId);
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
      queueThoughtForSave(newThought);
    }
  }

  async function handleImportThoughts(imported: unknown) {
    if (!user) throw new Error("You must be signed in to import thoughts.");
    if (!Array.isArray(imported) || imported.length === 0) {
      throw new Error("The backup must contain at least one thought.");
    }
    if (imported.length > 1_000) {
      throw new Error("Import up to 1,000 thoughts at a time.");
    }

    const now = new Date().toISOString();
    const supabase = getSupabaseBrowserClient();
    const formattedById = new Map<string, Thought>();

    imported.forEach((value, index) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Thought ${index + 1} is not a valid object.`);
      }
      const item = value as Record<string, unknown>;
      if (!("title" in item) && !("body" in item)) {
        throw new Error(`Thought ${index + 1} has no title or body.`);
      }
      if (
        ("title" in item &&
          item.title !== null &&
          typeof item.title !== "string") ||
        ("body" in item && typeof item.body !== "string") ||
        ("status" in item &&
          (typeof item.status !== "string" ||
            !thoughtStatuses.has(item.status as Thought["status"]))) ||
        ("is_pinned" in item && typeof item.is_pinned !== "boolean") ||
        ("review_at" in item &&
          item.review_at !== null &&
          !isValidDateString(item.review_at)) ||
        ("created_at" in item && !isValidDateString(item.created_at)) ||
        ("updated_at" in item && !isValidDateString(item.updated_at)) ||
        ("id" in item && !isValidUuid(item.id))
      ) {
        throw new Error(`Thought ${index + 1} contains invalid fields.`);
      }

      const id = isValidUuid(item.id) ? item.id : crypto.randomUUID();
      formattedById.set(id, {
        id,
        user_id: user.id,
        title:
          typeof item.title === "string"
            ? item.title.slice(0, 500)
            : null,
        body: typeof item.body === "string" ? item.body : "",
        status: thoughtStatuses.has(item.status as Thought["status"])
          ? (item.status as Thought["status"])
          : "inbox",
        is_pinned: item.is_pinned === true,
        review_at: isValidDateString(item.review_at) ? item.review_at : null,
        created_at: isValidDateString(item.created_at) ? item.created_at : now,
        updated_at: isValidDateString(item.updated_at) ? item.updated_at : now,
      });
    });

    const formatted = Array.from(formattedById.values());
    const { data, error } = await supabase
      .from("thoughts")
      .upsert(formatted.map(thoughtForPersistence), { onConflict: "id" })
      .select(
        "id,user_id,title,body,status,is_pinned,review_at,created_at,updated_at",
      );

    if (error || !data) {
      throw new Error(error?.message ?? "The imported thoughts could not be saved.");
    }

    data.forEach((thought) => persistedIdsRef.current.add(thought.id));
    const importedIds = new Set(data.map((thought) => thought.id));
    setThoughts((current) => [
      ...data,
      ...current.filter((thought) => !importedIds.has(thought.id)),
    ]);
    setActiveId(data[0]?.id ?? activeId);
    setSaveState("saved");
    return { imported: data.length };
  }

  function restoreThoughtVersion(version: ThoughtVersion) {
    if (!user || !activeThought || version.thoughtId !== activeThought.id) {
      return;
    }
    recordThoughtVersion(user.id, activeThought);
    patchActiveThought({ title: version.title, body: version.body });
    setView("all");
    setShowMobileEditor(true);
  }

  async function mergeThoughts(primaryId: string, duplicateId: string) {
    if (!user || primaryId === duplicateId) return;
    const primary = thoughts.find((thought) => thought.id === primaryId);
    const duplicate = thoughts.find((thought) => thought.id === duplicateId);
    if (!primary || !duplicate) return;
    if (
      !window.confirm(
        `Merge “${duplicate.title ?? deriveThoughtTitle(duplicate.body)}” into “${primary.title ?? deriveThoughtTitle(primary.body)}”? The second thought will be removed.`,
      )
    ) {
      return;
    }

    recordThoughtVersion(user.id, primary);
    const merged: Thought = {
      ...primary,
      body: `${primary.body.trimEnd()}\n\n---\n\n## Merged from ${duplicate.title ?? deriveThoughtTitle(duplicate.body)}\n\n${duplicate.body}`.trim(),
      updated_at: new Date().toISOString(),
    };
    setThoughts((current) =>
      current
        .filter((thought) => thought.id !== duplicateId)
        .map((thought) => (thought.id === primaryId ? merged : thought)),
    );
    setActiveId(primaryId);
    queueThoughtForSave(merged);

    pendingRef.current.delete(duplicateId);
    if (persistedIdsRef.current.has(duplicateId)) {
      try {
        await removeCloudThoughtAudioAttachments(user.id, duplicateId);
      } catch (error) {
        console.warn("Could not remove merged voice memos:", error);
      }
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("thoughts")
        .delete()
        .eq("id", duplicateId)
        .eq("user_id", user.id);
      if (error) {
        setThoughts((current) => [duplicate, ...current]);
        setSaveState("error");
        window.alert("The thoughts were combined, but the duplicate could not be removed.");
        return;
      }
      persistedIdsRef.current.delete(duplicateId);
    }
    removeThoughtHistory(user.id, duplicateId);
    void removeThoughtAudioAttachments(user.id, duplicateId);
  }

  const handleSignOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSaveState("error");
      window.alert("Still could not sign you out. Please try again.");
      return;
    }
    setUser(null);
    setThoughts([]);
    setActiveId(null);
    setHashedPin(null);
    setIsLocked(false);
    setIsFocusMode(false);
    setPendingThoughts([]);
    document.documentElement.removeAttribute("data-theme");
  }, []);

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
        shortcut: "R",
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
  }, [
    changeTheme,
    createThought,
    handleSelectRandomThought,
    handleSignOut,
    hashedPin,
  ]);

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
        <aside
          className={cn(
            "hidden w-64 flex-col justify-between border-r border-[var(--border)] bg-[var(--sidebar)] p-4 lg:flex xl:w-72",
            isFocusMode && "!hidden",
          )}
        >
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
                const count =
                  item.view === "discover" || item.view === "studio"
                    ? 0
                    : thoughts.filter((t) => {
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
        ) : view === "studio" ? (
          <ThinkingStudio
            userId={user.id}
            thoughts={thoughts}
            activeThought={activeThought}
            onSelect={(id) => {
              setActiveId(id);
              setView("all");
              setShowMobileEditor(true);
            }}
            onCreate={createThoughtWithContent}
            onPatchActive={patchActiveThought}
            onMerge={(primaryId, duplicateId) =>
              void mergeThoughts(primaryId, duplicateId)
            }
            onRestore={restoreThoughtVersion}
          />
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
                isFocusMode && "!hidden",
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

        <nav
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--sidebar)_94%,transparent)] px-2 backdrop-blur-xl lg:hidden",
            isFocusMode && "hidden",
          )}
        >
          <MobileNavButton
            active={view === "all" && !showMobileEditor}
            icon={BookOpenText}
            label="Thoughts"
            onClick={() => changeView("all")}
          />
          <MobileNavButton
            active={view === "studio" && !showMobileEditor}
            icon={Network}
            label="Studio"
            onClick={() => changeView("studio")}
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
                      'input[placeholder="Search words, meaning, or #tags"]',
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
