import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Still — A place for unfinished thoughts",
    short_name: "Still",
    description:
      "A quiet, private writing space to catch thoughts now and continue them later.",
    start_url: "/",
    display: "standalone",
    background_color: "#08090c",
    theme_color: "#08090c",
    orientation: "portrait-primary",
    shortcuts: [
      {
        name: "Quick capture",
        short_name: "Capture",
        description: "Start a new thought immediately",
        url: "/?capture=1",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Thinking Studio",
        short_name: "Studio",
        description: "Open your graph, resurfacing, and reflections",
        url: "/?studio=1",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
