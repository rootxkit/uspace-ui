import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

/**
 * Test-only browser command: emulates `prefers-color-scheme` in the
 * page (Playwright `emulateMedia`); null restores the default. The theme
 * tests use it to see the first paint before ThemeProvider has run
 * (docs/ACCESSIBILITY.md A5).
 */
const emulateColorScheme: BrowserCommand<
  [scheme: "light" | "dark" | null]
> = async (ctx, scheme) => {
  await ctx.page.emulateMedia({ colorScheme: scheme });
};

// Three projects (PLAN §9): `node` for pure code, `jsdom` for components,
// `browser` for components in a real browser (Playwright Chromium, axe
// after every test) and the DOM snapshots of the golden set.
export default defineConfig({
  test: {
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.testing.ts",
        "src/**/*.d.ts",
        // The MapLibre mock for jsdom (WP-3), shared with the layer WPs.
        "src/map/test/**",
        // The api fixtures, generated types and test helpers (WP-4).
        "src/api/test/**",
        // The mock WebSocket server and its fixtures (WP-8).
        "src/live/test/**",
      ],
      reporter: ["text", "text-summary", "json-summary"],
      thresholds: { statements: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
      {
        extends: true,
        plugins: [tailwindcss()],
        // The committed Tbilisi basemap extract (WP-3) is served at
        // /basemap/, the way a deployment serves it (PLAN §6.3), so the map
        // tests make no third-party request.
        publicDir: "browser/public",
        test: {
          name: "browser",
          include: ["browser/**/*.test.tsx"],
          // A map test waits for tiles and glyphs on SwiftShader.
          testTimeout: 30000,
          browser: {
            enabled: true,
            headless: true,
            // MapLibre renders on SwiftShader for smoke only (D9).
            provider: playwright({
              launchOptions: {
                args: ["--use-gl=angle", "--use-angle=swiftshader"],
              },
            }),
            instances: [{ browser: "chromium" }],
            commands: { emulateColorScheme },
          },
          setupFiles: ["browser/setup.ts"],
        },
      },
    ],
  },
});
