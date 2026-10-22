import type { MetadataRoute } from "next";
import { MARKE } from "@amtlos/marke";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARKE.name,
    short_name: MARKE.name,
    description: "Alle Pflichten deines Unternehmens: erkannt, erklärt, terminiert.",
    start_url: "/heute",
    display: "standalone",
    background_color: "#f3f3f8",
    theme_color: "#120e3a",
    lang: "de",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
