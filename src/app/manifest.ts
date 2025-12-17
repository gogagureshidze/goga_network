import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Goga_Network",
    short_name: "Goga_Net",
    description:
      "Connect, share, and create with Goga_Network — your place for social expression.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#9f1239",
    theme_color: "#9f1239",
    icons: [
      {
        src: "/icons/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-96x96.png",
        sizes: "96x96",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-128x128.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-144x144.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-152x152.png",
        sizes: "152x152",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-384x384.png",
        sizes: "384x384",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
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
        src: "/screenshots/app-preview-mobile.png",
        sizes: "540x720",
        type: "image/png",
        form_factor: "narrow",
        label: "Goga_Network Mobile View",
      },
      {
        src: "/screenshots/app-preview-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "Goga_Network Desktop View",
      },
    ],
    lang: "en",
    dir: "ltr",
    categories: ["social", "networking", "lifestyle"],
    scope: "/",
    id: "/",
    prefer_related_applications: false,
  };
}
