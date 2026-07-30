import type { Thought } from "@/lib/database.types";

export type ThoughtVersion = {
  id: string;
  thoughtId: string;
  title: string | null;
  body: string;
  createdAt: string;
};

const MAX_VERSIONS_PER_THOUGHT = 30;
const MIN_VERSION_INTERVAL_MS = 5 * 60_000;

function historyKey(userId: string) {
  return `still:history:v1:${userId}`;
}

function readAll(userId: string): ThoughtVersion[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(historyKey(userId)) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ThoughtVersion =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as ThoughtVersion).id === "string" &&
        typeof (item as ThoughtVersion).thoughtId === "string" &&
        typeof (item as ThoughtVersion).body === "string" &&
        typeof (item as ThoughtVersion).createdAt === "string",
    );
  } catch {
    return [];
  }
}

export function getThoughtVersions(userId: string, thoughtId: string) {
  return readAll(userId)
    .filter((version) => version.thoughtId === thoughtId)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function recordThoughtVersion(userId: string, thought: Thought) {
  const all = readAll(userId);
  const latest = all
    .filter((version) => version.thoughtId === thought.id)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const contentMatches =
    latest?.title === thought.title && latest.body === thought.body;
  const isTooSoon =
    latest &&
    Date.now() - new Date(latest.createdAt).getTime() <
      MIN_VERSION_INTERVAL_MS;
  if (contentMatches || isTooSoon) return;

  const next = [
    ...all,
    {
      id: crypto.randomUUID(),
      thoughtId: thought.id,
      title: thought.title,
      body: thought.body,
      createdAt: new Date().toISOString(),
    },
  ];
  const versionsForThought = next
    .filter((version) => version.thoughtId === thought.id)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_VERSIONS_PER_THOUGHT);
  const keptIds = new Set(versionsForThought.map((version) => version.id));
  window.localStorage.setItem(
    historyKey(userId),
    JSON.stringify(
      next.filter(
        (version) =>
          version.thoughtId !== thought.id || keptIds.has(version.id),
      ),
    ),
  );
}

export function removeThoughtHistory(userId: string, thoughtId: string) {
  window.localStorage.setItem(
    historyKey(userId),
    JSON.stringify(
      readAll(userId).filter((version) => version.thoughtId !== thoughtId),
    ),
  );
}
