import { waitFor, within } from "@testing-library/react";
import { useMemo, useState } from "react";
import { expect } from "vitest";

import { useLang } from "../../src/i18n/index.js";
import { TrackLayer } from "../../src/layers/index.js";
import { createTrackStore, useStore } from "../../src/live/index.js";
import { MapView } from "../../src/map/index.js";
import { SOURCE_STATES } from "../../src/model/index.js";
import {
  AgeChip,
  DegradedBanner,
  FeedStatusBar,
  FrozenOverlay,
  SourcesPanel,
} from "../../src/status/index.js";
import "../../styles/map.css";
import { omit } from "../../src/live/test/omit.js";
import { basemapBaseUrl } from "../map/basemap.js";
import { fixtureTracks } from "../tracks/tracks.js";
import { FIXED_NOW_MS, FEED_STATUSES, fixtureSources } from "./status.js";

// WP-8: the feed status bar in each connection state, the sources panel
// with every source state, the degraded banner with and without the
// frame's ages, age chips, and the frozen overlay over a map whose tracks
// come from the live track store. Both languages, both schemes; nothing
// here says "lost" (C-12), and a disabled source says who (B-11). Shared
// by status.test.tsx and the golden set.

export const LOST = /lost|დაკარგ/i;

export function StatusBars() {
  return (
    <div className="grid gap-2" data-testid="bars">
      {FEED_STATUSES.map(({ label, status }) => (
        <figure key={label} className="m-0 grid gap-1">
          <figcaption className="font-mono text-xs text-muted-foreground">
            {label}
          </figcaption>
          <FeedStatusBar status={status} nowMs={FIXED_NOW_MS} />
        </figure>
      ))}
    </div>
  );
}

export function Sources(props: { onSwitch?: (...a: unknown[]) => void }) {
  const sources = useMemo(() => fixtureSources(), []);
  return (
    <div style={{ maxWidth: 480 }} data-testid="sources">
      <SourcesPanel
        sources={sources}
        nowMs={FIXED_NOW_MS + 5000}
        canSwitch
        onSwitch={props.onSwitch ?? (() => undefined)}
      />
    </div>
  );
}

export function Degraded() {
  return (
    <div className="grid max-w-lg gap-3" data-testid="degraded">
      <DegradedBanner
        degraded={["manned", "dss", "source_disabled", "nats_reconnecting"]}
        cisAgeS={312}
        cisStaleBoundS={300}
        datasets={{
          zones: { version: "zones-test-7", ageS: 812.5 },
          uspace_airspace: { version: "uspace-test-2", ageS: 160233 },
        }}
        projectionAgeS={1.2}
      />
      <DegradedBanner degraded={[]} cisAgeS={14} />
      <div className="flex flex-wrap gap-2">
        <AgeChip ageS={2} staleAfterS={30} />
        <AgeChip ageS={15} staleAfterS={30} />
        <AgeChip ageS={45} staleAfterS={30} />
        <AgeChip ageS={45} staleAfterS={null} />
        <AgeChip ageS={null} staleAfterS={30} />
      </div>
    </div>
  );
}

// Display-only sample camera over the committed extract.
const TBILISI = {
  center: [44.799, 41.7015] as [number, number],
  zoom: 12.8,
  bearing: 0,
  pitch: 0,
};

const DOWN = FEED_STATUSES.find((s) => s.label === "down, retrying");

export function FrozenMap(props: { scheme: "light" | "dark" }) {
  const { lang } = useLang();
  // The tracks go through the live store, stamped 95 s before the tests'
  // clock: the last frame before the feed went down.
  const [store] = useState(() => {
    const s = createTrackStore({
      trailPoints: 20,
      maxTracks: 1000,
      now: () => FIXED_NOW_MS - 95_000,
    });
    for (const t of fixtureTracks()) s.upsert(omit(t, "receivedAtMs"));
    return s;
  });
  const tracks = useStore(store);
  const status = DOWN?.status;
  if (status === undefined) throw new Error("test data");
  return (
    <div className="grid gap-2">
      <FeedStatusBar status={status} nowMs={FIXED_NOW_MS} />
      <div
        className="relative"
        style={{ height: 420 }}
        data-testid="frozen-host"
      >
        <MapView
          basemap={{ baseUrl: basemapBaseUrl() }}
          initial={TBILISI}
          lang={lang}
          scheme={props.scheme}
        >
          <TrackLayer
            tracks={tracks.values()}
            staleAfterS={status.staleAfterS ?? 30}
            nowMs={FIXED_NOW_MS}
          />
        </MapView>
        <FrozenOverlay status={status} nowMs={FIXED_NOW_MS} />
      </div>
    </div>
  );
}

export function checkBars(canvasElement: HTMLElement): void {
  const root = within(canvasElement).getByTestId("bars");
  const states = [...root.querySelectorAll("[data-connection]")].map((e) =>
    e.getAttribute("data-connection"),
  );
  expect(states).toEqual([
    "connecting",
    "live",
    "live",
    "live",
    "down",
    "down",
  ]);
  const dropped = [...root.querySelectorAll('[data-part="dropped"]')].map((e) =>
    e.getAttribute("data-dropped"),
  );
  // "0 dropped" is shown, not left out (05 §5).
  expect(dropped).toEqual(["0", "0", "0", "17", "0", "0"]);
  expect(root.textContent).not.toMatch(LOST);
  expect(root.querySelector('[data-part="session"]')).not.toBeNull();
}

export function checkSources(
  canvasElement: HTMLElement,
  who: RegExp,
  silent: RegExp,
): void {
  const root = within(canvasElement).getByTestId("sources");
  const states = new Set(
    [...root.querySelectorAll("[data-source-state]")].map((e) =>
      e.getAttribute("data-source-state"),
    ),
  );
  expect([...states].sort()).toEqual([...SOURCE_STATES].sort());
  const disabled = root.querySelector(
    'li[data-source="direct_rid/rx-test-05"]',
  );
  expect(disabled?.textContent).toMatch(who);
  expect(disabled?.textContent).not.toMatch(silent);
  const stale = root.querySelector('li[data-source="direct_rid/rx-test-03"]');
  expect(stale?.textContent).toMatch(silent);
  expect(root.textContent).not.toMatch(LOST);
}

export function checkDegraded(canvasElement: HTMLElement): void {
  const root = within(canvasElement).getByTestId("degraded");
  expect(root.querySelectorAll("li[data-degraded-key]")).toHaveLength(4);
  expect(root.querySelectorAll("[data-age-of]")).toHaveLength(5);
  expect(
    root.querySelector('[data-age-of="cis"]')?.getAttribute("data-over"),
  ).toBe("true");
  expect(root.textContent).not.toMatch(LOST);
}

export async function checkFrozen(canvasElement: HTMLElement): Promise<void> {
  const host = within(canvasElement).getByTestId("frozen-host");
  const overlay = host.querySelector('[data-overlay="frozen"]');
  expect(overlay).not.toBeNull();
  expect(overlay?.textContent).toContain("2026-01-01 11:58:25 UTC");
  expect(overlay?.textContent).not.toMatch(LOST);
  // The picture stays under the overlay.
  await waitFor(
    () => expect(host.querySelector("canvas, [data-notice]")).not.toBeNull(),
    { timeout: 20000 },
  );
}
