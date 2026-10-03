import type { Map as MapLibreMap } from "maplibre-gl";
import { waitFor, within } from "@testing-library/react";
import { useMemo, useState } from "react";
import { expect } from "vitest";

import { useLang } from "../../src/i18n/index.js";
import {
  IntentLayer,
  MannedLayer,
  ReceiverLayer,
  TrackLayer,
  intentLayerIds,
  mannedLayerIds,
  receiverLayerIds,
  trackLayerIds,
  type IntentInput,
  type ReceiverInput,
} from "../../src/layers/index.js";
import {
  TRAFFIC_NOW_MS,
  TRAFFIC_STALE_AFTER_S,
  broadcastTrack,
  intent,
  mannedTrack,
  multiPolygon,
  polygon,
  polygonWithHole,
  receiver,
  uasTrack,
} from "../../src/layers/traffic.testing.js";
import { MapView } from "../../src/map/index.js";
import type { TrackView } from "../../src/model/index.js";
import { TrackDetail } from "../../src/status/index.js";
import type { MannedTrack } from "../../src/symbology/index.js";
import "../../styles/map.css";
import { basemapBaseUrl } from "../map/basemap.js";

// WP-12: a mixed sky over the Tbilisi extract (an authenticated and a
// broadcast drone, a surveillance and a broadcast manned aircraft, a
// peer intent, an own Activated intent and a Contingent one, three
// receivers in three states) and the detail panel of each class, in both
// languages and both schemes. The map renders on SwiftShader for smoke
// only (PLAN D9): the checks read what MapLibre holds, never pixels.
// Shared by traffic.test.tsx and the golden set.

const TBILISI = {
  center: [44.8, 41.703] as [number, number],
  zoom: 13.2,
  bearing: 0,
  pitch: 0,
};

export function skyTracks(): TrackView[] {
  return [uasTrack(), broadcastTrack()];
}

export function skyManned(): MannedTrack[] {
  return [
    mannedTrack(),
    mannedTrack({
      trackId: "TEST-MAN-0002",
      icao24: "4c0002",
      callsign: null,
      lat: 41.718,
      lng: 44.785,
      trust: "broadcast",
      sourceClass: "ads_b",
      altWgs84M: null,
      trackDeg: null,
      emergency: true,
    }),
  ];
}

export function skyIntents(): IntentInput[] {
  return [
    intent({
      intentId: "TEST-INT-PEER",
      authorisationNumber: null,
      dssState: "Accepted",
      peer: true,
      volumes: [polygon(44.775, 41.69, 0.005)],
    }),
    intent({
      intentId: "TEST-INT-OWN",
      authorisationNumber: "GEO-TEST-AUTH-0001",
      dssState: "Activated",
      volumes: [polygonWithHole(44.8, 41.7)],
    }),
    intent({
      intentId: "TEST-INT-CONT",
      authorisationNumber: "GEO-TEST-AUTH-0002",
      dssState: "Contingent",
      volumes: [multiPolygon(44.815, 41.715)],
    }),
  ];
}

export function skyReceivers(): ReceiverInput[] {
  return [
    receiver({ id: "TEST-RX-0001", state: "healthy" }),
    receiver({
      id: "TEST-RX-0002",
      state: "stale",
      lat: 41.72,
      lng: 44.82,
      lastSeenAt: "2026-01-01T11:50:00Z",
    }),
    receiver({
      id: "TEST-RX-0003",
      state: "disabled",
      lat: 41.685,
      lng: 44.825,
      disabledBy: "instance",
      disabledByWho: "admin:test-1",
      lastSeenAt: null,
    }),
  ];
}

interface Loaded {
  map: MapLibreMap;
  errors: string[];
}
const maps = new WeakMap<Element, Loaded>();

export function Sky(props: { scheme: "light" | "dark" }) {
  const { lang } = useLang();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const tracks = useMemo(() => skyTracks(), []);
  const manned = useMemo(() => skyManned(), []);
  const intents = useMemo(() => skyIntents(), []);
  const receivers = useMemo(() => skyReceivers(), []);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div ref={setHost} style={{ height: 480 }} data-testid="sky-host">
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
        <IntentLayer
          intents={intents}
          activeIds={["TEST-INT-OWN"]}
          selectedId={selected}
          onSelect={setSelected}
        />
        <ReceiverLayer receivers={receivers} onSelect={setSelected} />
        <TrackLayer
          tracks={tracks}
          staleAfterS={TRAFFIC_STALE_AFTER_S}
          nowMs={TRAFFIC_NOW_MS}
          selectedId={selected}
          onSelect={setSelected}
        />
        <MannedLayer
          tracks={manned}
          staleAfterS={TRAFFIC_STALE_AFTER_S}
          nowMs={TRAFFIC_NOW_MS}
          selectedId={selected}
          onSelect={setSelected}
        />
      </MapView>
    </div>
  );
}

type Props = Record<string, unknown>;

const DATUM =
  /AMSL|WGS84 ellipsoid|pressure altitude|above take-off|above ground|ზღვის დონიდან|მიწიდან|ელიფსოიდიდან|ბარომეტრული სიმაღლე|აფრენის წერტილიდან/;

/** What MapLibre holds for the mixed sky. */
export async function checkSky(canvasElement: HTMLElement): Promise<void> {
  const host = within(canvasElement).getByTestId("sky-host");
  await waitFor(() => expect(host.getAttribute("data-loaded")).toBe("true"), {
    timeout: 20000,
  });
  const l = maps.get(host);
  if (l === undefined) throw new Error("onLoad did not hand over the map");
  const { map, errors } = l;
  const all = [
    ...Object.values(trackLayerIds("us-tracks")),
    ...Object.values(mannedLayerIds("us-manned")),
    ...Object.values(receiverLayerIds("us-receivers")),
  ].filter((id) => !["us-tracks", "us-manned", "us-receivers"].includes(id));
  const intentIds = intentLayerIds("us-intents");
  all.push(
    intentIds.fill,
    intentIds.pattern,
    intentIds.label,
    ...Object.values(intentIds.lines),
  );
  for (const id of all) expect(map.getLayer(id), id).toBeDefined();
  expect(map.hasImage("us-manned-surveillance-dir")).toBe(true);
  expect(map.hasImage("us-manned-broadcast")).toBe(true);
  expect(map.hasImage("us-intent-peer")).toBe(true);
  const props = (source: string): Props[] =>
    map.querySourceFeatures(source).map((f) => f.properties as Props);
  await waitFor(
    () => {
      const manned = props("us-manned");
      expect(new Set(manned.map((p) => p["trust"]))).toEqual(
        new Set(["surveillance", "broadcast"]),
      );
      expect(manned.some((p) => p["emergency"] === true)).toBe(true);
      const intents = props("us-intents");
      const byId = (id: string) =>
        intents.find((p) => p["identifier"] === id) ?? {};
      expect(byId("TEST-INT-PEER")["peer"]).toBe(true);
      expect(byId("TEST-INT-OWN")["active"]).toBe(true);
      expect(byId("TEST-INT-OWN")["state"]).toBe("Activated");
      expect(byId("TEST-INT-CONT")["state"]).toBe("Contingent");
      expect(byId("TEST-INT-CONT")["active"]).toBe(false);
      expect(new Set(props("us-receivers").map((p) => p["state"]))).toEqual(
        new Set(["healthy", "stale", "disabled"]),
      );
      expect(
        new Set(
          props("us-tracks")
            .filter((p) => p["kind"] === "track")
            .map((p) => p["trust"]),
        ),
      ).toEqual(new Set(["authenticated", "broadcast"]));
    },
    { timeout: 20000 },
  );
  // MapLibre accepted every layer, expression and image.
  expect(errors).toEqual([]);
  // Hover the surveillance aircraft where MapLibre drew it: the card shows
  // both altitudes by datum, from the real hit test.
  await waitFor(
    () => {
      const point = map.project([44.79, 41.705]);
      map.fire("mousemove", { point, lngLat: map.unproject(point) });
      const card = map
        .getContainer()
        .querySelector('[role="tooltip"] [data-field="alt-pressure"]');
      expect(card?.textContent).toMatch(/914/);
      expect(card?.textContent).toMatch(DATUM);
      expect(card?.textContent).not.toMatch(/AMSL|ზღვის/);
    },
    { timeout: 20000 },
  );
}

// --- the detail of each class (golden: browser/golden/golden.test.tsx) ----

export function Details() {
  const classes: [string, TrackView | MannedTrack][] = [
    ["uas-authenticated", uasTrack()],
    ["uas-broadcast", broadcastTrack()],
    ["manned-surveillance", mannedTrack()],
    ["manned-broadcast", skyManned()[1] as MannedTrack],
  ];
  return (
    <div className="grid gap-4" style={{ maxWidth: 420 }} data-testid="details">
      {classes.map(([name, track]) => (
        <div key={name} data-class={name}>
          <TrackDetail
            track={track}
            nowMs={TRAFFIC_NOW_MS}
            staleAfterS={TRAFFIC_STALE_AFTER_S}
            // The app's link, sized as a touch target (WCAG 2.5.8).
            renderLink={(l) => (
              <a
                href={`#${l.kind}-${l.id}`}
                className="inline-block min-h-6 underline"
              >
                {l.id}
              </a>
            )}
          />
        </div>
      ))}
    </div>
  );
}

export function checkDetails(
  canvasElement: HTMLElement,
  unverified: RegExp,
): void {
  const root = within(canvasElement).getByTestId("details");
  const part = (cls: string, sel: string) =>
    root.querySelector(`[data-class="${cls}"] ${sel}`);
  // R-05: the broadcast drone carries both caveats, the authenticated one
  // neither; the broadcast manned aircraft says unverified, the
  // surveillance one does not.
  expect(
    part("uas-broadcast", '[data-part="basis-caveat"]')?.textContent,
  ).toMatch(unverified);
  expect(
    part("uas-broadcast", '[data-part="broadcast-caveat"]'),
  ).not.toBeNull();
  expect(part("uas-authenticated", '[data-part="basis-caveat"]')).toBeNull();
  expect(part("manned-broadcast", '[data-field="trust"]')?.textContent).toMatch(
    unverified,
  );
  expect(
    part("manned-surveillance", '[data-field="trust"]')?.textContent,
  ).not.toMatch(unverified);
  // Every altitude row names its datum or is a dash.
  const rows = root.querySelectorAll<HTMLElement>('[data-kind="altitude"]');
  // Three per drone (AMSL or pressure, ellipsoid, height), two per manned
  // aircraft (pressure, ellipsoid).
  expect(rows.length).toBe(3 + 3 + 2 + 2);
  for (const r of rows) {
    const v = r.querySelector("dd")?.textContent ?? "";
    if (v !== "—") expect(v, r.dataset["field"]).toMatch(DATUM);
  }
  // The pressure rows never say AMSL.
  for (const r of root.querySelectorAll(
    '[data-field="alt-pressure"], [data-class="uas-broadcast"] [data-field="alt-amsl"]',
  )) {
    expect(r.textContent).not.toMatch(/AMSL|ზღვის/);
  }
  expect(part("uas-authenticated", '[data-field="flight"] a')).not.toBeNull();
  expect(
    part(
      "manned-broadcast",
      '[data-field="emergency"] [data-emergency]',
    )?.getAttribute("data-emergency"),
  ).toBe("true");
}
