import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "3C OS",
    short_name: "3C OS",
    description: "Memória compartilhada entre Claude e ChatGPT.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07060b",
    theme_color: "#07060b",
    lang: "pt-BR",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Buscar", url: "/buscar" },
      { name: "Cérebro", url: "/cerebro" },
    ],
  };
}
