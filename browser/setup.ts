// Setup of the `browser` project (vitest.config.ts): the stylesheet a
// consuming app loads, then two checks after every test, run on whatever
// the test left on the page.
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect } from "vitest";

import {
  i18nCounters,
  missingKeys,
  resetI18nCounters,
} from "../src/i18n/index.js";
import { axeCheck } from "../src/test/axe.js";
import "./kit.css";

// The longest a test waits for the page's transitions before axe runs
// (test-only bound).
const SETTLE_TIMEOUT_MS = 2000;

/**
 * Waits for the CSS transitions and finite animations on the page to end
 * (a toast fading in, the colours of a scheme change), so axe judges the
 * colours a user is left looking at, not a frame in between.
 */
async function settled(): Promise<void> {
  const running = document
    .getAnimations()
    .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
  await Promise.race([
    Promise.allSettled(running.map((a) => a.finished)),
    new Promise((resolve) => setTimeout(resolve, SETTLE_TIMEOUT_MS)),
  ]);
}

beforeEach(() => {
  resetI18nCounters();
});

afterEach(async () => {
  try {
    // Every rendering passes axe at WCAG 2.2 AA, portals included, in the
    // state the test left it (an open dialog is checked open). A
    // violation fails the test.
    await settled();
    await axeCheck(document.body);
    // Every key a rendering used is present in its language: a `ka`
    // rendering that fell back to English, or any that showed a key,
    // fails here (WP-2 done-when: missingKeys() is 0 for the kit's own
    // components).
    expect(missingKeys(), JSON.stringify(i18nCounters())).toBe(0);
  } finally {
    cleanup();
  }
});
