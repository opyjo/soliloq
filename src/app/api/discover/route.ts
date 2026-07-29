import { NextResponse } from "next/server";

export type DiscoverItem = {
  id: string;
  title: string;
  description: string;
  url: string;
  source: "Hacker News" | "GitHub Trending";
  author?: string;
  score?: number;
  tags: string[];
  createdAt: string;
};

export async function GET() {
  try {
    const items: DiscoverItem[] = [];

    // 1. Fetch Show HN stories from HackerNews API
    try {
      const hnRes = await fetch(
        "https://hacker-news.firebaseio.com/v0/showstories.json",
        { next: { revalidate: 900 } }
      );
      if (hnRes.ok) {
        const ids: number[] = await hnRes.json();
        const topIds = ids.slice(0, 10);

        const storyPromises = topIds.map(async (id) => {
          const itemRes = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
            { next: { revalidate: 900 } }
          );
          if (itemRes.ok) {
            const data = await itemRes.json();
            if (data && data.title) {
              return {
                id: `hn-${data.id}`,
                title: data.title.replace(/^Show HN:\s*/i, ""),
                description: `Show HN post by ${data.by || "anonymous"} with ${data.score || 0} points and ${data.descendants || 0} comments.`,
                url: data.url || `https://news.ycombinator.com/item?id=${data.id}`,
                source: "Hacker News" as const,
                author: data.by,
                score: data.score,
                tags: ["Indie Project", "Show HN"],
                createdAt: new Date(data.time * 1000).toISOString(),
              };
            }
          }
          return null;
        });

        const fetchedStories = (await Promise.all(storyPromises)).filter(
          Boolean
        ) as DiscoverItem[];
        items.push(...fetchedStories);
      }
    } catch (e) {
      console.warn("Failed to fetch HackerNews feed", e);
    }

    // 2. Fetch GitHub Trending Repositories
    try {
      const ghRes = await fetch(
        "https://api.github.com/search/repositories?q=created:>2026-01-01+stars:>50&sort=stars&order=desc&per_page=10",
        {
          headers: {
            "User-Agent": "Still-Thought-App",
            Accept: "application/vnd.github.v3+json",
          },
          next: { revalidate: 1800 },
        }
      );
      if (ghRes.ok) {
        const ghData = await ghRes.json();
        if (ghData.items && Array.isArray(ghData.items)) {
          const ghItems: DiscoverItem[] = ghData.items.map((repo: {
            id: number;
            name: string;
            description: string;
            html_url: string;
            owner: { login: string };
            stargazers_count: number;
            language: string;
            created_at: string;
          }) => ({
            id: `gh-${repo.id}`,
            title: repo.name,
            description: repo.description || "Exciting open source repository.",
            url: repo.html_url,
            source: "GitHub Trending" as const,
            author: repo.owner?.login,
            score: repo.stargazers_count,
            tags: [repo.language || "Open Source", "GitHub"].filter(Boolean),
            createdAt: repo.created_at || new Date().toISOString(),
          }));
          items.push(...ghItems);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch GitHub feed", e);
    }

    // Fallback static curated items if live network feeds fail
    if (items.length === 0) {
      items.push(
        {
          id: "fallback-1",
          title: "Obsidian Canvas & Spatial Thinking",
          description: "Visual canvas for connecting markdown notes, images, PDFs, and web pages in an infinite space.",
          url: "https://obsidian.md/canvas",
          source: "Hacker News",
          tags: ["Spatial Notes", "PKM"],
          createdAt: new Date().toISOString(),
        },
        {
          id: "fallback-2",
          title: "Tauri v2 - Cross Platform Apps",
          description: "Build ultra-fast, lightweight desktop & mobile applications using web technologies and Rust.",
          url: "https://tauri.app",
          source: "GitHub Trending",
          score: 18400,
          tags: ["Rust", "Web Tech"],
          createdAt: new Date().toISOString(),
        }
      );
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch discovery items" },
      { status: 500 }
    );
  }
}
