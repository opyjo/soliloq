import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Still — A place for unfinished thoughts",
    short_name: "Still",
    description:
      "A quiet, private writing space to catch thoughts now and continue them later.",
    start_url: "/",
    display: "standalone",
    background_color: "#10120f",
    theme_color: "#10120f",
    orientation: "portrait-primary",
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
