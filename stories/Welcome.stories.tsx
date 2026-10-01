import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { loadKitFaces, textWidth } from "./i18n/probe.js";
import { Welcome } from "./Welcome.js";

const meta = {
  title: "Welcome",
  component: Welcome,
  args: { entries: ["./model", "./eslint", "./test"] },
} satisfies Meta<typeof Welcome>;

export default meta;

export const EntryPoints: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent(
      "@rootxkit/uspace-ui",
    );
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    // The Georgian run is set in Noto Sans Georgian, from the bundled file.
    const georgian = canvas.getByText("ქართული");
    await expect(await loadKitFaces()).toBe(4);
    const stack = getComputedStyle(georgian).fontFamily;
    await expect(textWidth(canvasElement, stack, "ქართული")).toBe(
      textWidth(canvasElement, '"Noto Sans Georgian"', "ქართული"),
    );
    await expect(textWidth(canvasElement, "serif", "ქართული")).not.toBe(
      textWidth(canvasElement, '"Noto Sans Georgian"', "ქართული"),
    );
  },
};
