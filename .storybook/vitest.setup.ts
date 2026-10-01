import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from "@storybook/react-vite";
import { afterEach, beforeEach, expect } from "vitest";

import {
  i18nCounters,
  missingKeys,
  resetI18nCounters,
} from "../src/i18n/index.js";
import * as projectAnnotations from "./preview.js";

setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);

// Every story renders with every key it uses present in its language: a
// `ka` story that fell back to English, or any story that showed a key,
// fails here (WP-2 done-when: missingKeys() is 0 for the kit's stories).
beforeEach(() => {
  resetI18nCounters();
});

afterEach(() => {
  expect(missingKeys(), JSON.stringify(i18nCounters())).toBe(0);
});
