// The example's Next.js configuration (docs/PLAN.md §7, §11): standalone
// output for the image, no `transpilePackages` (the kit ships compiled
// ESM), and the security headers every response carries. The Content
// Security Policy is set per request, with its nonce, in proxy.ts.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));
// In the kit's repository the kit is linked from the root, two levels up
// (pnpm workspace), so tracing and Turbopack start there; in a Docker
// build the app is alone in its context.
const repo = path.resolve(here, "../..");
const root = existsSync(path.join(repo, "pnpm-workspace.yaml")) ? repo : here;

// A deployment's Caddy serves /basemap/* from the shared volume (PLAN
// §6.3, §11) and this app serves no tiles. For the smoke test only,
// EXAMPLE_BASEMAP_ORIGIN at build time sends /basemap/* to a local server
// of the browser tests' extract (scripts/smoke.mjs); the browser still
// sees one origin, so `connect-src 'self'` holds.
const basemapOrigin = process.env["EXAMPLE_BASEMAP_ORIGIN"] ?? "";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  turbopack: { root },
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    if (basemapOrigin === "") return [];
    return [
      {
        source: "/basemap/:path*",
        destination: `${basemapOrigin.replace(/\/$/, "")}/basemap/:path*`,
      },
    ];
  },
};

export default config;
