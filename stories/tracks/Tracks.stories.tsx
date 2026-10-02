import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { useLang, useT } from "../../src/i18n/index.js";
import { TrackLayer, trackLayerIds } from "../../src/layers/index.js";
import {
  AgeLegend,
  IdentificationLegend,
  SeverityLegend,
  TrackLegend,
} from "../../src/legend/index.js";
import { MapView } from "../../src/map/index.js";
import {
  IDENT_BASES,
  IDENT_REASONS,
  IDENT_STATUSES,
  SEVERITIES,
  TRUSTS,
  type Trust,
} from "../../src/model/index.js";
import {
  IDENT_BASIS_KEYS,
  identDrawn,
  identHintKey,
  identOrder,
  type IdentKey,
} from "../../src/symbology/index.js";
import { AGE_BUCKETS } from "../../src/theme/index.js";
import "../../styles/map.css";
import {
  EMERGENCY_TRACK,
  MISMATCH_TRACK,
  STORY_NOW_MS,
  STORY_STALE_AFTER_S,
  storyHistory,
  storyTracks,
} from "./tracks.js";

// WP-7: the fixture sky over the Tbilisi extract (every trust class
// against every identification status, ages across the buckets, an
// emergency, a mismatch, a trail), the four legends, and the
// identification wording for every reason and basis, in both languages
// and both schemes. The map stories run on SwiftShader for smoke only
// (PLAN D9): the play functions check what MapLibre holds and what the
// legends render, never pixels.

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

interface Loaded {
  map: MapLibreMap;
  errors: string[];
}
const maps = new WeakMap<Element, Loaded>();

function Legends() {
  const tracks = useMemo(() => storyTracks(), []);
  // The app counts what it shows; the legends display the counts.
  const trust: Partial<Record<Trust, number>> = {};
  const ident: Partial<Record<IdentKey, number>> = {};
  for (const t of tracks) {
    trust[t.trust] = (trust[t.trust] ?? 0) + 1;
    const s = identDrawn(t.identification);
    ident[s] = (ident[s] ?? 0) + 1;
  }
  return (
    <div className="grid gap-3" data-testid="legends">
      <TrackLegend counts={trust} />
      <IdentificationLegend counts={ident} />
      <AgeLegend staleAfterS={STORY_STALE_AFTER_S} />
      <SeverityLegend />
    </div>
  );
}

function TrackMap(props: { scheme: "light" | "dark" }) {
  const { lang } = useLang();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const base = useMemo(() => storyTracks(), []);
  const [tracks, setTracks] = useState(base);
  // After the first frame, the first track's history arrives: two backlog
  // samples and a newer live one, which draw its trail.
  useEffect(() => {
    const first = base[0];
    if (first === undefined) return;
    const id = setTimeout(() => {
      setTracks([...storyHistory(first), ...base.slice(1)]);
    }, 50);
    return () => clearTimeout(id);
  }, [base]);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_20rem]">
      <div ref={setHost} style={{ height: 520 }} data-testid="map-host">
        <MapView
          basemap={{ baseUrl: storyBaseUrl() }}
          initial={TBILISI}
          lang={lang}
          scheme={props.scheme}
          onLoad={(m) => {
            if (host === null) return;
            const errors: string[] = [];
            m.on("error", (e: { error?: Error }) => {
              errors.push(String(e.error?.message ?? e.error));
            });
            maps.set(host, { map: m, errors });
            host.setAttribute("data-loaded", "true");
          }}
        >
          <TrackLayer
            tracks={tracks}
            staleAfterS={STORY_STALE_AFTER_S}
            nowMs={STORY_NOW_MS}
            selectedId={selected}
            onSelect={setSelected}
            trails={{ points: 20 }}
          />
        </MapView>
      </div>
      <Legends />
    </div>
  );
}

const meta = {
  title: "layers/Tracks",
  component: TrackMap,
  args: { scheme: "light" },
} satisfies Meta<typeof TrackMap>;

export default meta;
type Story = StoryObj<typeof meta>;

async function loaded(canvasElement: HTMLElement): Promise<Loaded> {
  const host = within(canvasElement).getByTestId("map-host");
  await waitFor(() => expect(host.getAttribute("data-loaded")).toBe("true"), {
    timeout: 20000,
  });
  const l = maps.get(host);
  if (l === undefined) throw new Error("onLoad did not hand over the map");
  return l;
}

const ids = trackLayerIds("us-tracks");

type Props = Record<string, unknown>;

/** Every enumeration value the legends must render, by row attribute. */
async function legendsCoverEverything(root: HTMLElement): Promise<void> {
  const values = (attr: string) =>
    [...root.querySelectorAll<HTMLElement>(`li[data-${attr}]`)].map(
      (li) => li.dataset[attr],
    );
  await expect(values("trust")).toEqual([...TRUSTS]);
  await expect(values("ident")).toEqual([...identOrder()]);
  await expect(values("age")).toEqual([...AGE_BUCKETS]);
  await expect([...values("severity")].sort()).toEqual([...SEVERITIES].sort());
}

const mapPlay: Story["play"] = async ({ canvasElement }) => {
  const { map, errors } = await loaded(canvasElement);
  for (const id of Object.values(ids).filter((x) => x !== "us-tracks")) {
    await expect(map.getLayer(id)).toBeDefined();
  }
  await expect(map.hasImage("us-track-broadcast")).toBe(true);
  await expect(map.hasImage("us-track-broadcast-dir")).toBe(true);
  // Walk the fixture as MapLibre holds it: every trust class, every drawn
  // status, every age bucket the sky spreads, the emergency, the mismatch,
  // a trail, and points with and without a course.
  await waitFor(
    async () => {
      const features = map.querySourceFeatures("us-tracks");
      const pts = features
        .filter((f) => f.geometry.type === "Point")
        .map((f) => f.properties as Props);
      const set = (k: string) => new Set(pts.map((p) => String(p[k])));
      await expect([...set("trust")].sort()).toEqual([...TRUSTS].sort());
      await expect([...set("ident")].sort()).toEqual(
        [...IDENT_STATUSES, "none"].sort(),
      );
      await expect([...set("age")].sort()).toEqual(["aging", "live", "stale"]);
      await expect(
        pts.some(
          (p) => p["identifier"] === EMERGENCY_TRACK && p["emergency"] === true,
        ),
      ).toBe(true);
      const mismatch = pts.find((p) => p["identifier"] === MISMATCH_TRACK);
      await expect(mismatch?.["ident"]).toBe("unknown_operator");
      await expect(
        pts.some((p) => p["trackDeg"] === null || p["trackDeg"] === undefined),
      ).toBe(true);
      await expect(pts.some((p) => typeof p["trackDeg"] === "number")).toBe(
        true,
      );
      await expect(features.some((f) => f.geometry.type === "LineString")).toBe(
        true,
      );
    },
    { timeout: 20000 },
  );
  // MapLibre accepted every layer, expression and image.
  await expect(errors).toEqual([]);
  const legends = within(canvasElement).getByTestId("legends");
  await legendsCoverEverything(legends);
};

export const TracksEnglishLight: Story = {
  globals: { lang: "en", scheme: "light" },
  args: { scheme: "light" },
  play: mapPlay,
};

export const TracksGeorgianDark: Story = {
  globals: { lang: "ka", scheme: "dark" },
  args: { scheme: "dark" },
  play: mapPlay,
};

// --- the legends on their own (golden: stories/golden/golden.test.tsx) ------

const legendsPlay =
  (caveat: RegExp): NonNullable<StoryObj["play"]> =>
  async ({ canvasElement }) => {
    const root = within(canvasElement).getByTestId("legends");
    await legendsCoverEverything(root);
    // R-05: the broadcast row and the identification legend say it.
    const broadcast = root.querySelector('li[data-trust="broadcast"]');
    await expect(broadcast?.textContent).toMatch(caveat);
    await expect(
      root.querySelector(
        '[data-legend="identification"] [data-note="broadcast"]',
      )?.textContent,
    ).toMatch(caveat);
    await expect(
      root.querySelector('[data-legend="severity"]')?.textContent,
    ).not.toMatch(caveat);
    const toggle = within(root).getAllByRole("button")[0] as HTMLElement;
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  };

export const LegendsEnglishLight: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Legends />
    </div>
  ),
  globals: { lang: "en", scheme: "light" },
  play: legendsPlay(/Broadcast and unverified/),
};

export const LegendsGeorgianDark: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Legends />
    </div>
  ),
  globals: { lang: "ka", scheme: "dark" },
  play: legendsPlay(/დაუდასტურებელი/),
};

// --- identification wording for every reason and basis ---------------------

function IdentHints() {
  const t = useT();
  return (
    <dl className="grid gap-2 text-sm" data-testid="hints">
      {IDENT_BASES.map((basis) => {
        const h = identHintKey("registered", "matched", basis);
        return (
          <div key={basis} data-basis={basis}>
            <dt className="font-semibold">{t(IDENT_BASIS_KEYS[basis])}</dt>
            <dd className="m-0">
              {t(h.status)} {h.caveat === null ? "" : t(h.caveat)}
            </dd>
          </div>
        );
      })}
      {IDENT_REASONS.map((reason) => {
        const h = identHintKey(
          "unknown_operator",
          reason,
          "as_broadcast",
          reason === "operator_mismatch",
        );
        return (
          <div key={reason} data-reason={reason}>
            <dt className="font-semibold">{t(h.reason)}</dt>
            <dd className="m-0">
              {t(h.status)} {h.caveat === null ? "" : t(h.caveat)}
              {h.mismatch === null ? "" : ` ${t(h.mismatch)}`}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const hintsPlay: NonNullable<StoryObj["play"]> = async ({ canvasElement }) => {
  const root = within(canvasElement).getByTestId("hints");
  await expect(root.querySelectorAll("[data-basis]")).toHaveLength(
    IDENT_BASES.length,
  );
  await expect(root.querySelectorAll("[data-reason]")).toHaveLength(
    IDENT_REASONS.length,
  );
  await expect(
    root.querySelector('[data-basis="authenticated"] dd')?.textContent,
  ).not.toMatch(/unverified|დაუდასტურებ/);
  await expect(
    root.querySelector('[data-basis="as_broadcast"] dd')?.textContent,
  ).toMatch(/unverified|დაუდასტურებ/);
};

export const IdentificationWordingEnglish: StoryObj = {
  render: () => <IdentHints />,
  globals: { lang: "en", scheme: "light" },
  play: hintsPlay,
};

export const IdentificationWordingGeorgian: StoryObj = {
  render: () => <IdentHints />,
  globals: { lang: "ka", scheme: "dark" },
  play: hintsPlay,
};
