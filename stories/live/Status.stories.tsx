import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

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
import { storyTracks } from "../tracks/tracks.js";
import { STORY_NOW_MS, STORY_STATUSES, storySources } from "./status.js";

// WP-8: the feed status bar in each connection state, the sources panel
// with every source state, the degraded banner with and without the
// frame's ages, age chips, and the frozen overlay over a map whose tracks
// come from the live track store. Both languages, both schemes; nothing
// here says "lost" (C-12), and a disabled source says who (B-11).

const LOST = /lost|დაკარგ/i;

function StatusBars() {
  return (
    <div className="grid gap-2" data-testid="bars">
      {STORY_STATUSES.map(({ label, status }) => (
        <figure key={label} className="m-0 grid gap-1">
          <figcaption className="font-mono text-xs text-muted-foreground">
            {label}
          </figcaption>
          <FeedStatusBar status={status} nowMs={STORY_NOW_MS} />
        </figure>
      ))}
    </div>
  );
}

function Sources(props: { onSwitch?: (...a: unknown[]) => void }) {
  const sources = useMemo(() => storySources(), []);
  return (
    <div style={{ maxWidth: 480 }} data-testid="sources">
      <SourcesPanel
        sources={sources}
        nowMs={STORY_NOW_MS + 5000}
        canSwitch
        onSwitch={props.onSwitch ?? (() => undefined)}
      />
    </div>
  );
}

function Degraded() {
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

function storyBaseUrl(): string {
  const { href, origin, pathname } = window.location;
  return pathname.endsWith("iframe.html") ? new URL(".", href).href : origin;
}

// Display-only sample camera over the committed extract.
const TBILISI = {
  center: [44.799, 41.7015] as [number, number],
  zoom: 12.8,
  bearing: 0,
  pitch: 0,
};

const DOWN = STORY_STATUSES.find((s) => s.label === "down, retrying");

function FrozenMap(props: { scheme: "light" | "dark" }) {
  const { lang } = useLang();
  // The tracks go through the live store, stamped 95 s before the story's
  // clock: the last frame before the feed went down.
  const [store] = useState(() => {
    const s = createTrackStore({
      trailPoints: 20,
      maxTracks: 1000,
      now: () => STORY_NOW_MS - 95_000,
    });
    for (const t of storyTracks()) s.upsert(omit(t, "receivedAtMs"));
    return s;
  });
  const tracks = useStore(store);
  const status = DOWN?.status;
  if (status === undefined) throw new Error("story data");
  return (
    <div className="grid gap-2">
      <FeedStatusBar status={status} nowMs={STORY_NOW_MS} />
      <div
        className="relative"
        style={{ height: 420 }}
        data-testid="frozen-host"
      >
        <MapView
          basemap={{ baseUrl: storyBaseUrl() }}
          initial={TBILISI}
          lang={lang}
          scheme={props.scheme}
        >
          <TrackLayer
            tracks={tracks.values()}
            staleAfterS={status.staleAfterS ?? 30}
            nowMs={STORY_NOW_MS}
          />
        </MapView>
        <FrozenOverlay status={status} nowMs={STORY_NOW_MS} />
      </div>
    </div>
  );
}

const meta = {
  title: "status/Feed and sources",
  component: StatusBars,
} satisfies Meta<typeof StatusBars>;

export default meta;

const barsPlay: StoryObj["play"] = async ({ canvasElement }) => {
  const root = within(canvasElement).getByTestId("bars");
  const states = [...root.querySelectorAll("[data-connection]")].map((e) =>
    e.getAttribute("data-connection"),
  );
  await expect(states).toEqual([
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
  await expect(dropped).toEqual(["0", "0", "0", "17", "0", "0"]);
  await expect(root.textContent).not.toMatch(LOST);
  await expect(root.querySelector('[data-part="session"]')).not.toBeNull();
};

export const StatusBarEnglishLight: StoryObj = {
  render: () => <StatusBars />,
  globals: { lang: "en", scheme: "light" },
  play: barsPlay,
};

export const StatusBarGeorgianDark: StoryObj = {
  render: () => <StatusBars />,
  globals: { lang: "ka", scheme: "dark" },
  play: barsPlay,
};

const sourcesPlay =
  (who: RegExp, silent: RegExp): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("sources");
    const states = new Set(
      [...root.querySelectorAll("[data-source-state]")].map((e) =>
        e.getAttribute("data-source-state"),
      ),
    );
    await expect([...states].sort()).toEqual([...SOURCE_STATES].sort());
    const disabled = root.querySelector(
      'li[data-source="direct_rid/rx-test-05"]',
    );
    await expect(disabled?.textContent).toMatch(who);
    await expect(disabled?.textContent).not.toMatch(silent);
    const stale = root.querySelector('li[data-source="direct_rid/rx-test-03"]');
    await expect(stale?.textContent).toMatch(silent);
    await expect(root.textContent).not.toMatch(LOST);
  };

export const SourcesEnglishLight: StoryObj = {
  render: () => <Sources />,
  globals: { lang: "en", scheme: "light" },
  play: sourcesPlay(/disabled by admin:test-1/, /silent since/),
};

export const SourcesGeorgianDark: StoryObj = {
  render: () => <Sources />,
  globals: { lang: "ka", scheme: "dark" },
  play: sourcesPlay(/admin:test-1/, /დუმს/),
};

const switched = fn();

export const SourceSwitchDialog: StoryObj = {
  render: () => <Sources onSwitch={switched} />,
  globals: { lang: "en", scheme: "light" },
  play: async ({ canvasElement }) => {
    switched.mockClear();
    const root = within(canvasElement);
    await userEvent.click(
      root.getByRole("button", { name: "Switch off rx-test-01" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm" }),
    );
    await expect(switched).not.toHaveBeenCalled();
    await userEvent.type(
      within(dialog).getByLabelText("Reason (required)"),
      "receiver maintenance",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm" }),
    );
    await expect(switched).toHaveBeenCalledTimes(1);
  },
};

const degradedPlay: StoryObj["play"] = async ({ canvasElement }) => {
  const root = within(canvasElement).getByTestId("degraded");
  await expect(root.querySelectorAll("li[data-degraded-key]")).toHaveLength(4);
  await expect(root.querySelectorAll("[data-age-of]")).toHaveLength(5);
  await expect(
    root.querySelector('[data-age-of="cis"]')?.getAttribute("data-over"),
  ).toBe("true");
  await expect(root.textContent).not.toMatch(LOST);
};

export const DegradedEnglishLight: StoryObj = {
  render: () => <Degraded />,
  globals: { lang: "en", scheme: "light" },
  play: degradedPlay,
};

export const DegradedGeorgianDark: StoryObj = {
  render: () => <Degraded />,
  globals: { lang: "ka", scheme: "dark" },
  play: degradedPlay,
};

const frozenPlay: StoryObj["play"] = async ({ canvasElement }) => {
  const host = within(canvasElement).getByTestId("frozen-host");
  const overlay = host.querySelector('[data-overlay="frozen"]');
  await expect(overlay).not.toBeNull();
  await expect(overlay?.textContent).toContain("2026-01-01 11:58:25 UTC");
  await expect(overlay?.textContent).not.toMatch(LOST);
  // The picture stays under the overlay.
  await waitFor(
    () => expect(host.querySelector("canvas, [data-notice]")).not.toBeNull(),
    { timeout: 20000 },
  );
};

export const FrozenOverMapEnglishLight: StoryObj = {
  render: () => <FrozenMap scheme="light" />,
  globals: { lang: "en", scheme: "light" },
  play: frozenPlay,
};

export const FrozenOverMapGeorgianDark: StoryObj = {
  render: () => <FrozenMap scheme="dark" />,
  globals: { lang: "ka", scheme: "dark" },
  play: frozenPlay,
};
