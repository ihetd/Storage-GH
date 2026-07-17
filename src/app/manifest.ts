import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest — makes the app installable ("Add to Home
// Screen") with a proper name, icon, and fullscreen standalone display.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GymHood Storage",
    short_name: "GymHood",
    description: "Internal stock management",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#080808",
    theme_color: "#080808",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
