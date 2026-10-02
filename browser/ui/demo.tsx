import type { ReactElement } from "react";
import { it } from "vitest";

import { LOOKS, lookName, renderKit, type Look } from "../kit.js";
import { TEXTS, type Texts } from "./texts.js";

/** A component shown with sample text in the look's language. */
export type Demo = (t: Texts) => ReactElement;

/** What a test checks once the demo is on the page. */
export type Check = (canvas: HTMLElement, look: Look) => void | Promise<void>;

/**
 * One test per look for every component (WP-1): light in English and dark
 * in Georgian, so both schemes and both languages run axe (after the
 * check, in browser/setup.ts).
 */
export function testDemo(name: string, demo: Demo, check?: Check): void {
  for (const look of LOOKS) {
    it(`${name} (${lookName(look)})`, async () => {
      const { container } = renderKit(demo(TEXTS[look.lang]), look);
      await check?.(container, look);
    });
  }
}
