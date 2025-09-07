import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SVWB 確率計算機",
    short_name: "SVWB計算機",
    description: "Shadowverse：Worlds Beyond 確率計算ツール",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f8",
    theme_color: "#111111",
    icons: [
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { src: "/vercel.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/vercel.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" }
    ],
  };
}


