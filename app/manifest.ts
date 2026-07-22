import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "hantverkare — KI-Angebote für Handwerker",
    short_name: "hantverkare",
    description: "KI-gestützte Angebote für Handwerker",
    start_url: "/quotes/new",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#2563eb",
    lang: "de",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
