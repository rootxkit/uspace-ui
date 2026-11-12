import { expect, it } from "vitest";

import type { LiveStatus } from "../../src/live/index.js";
import { FeedStatusBar, FrozenOverlay } from "../../src/status/index.js";
import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";
import { FEED_STATUSES, FIXED_NOW_MS } from "./status.js";

// Review 2026-11-12, F2: a feed that went silent (an open socket with no
// status frame within the bound) is shown as down, with the reason, in
// both languages and both schemes. The pair, a feed that is down for
// another reason, is in status.test.tsx and the golden set.

function silentStatus(): LiveStatus {
  const down = FEED_STATUSES.find((s) => s.status.connection === "down");
  if (down === undefined) throw new Error("no down status in the fixtures");
  return { ...down.status, silent: true, silentAfterS: 30 };
}

function Silent() {
  const status = silentStatus();
  return (
    <div className="grid gap-3">
      <FeedStatusBar status={status} nowMs={FIXED_NOW_MS} />
      <div className="relative h-48 rounded-lg border border-border">
        <FrozenOverlay status={status} nowMs={FIXED_NOW_MS} />
      </div>
    </div>
  );
}

function check(root: HTMLElement, words: RegExp): void {
  const bar = root.querySelector('[data-connection="down"][role="status"]');
  expect(bar?.querySelector('[data-part="silent"]')?.textContent).toMatch(
    words,
  );
  const overlay = root.querySelector('[data-overlay="frozen"]');
  expect(overlay?.querySelector('[data-part="silent"]')?.textContent).toMatch(
    words,
  );
  // C-12: down and retrying, never "lost".
  expect(root.textContent).not.toMatch(/lost|დაკარგ/i);
  // The ordinary state is not there: no live dot, no live word alone.
  expect(root.querySelector('[data-connection="live"]')).toBeNull();
}

it("silent feed (en light)", () => {
  check(
    renderKit(<Silent />, EN_LIGHT).container,
    /^Server silent: no status frame for 30 s$/,
  );
});

it("silent feed (ka dark)", () => {
  check(renderKit(<Silent />, KA_DARK).container, /სერვერი დუმს.*30/);
});
