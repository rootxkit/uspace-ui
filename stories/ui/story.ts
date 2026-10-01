import type { ReactElement } from "react";
import type { StoryObj } from "@storybook/react-vite";

import { texts, type Texts } from "./texts.js";

export type Story = StoryObj;
export type Play = NonNullable<Story["play"]>;
export type Demo = (t: Texts) => ReactElement;

// One story per scheme for every component (WP-1): the light story in
// English, the dark one in Georgian, so both schemes and both languages
// run axe. The scheme and language come from the preview's globals.
export function light(demo: Demo, extra: Partial<Story> = {}): Story {
  return {
    render: (_args, { globals }) => demo(texts(globals)),
    ...extra,
    globals: { scheme: "light", lang: "en" },
  };
}

export function dark(demo: Demo, extra: Partial<Story> = {}): Story {
  return { ...light(demo, extra), globals: { scheme: "dark", lang: "ka" } };
}
