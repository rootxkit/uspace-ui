import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Three projects (PLAN §9): `node` for pure code, `jsdom` for components,
// `browser` for the stories (Playwright Chromium, axe on every story).
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
        plugins: [storybookTest({ configDir: ".storybook" })],
        test: {
          name: "browser",
          browser: {
            enabled: true,
            headless: true,
            // MapLibre stories render on SwiftShader for smoke only (D9).
            provider: playwright({
              launchOptions: {
                args: ["--use-gl=angle", "--use-angle=swiftshader"],
              },
            }),
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
});
