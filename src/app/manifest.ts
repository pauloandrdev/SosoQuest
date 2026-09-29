import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caderno de Questões",
    short_name: "Caderno",
    description: "Cadernos de questões com gabarito e histórico de notas.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4f8",
    theme_color: "#2741c2",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
