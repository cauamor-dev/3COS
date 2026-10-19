import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import evaluationSources from "./lib/chloe/evaluation-sources.json";

const evaluationBuild = createHash("sha256");
for (const file of evaluationSources)
  evaluationBuild.update(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));

const nextConfig: NextConfig = {
  env: { CHLOE_EVALUATION_BUILD: evaluationBuild.digest("hex") },
  experimental: { turbopackFileSystemCacheForDev: false },
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/conexoes": ["./docs/*-instrucoes.md"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
