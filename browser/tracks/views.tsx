import type { Map as MapLibreMap } from "maplibre-gl";
import { waitFor, within } from "@testing-library/react";
import { useEffect, useMemo, useState } from "react";
import { expect } from "vitest";
import { userEvent } from "vitest/browser";

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
import { basemapBaseUrl } from "../map/basemap.js";
import {
  EMERGENCY_TRACK,
  MISMATCH_TRACK,
  FIXED_NOW_MS,
  STALE_AFTER_S,
  fixtureHistory,
  fixtureTracks,
} from "./tracks.js";

// WP-7: the fixture sky over the Tbilisi extract (every trust class
// against every identification status, ages across the buckets, an
// emergency, a mismatch, a trail), the four legends, and the
// identification wording for every reason and basis, in both languages
// and both schemes. The map renders on SwiftShader for smoke only (PLAN
// D9): the checks read what MapLibre holds and what the legends render,
// never pixels. Shared by tracks.test.tsx and the golden set.

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

export function Legends() {
  const tracks = useMemo(() => fixtureTracks(), []);
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
      <AgeLegend staleAfterS={STALE_AFTER_S} />
      <SeverityLegend />
    </div>
  );
}

export function TrackMap(props: { scheme: "light" | "dark" }) {
  const { lang } = useLang();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const base = useMemo(() => fixtureTracks(), []);
  const [tracks, setTracks] = useState(base);
  // After the first frame, the first track's history arrives: two backlog
  // samples and a newer live one, which draw its trail.
  useEffect(() => {
    const first = base[0];
    if (first === undefined) return;
    const id = setTimeout(() => {
      setTracks([...fixtureHistory(first), ...base.slice(1)]);
    }, 50);
    return () => clearTimeout(id);
  }, [base]);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_20rem]">
      <div ref={setHost} style={{ height: 520 }} data-testid="map-host">
        <MapView
          basemap={{ baseUrl: basemapBaseUrl() }}
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
            staleAfterS={STALE_AFTER_S}
            nowMs={FIXED_NOW_MS}
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
function legendsCoverEverything(root: HTMLElement): void {
  const values = (attr: string) =>
    [...root.querySelectorAll<HTMLElement>(`li[data-${attr}]`)].map(
      (li) => li.dataset[attr],
    );
  expect(values("trust")).toEqual([...TRUSTS]);
  expect(values("ident")).toEqual([...identOrder()]);
  expect(values("age")).toEqual([...AGE_BUCKETS]);
  expect([...values("severity")].sort()).toEqual([...SEVERITIES].sort());
}

/** What MapLibre holds for the fixture sky, and the legends beside it. */
export async function checkTrackMap(canvasElement: HTMLElement): Promise<void> {
  const { map, errors } = await loaded(canvasElement);
  for (const id of Object.values(ids).filter((x) => x !== "us-tracks")) {
    expect(map.getLayer(id)).toBeDefined();
  }
  expect(map.hasImage("us-track-broadcast")).toBe(true);
  expect(map.hasImage("us-track-broadcast-dir")).toBe(true);
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
      expect([...set("trust")].sort()).toEqual([...TRUSTS].sort());
      expect([...set("ident")].sort()).toEqual(
        [...IDENT_STATUSES, "none"].sort(),
      );
      expect([...set("age")].sort()).toEqual(["aging", "live", "stale"]);
      expect(
        pts.some(
          (p) => p["identifier"] === EMERGENCY_TRACK && p["emergency"] === true,
        ),
      ).toBe(true);
      const mismatch = pts.find((p) => p["identifier"] === MISMATCH_TRACK);
      expect(mismatch?.["ident"]).toBe("unknown_operator");
      expect(
        pts.some((p) => p["trackDeg"] === null || p["trackDeg"] === undefined),
      ).toBe(true);
      expect(pts.some((p) => typeof p["trackDeg"] === "number")).toBe(true);
      expect(features.some((f) => f.geometry.type === "LineString")).toBe(true);
    },
    { timeout: 20000 },
  );
  // MapLibre accepted every layer, expression and image.
  expect(errors).toEqual([]);
  const legends = within(canvasElement).getByTestId("legends");
  legendsCoverEverything(legends);
}

// --- the legends on their own (golden: browser/golden/golden.test.tsx) ------

export function LegendsBox() {
  return (
    <div style={{ maxWidth: 360 }}>
      <Legends />
    </div>
  );
}

export async function checkLegends(
  canvasElement: HTMLElement,
  caveat: RegExp,
): Promise<void> {
  const root = within(canvasElement).getByTestId("legends");
  legendsCoverEverything(root);
  // R-05: the broadcast row and the identification legend say it.
  const broadcast = root.querySelector('li[data-trust="broadcast"]');
  expect(broadcast?.textContent).toMatch(caveat);
  expect(
    root.querySelector('[data-legend="identification"] [data-note="broadcast"]')
      ?.textContent,
  ).toMatch(caveat);
  expect(
    root.querySelector('[data-legend="severity"]')?.textContent,
  ).not.toMatch(caveat);
  const toggle = within(root).getAllByRole("button")[0] as HTMLElement;
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
}

// --- identification wording for every reason and basis ---------------------

export function IdentHints() {
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

export function checkHints(canvasElement: HTMLElement): void {
  const root = within(canvasElement).getByTestId("hints");
  expect(root.querySelectorAll("[data-basis]")).toHaveLength(
    IDENT_BASES.length,
  );
  expect(root.querySelectorAll("[data-reason]")).toHaveLength(
    IDENT_REASONS.length,
  );
  expect(
    root.querySelector('[data-basis="authenticated"] dd')?.textContent,
  ).not.toMatch(/unverified|დაუდასტურებ/);
  expect(
    root.querySelector('[data-basis="as_broadcast"] dd')?.textContent,
  ).toMatch(/unverified|დაუდასტურებ/);
}
