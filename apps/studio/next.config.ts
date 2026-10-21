import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Schemas werden zur Laufzeit per Dateipfad gelesen – für das Container-Bundle ausdrücklich mitnehmen
  outputFileTracingIncludes: { "/**": ["../../packages/rules-schema/*.json", "../../packages/rules-schema/*.mjs"] },
  transpilePackages: ["@amtlos/web-kern", "@amtlos/marke"],
  serverExternalPackages: ["pg", "pg-boss", "@amtlos/server", "@amtlos/rules-schema"],
  async headers() {
    return [{ source: "/:pfad*", headers: [{ key: "X-Frame-Options", value: "DENY" }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex" }] }];
  },
};
export default config;
