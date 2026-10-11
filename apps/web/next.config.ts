import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  transpilePackages: ["@amtlos/i18n", "@amtlos/web-kern"],
  // Belege bis 15 MB (die API begrenzt ebenfalls auf 15 MB)
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  async headers() {
    return [
      {
        source: "/:pfad*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=()" },
        ],
      },
    ];
  },
};
export default config;
