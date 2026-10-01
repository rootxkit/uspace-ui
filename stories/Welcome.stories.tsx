import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

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
  },
};
