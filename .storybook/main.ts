import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: { name: "@storybook/react-vite", options: {} },
  // The committed Tbilisi basemap extract (WP-3), served the way a
  // deployment serves /basemap/ (PLAN §6.3), so map stories make no
  // third-party request.
  staticDirs: [{ from: "../stories/basemap", to: "/basemap" }],
  core: { disableTelemetry: true },
  // Tailwind v4, as the consuming apps run it (PLAN D4), so the vendored
  // shadcn/ui classes and the token utilities exist in the stories.
  viteFinal: (config) => ({
    ...config,
    plugins: [...(config.plugins ?? []), tailwindcss()],
  }),
};

export default config;
