import type { Thought } from "@/lib/database.types";
import { deriveThoughtTitle } from "@/lib/utils";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "because",
  "been",
  "before",
  "being",
  "but",
  "can",
  "could",
  "did",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "into",
  "its",
  "just",
  "more",
  "not",
  "now",
  "our",
  "should",
  "some",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "through",
  "too",
  "very",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const CONCEPT_GROUPS = [
  ["build", "create", "design", "make", "craft", "develop"],
  ["idea", "concept", "thought", "insight", "notion"],
  ["work", "career", "job", "business", "project"],
  ["learn", "study", "read", "understand", "knowledge"],
  ["feel", "emotion", "mood", "heart", "sense"],
  ["goal", "plan", "aim", "direction", "future"],
  ["problem", "challenge", "issue", "obstacle", "risk"],
  ["friend", "people", "team", "community", "relationship"],
  ["calm", "quiet", "still", "rest", "peace"],
];

const SYNONYM_LOOKUP = new Map<string, Set<string>>();
for (const group of CONCEPT_GROUPS) {
  for (const word of group) {
    SYNONYM_LOOKUP.set(word, new Set(group));
  }
}

const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;
const TAG_PATTERN = /#[\p{L}\p{N}_-]+/gu;
const WIKI_PATTERN = /\[\[([^\]]+)\]\]/g;

export type ThoughtConnection = {
  sourceId: string;
  targetId: string;
  strength: number;
  reason: "wiki" | "tag" | "meaning";
};

export type ThoughtGraph = {
  nodes: Array<{
    id: string;
    title: string;
    x: number;
    y: number;
    size: number;
    status: Thought["status"];
  }>;
  edges: ThoughtConnection[];
};

export type ThoughtTemplate = {
  id: string;
  name: string;
  description: string;
  title: string;
  body: string;
};

export const THOUGHT_TEMPLATES: ThoughtTemplate[] = [
  {
    id: "daily-note",
    name: "Daily note",
    description: "Clear the mental desk and choose one direction.",
    title: "Daily note",
    body: "## What is present?\n\n\n## What matters today?\n\n\n## One small next move\n\n",
  },
  {
    id: "decision",
    name: "Decision canvas",
    description: "Separate facts, assumptions, tradeoffs, and the next test.",
    title: "Decision: ",
    body: "## Decision\n\n\n## What I know\n\n- \n\n## Assumptions\n\n- \n\n## Tradeoffs\n\n- \n\n## Smallest useful test\n\n",
  },
  {
    id: "idea-garden",
    name: "Idea garden",
    description: "Grow an early idea without forcing a conclusion.",
    title: "Idea: ",
    body: "## Spark\n\n\n## Why it might matter\n\n\n## Connections\n\n- [[Related thought]]\n\n## Next experiment\n\n",
  },
  {
    id: "meeting",
    name: "Meeting notes",
    description: "Capture outcomes, owners, and open questions.",
    title: "Meeting — ",
    body: "## Context\n\n\n## Decisions\n\n- \n\n## Actions\n\n- [ ] \n\n## Open questions\n\n- \n",
  },
  {
    id: "weekly-review",
    name: "Weekly review",
    description: "Notice momentum, friction, and what to carry forward.",
    title: "Weekly reflection",
    body: "## What moved\n\n\n## What kept returning\n\n\n## What felt difficult\n\n\n## What I will carry forward\n\n",
  },
  {
    id: "book-note",
    name: "Source note",
    description: "Turn reading or listening into connected insight.",
    title: "Notes on ",
    body: "## Source\n\n\n## Essential idea\n\n\n## In my own words\n\n\n## Connections\n\n- [[Related thought]]\n\n## What changes now?\n\n",
  },
];

function tokenize(value: string) {
  return (value.toLowerCase().match(TOKEN_PATTERN) ?? []).filter(
    (token) => token.length > 2 && !STOP_WORDS.has(token),
  );
}

function thoughtText(thought: Thought) {
  return `${thought.title ?? ""} ${thought.body}`;
}

function tokenSet(value: string) {
  return new Set(tokenize(value));
}

export function extractTags(body: string) {
  return Array.from(
    new Set((body.match(TAG_PATTERN) ?? []).map((tag) => tag.toLowerCase())),
  );
}

export function getThoughtMood(thought: Thought) {
  return (
    extractTags(thought.body)
      .find((tag) => tag.startsWith("#mood-"))
      ?.replace("#mood-", "") ?? null
  );
}

export function thoughtSimilarity(first: Thought, second: Thought) {
  const a = tokenSet(thoughtText(first));
  const b = tokenSet(thoughtText(second));
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const token of a) {
    if (b.has(token)) {
      shared += 1;
      continue;
    }
    const concepts = SYNONYM_LOOKUP.get(token);
    if (concepts && Array.from(concepts).some((word) => b.has(word))) {
      shared += 0.55;
    }
  }
  return shared / Math.sqrt(a.size * b.size);
}

export function rankThoughts(thoughts: Thought[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return thoughts;
  const queryTokens = tokenize(normalized);

  return thoughts
    .map((thought) => {
      const title = (thought.title ?? "").toLowerCase();
      const body = thought.body.toLowerCase();
      const tags = extractTags(body);
      const words = tokenSet(`${title} ${body}`);
      let score = 0;

      if (title === normalized) score += 18;
      if (title.includes(normalized)) score += 10;
      if (body.includes(normalized)) score += 6;
      if (tags.includes(normalized.startsWith("#") ? normalized : `#${normalized}`)) {
        score += 12;
      }

      for (const token of queryTokens) {
        if (words.has(token)) {
          score += title.includes(token) ? 4 : 2;
        } else {
          const concepts = SYNONYM_LOOKUP.get(token);
          if (concepts && Array.from(concepts).some((word) => words.has(word))) {
            score += 1.2;
          }
        }
      }

      return { thought, score };
    })
    .filter((item) => item.score > 0)
    .toSorted(
      (a, b) =>
        b.score - a.score ||
        b.thought.updated_at.localeCompare(a.thought.updated_at),
    )
    .map((item) => item.thought);
}

export function getConnections(thoughts: Thought[]) {
  const edges = new Map<string, ThoughtConnection>();
  const titleIndex = new Map(
    thoughts.map((thought) => [
      (thought.title ?? deriveThoughtTitle(thought.body)).trim().toLowerCase(),
      thought,
    ]),
  );

  function addEdge(connection: ThoughtConnection) {
    const ids = [connection.sourceId, connection.targetId].toSorted();
    const key = ids.join(":");
    const current = edges.get(key);
    if (!current || current.strength < connection.strength) {
      edges.set(key, connection);
    }
  }

  for (const thought of thoughts) {
    for (const match of thought.body.matchAll(WIKI_PATTERN)) {
      const target = titleIndex.get(match[1].trim().toLowerCase());
      if (target && target.id !== thought.id) {
        addEdge({
          sourceId: thought.id,
          targetId: target.id,
          strength: 1,
          reason: "wiki",
        });
      }
    }
  }

  for (let firstIndex = 0; firstIndex < thoughts.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < thoughts.length;
      secondIndex += 1
    ) {
      const first = thoughts[firstIndex];
      const second = thoughts[secondIndex];
      const sharedTags = extractTags(first.body).filter((tag) =>
        extractTags(second.body).includes(tag),
      );
      if (sharedTags.length > 0) {
        addEdge({
          sourceId: first.id,
          targetId: second.id,
          strength: Math.min(0.9, 0.58 + sharedTags.length * 0.12),
          reason: "tag",
        });
        continue;
      }
      const similarity = thoughtSimilarity(first, second);
      if (similarity >= 0.24) {
        addEdge({
          sourceId: first.id,
          targetId: second.id,
          strength: Math.min(0.82, similarity),
          reason: "meaning",
        });
      }
    }
  }

  return Array.from(edges.values());
}

export function buildThoughtGraph(thoughts: Thought[]): ThoughtGraph {
  const visible = thoughts
    .filter((thought) => thought.status !== "archived")
    .slice(0, 40);
  const centerX = 400;
  const centerY = 260;
  const nodes = visible.map((thought, index) => {
    const ring = Math.floor(index / 9) + 1;
    const slot = index % 9;
    const angle = (slot / Math.min(9, visible.length)) * Math.PI * 2 + ring;
    const radius = index === 0 ? 0 : 82 + ring * 74;
    const words = tokenize(thoughtText(thought)).length;
    return {
      id: thought.id,
      title: thought.title?.trim() || deriveThoughtTitle(thought.body),
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius * 0.72,
      size: Math.min(22, 9 + Math.sqrt(words)),
      status: thought.status,
    };
  });
  const visibleIds = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: getConnections(visible).filter(
      (edge) =>
        visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId),
    ),
  };
}

export function rankForResurfacing(thoughts: Thought[], now = Date.now()) {
  return thoughts
    .filter(
      (thought) =>
        thought.status !== "archived" && thought.status !== "finished",
    )
    .map((thought) => {
      const ageDays = Math.max(
        0,
        (now - new Date(thought.updated_at).getTime()) / 86_400_000,
      );
      const wordCount = tokenize(thought.body).length;
      const due =
        thought.review_at !== null &&
        new Date(thought.review_at).getTime() <= now;
      const unresolved =
        /\?|todo|next|decide|maybe|explore|consider/i.test(thought.body);
      const score =
        Math.min(ageDays, 45) * 0.9 +
        Math.min(wordCount, 200) * 0.035 +
        (due ? 30 : 0) +
        (unresolved ? 9 : 0) +
        (thought.status === "developing" ? 6 : 0) -
        (thought.is_pinned ? 2 : 0);
      const reason = due
        ? "You asked to see this again"
        : unresolved
          ? "It still contains an open thread"
          : ageDays > 14
            ? "It has been quiet for a while"
            : "It has room to grow";
      return { thought, score, reason };
    })
    .toSorted((a, b) => b.score - a.score);
}

export function findDuplicatePairs(thoughts: Thought[]) {
  const pairs: Array<{ first: Thought; second: Thought; score: number }> = [];
  for (let firstIndex = 0; firstIndex < thoughts.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < thoughts.length;
      secondIndex += 1
    ) {
      const score = thoughtSimilarity(
        thoughts[firstIndex],
        thoughts[secondIndex],
      );
      if (score >= 0.48) {
        pairs.push({
          first: thoughts[firstIndex],
          second: thoughts[secondIndex],
          score,
        });
      }
    }
  }
  return pairs.toSorted((a, b) => b.score - a.score).slice(0, 8);
}

export function getWritingActivity(thoughts: Thought[], days = 84) {
  const counts = new Map<string, number>();
  for (const thought of thoughts) {
    const key = thought.updated_at.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = new Date();
  const activity = Array.from({ length: days }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - offset - 1));
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: counts.get(key) ?? 0 };
  });

  let streak = 0;
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    if (activity[index].count === 0) {
      if (index === activity.length - 1) continue;
      break;
    }
    streak += 1;
  }
  return { activity, streak };
}

export function getWeeklyReflection(thoughts: Thought[]) {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recent = thoughts.filter(
    (thought) => new Date(thought.updated_at).getTime() >= weekAgo,
  );
  const tags = new Map<string, number>();
  recent.forEach((thought) =>
    extractTags(thought.body).forEach((tag) =>
      tags.set(tag, (tags.get(tag) ?? 0) + 1),
    ),
  );
  const topTags = Array.from(tags.entries())
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
  const words = recent.reduce(
    (total, thought) => total + tokenize(thought.body).length,
    0,
  );
  const developing = recent.filter(
    (thought) => thought.status === "developing",
  ).length;

  if (recent.length === 0) {
    return "This week is still open. Capture one honest sentence and let the pattern begin.";
  }

  const theme = topTags.length
    ? ` The themes returning most often were ${topTags.join(", ")}.`
    : "";
  return `You returned to ${recent.length} ${recent.length === 1 ? "thought" : "thoughts"} and wrote about ${words} meaningful words. ${developing} ${developing === 1 ? "thread is" : "threads are"} actively developing.${theme}`;
}
