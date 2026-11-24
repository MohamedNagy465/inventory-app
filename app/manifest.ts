import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "نظام المخزون",
    short_name: "المخزون",
    description: "إدارة المخزون والمبيعات",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f9fafb",
    theme_color: "#0f172a",
    icons: [
  {
    src: "/icon/192",
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: "/icon/512",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
],
  };
}