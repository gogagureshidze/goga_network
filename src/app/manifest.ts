import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Goga_Network - Social Media App",
    short_name: "Goga_Net",
    description:
      "Connect, share, and create with Goga_Network — your place for social expression.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#9f1239",
    theme_color: "#fdba74",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/app-preview.png",
        sizes: "1280x720",
        type: "image/png",
        label: "Feed page of Goga_Network",
      },
    ],
    lang: "en",
    categories: ["social", "networking", "lifestyle"],
    scope: "/",
    id: "/",
  };
}
