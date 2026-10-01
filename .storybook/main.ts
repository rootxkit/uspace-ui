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
};

export default config;
