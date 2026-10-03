// AlertLayer over the WP-3 MapLibre mock (WP-11): a line for proximity
// with both parties present and a ring plus the counter when one is
// missing (the pair), dashed when a party is broadcast and solid when
// not, a ring for a raised zone, height or nonconformance alert and
// nothing for a cleared one (presence and absence), severity colour and
// width, the style validator, and the lifecycle.
import {
  latest,
  validateStyleMin,
  type StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { act, cleanup } from "@testing-library/react";
import type * as GeoJSON from "geojson";
import type { LayerSpecification } from "maplibre-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { alert, track } from "../alerts/fixtures.testing.js";
import { MapView } from "../map/MapView.js";
import { MockMap, resetMapMock } from "../map/test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "../map/test/render-map.js";
import type { AlertView, TrackView } from "../model/index.js";
import {
  ALERT_DASH,
  ALERT_LAYER_ID,
  ALERT_WIDTH_PX,
  AlertLayer,
  alertLayerIds,
} from "./AlertLayer.js";
import { layerCounters, resetLayerCountersForTests } from "./counters.js";

vi.mock("maplibre-gl", async () =>
  (await import("../map/test/maplibre-mock.js")).maplibreMockModule(),
);

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function flushFrames(): void {
  const due = [...frames.values()];
  frames.clear();
  act(() => {
    for (const f of due) f(0);
  });
}

beforeEach(() => {
  stubSourceJson();
  frames = new Map();
  nextFrame = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  resetLayerCountersForTests();
});

afterEach(() => {
  cleanup();
  resetMapMock();
  resetLayerCountersForTests();
});

const ids = alertLayerIds(ALERT_LAYER_ID);

const A = track({ trackId: "TEST-TRK-0001", lng: 44.8, lat: 41.7 });
const B = track({ trackId: "TEST-TRK-0002", lng: 44.81, lat: 41.71 });

const mapOf = (...ts: TrackView[]): ReadonlyMap<string, TrackView> =>
  new Map(ts.map((t) => [t.trackId, t]));

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

async function mount(
  alerts: AlertView[],
  tracks: ReadonlyMap<string, TrackView>,
  visible = true,
) {
  const r = await renderLoadedMap(
    <AlertLayer alerts={alerts} tracks={tracks} visible={visible} />,
  );
  const rerender = (
    next: AlertView[],
    nextTracks = tracks,
    nextVisible = visible,
  ): void => {
    r.result.rerender(
      <MapView {...mapProps()}>
        <AlertLayer alerts={next} tracks={nextTracks} visible={nextVisible} />
      </MapView>,
    );
    flushFrames();
  };
  return { ...r, rerender };
}

function lastData(map: MockMap): FC {
  const s = map.getSource(ALERT_LAYER_ID);
  const last = s?.setData.mock.calls.at(-1);
  if (last === undefined) throw new Error("setData was never called");
  return last[0] as FC;
}

const lines = (map: MockMap) =>
  lastData(map).features.filter((f) => f.geometry.type === "LineString");
const rings = (map: MockMap) =>
  lastData(map).features.filter((f) => f.geometry.type === "Point");

function layer(map: MockMap, id: string): LayerSpecification {
  const l = map.getLayer(id);
  if (l === undefined) throw new Error(`no layer ${id}`);
  return l;
}

describe("AlertLayer: setup", () => {
  it("adds its source and three layers", async () => {
    const { map } = await mount([], mapOf());
    expect(map.getSource(ALERT_LAYER_ID)).toBeDefined();
    for (const id of [ids.line, ids.lineDashed, ids.ring]) {
      expect(map.getLayer(id), id).toBeDefined();
    }
    expect(lastData(map).features).toEqual([]);
  });

  it("builds layers MapLibre's style validator accepts", async () => {
    const { map } = await mount([alert()], mapOf(A, B));
    const style = {
      version: 8,
      sources: {
        [ALERT_LAYER_ID]: {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        },
      },
      layers: [...map.layers.values()],
    } as unknown as StyleSpecification;
    expect(validateStyleMin(style, latest)).toEqual([]);
  });

  it("colours and widths follow the severity (width tells it without colour)", async () => {
    const { map } = await mount([], mapOf());
    const paint = layer(map, ids.line).paint as Record<string, unknown>;
    expect(paint["line-width"]).toEqual([
      "match",
      ["get", "severity"],
      "critical",
      ALERT_WIDTH_PX.critical,
      "warning",
      ALERT_WIDTH_PX.warning,
      ALERT_WIDTH_PX.info,
    ]);
    expect((paint["line-color"] as unknown[])[0]).toBe("match");
    const dashed = layer(map, ids.lineDashed).paint as Record<string, unknown>;
    expect(dashed["line-dasharray"]).toEqual(ALERT_DASH);
    expect(layer(map, ids.line).paint).not.toHaveProperty("line-dasharray");
  });

  it("removes its layers and source on unmount", async () => {
    const { result, map } = await mount([alert()], mapOf(A, B));
    result.rerender(<MapView {...mapProps()} />);
    expect(map.getSource(ALERT_LAYER_ID)).toBeUndefined();
    expect(map.getLayer(ids.ring)).toBeUndefined();
  });

  it("hides every layer when not visible, and shows them again", async () => {
    const { map, rerender } = await mount([alert()], mapOf(A, B), false);
    expect(map.getLayoutProperty(ids.line, "visibility")).toBe("none");
    rerender([alert()], mapOf(A, B), true);
    expect(map.getLayoutProperty(ids.line, "visibility")).toBe("visible");
  });
});

describe("AlertLayer: proximity", () => {
  it("draws a line between the two aircraft when both are present", async () => {
    const { map } = await mount([alert()], mapOf(A, B));
    expect(lines(map)).toHaveLength(1);
    expect(rings(map)).toHaveLength(0);
    const line = lines(map)[0] as GeoJSON.Feature<GeoJSON.LineString>;
    expect(line.geometry.coordinates).toEqual([
      [44.8, 41.7],
      [44.81, 41.71],
    ]);
    expect(line.properties).toMatchObject({
      alertId: "TEST-ALR-0001",
      severity: "critical",
      dashed: false,
    });
    expect(layerCounters().alert_peer_missing).toBe(0);
  });

  it("a missing peer: a ring on the known aircraft and the counter (the pair)", async () => {
    const { map, rerender } = await mount([alert()], mapOf(A));
    expect(lines(map)).toHaveLength(0);
    expect(rings(map)).toHaveLength(1);
    expect(rings(map)[0]?.properties["trackId"]).toBe("TEST-TRK-0001");
    expect(layerCounters().alert_peer_missing).toBe(1);
    // Counted once while it stays missing, not on every frame.
    rerender([alert({ state: "updated" })], mapOf({ ...A, lat: 41.701 }));
    expect(layerCounters().alert_peer_missing).toBe(1);
    // The peer arrives: a line; a later gap is counted again.
    rerender([alert({ state: "updated" })], mapOf(A, B));
    expect(lines(map)).toHaveLength(1);
    rerender([alert({ state: "updated" })], mapOf(B));
    expect(layerCounters().alert_peer_missing).toBe(2);
    expect(rings(map)[0]?.properties["trackId"]).toBe("TEST-TRK-0002");
  });

  it("dashed when a party is broadcast and unverified", async () => {
    const { map } = await mount(
      [alert()],
      mapOf(A, { ...B, trust: "broadcast" }),
    );
    expect(lines(map)[0]?.properties["dashed"]).toBe(true);
  });

  it("dashed when the detail names a broadcast peer", async () => {
    const { map } = await mount(
      [
        alert({
          detail: { peer: { track_id: "TEST-TRK-0002", trust: "broadcast" } },
        }),
      ],
      mapOf(A, B),
    );
    expect(lines(map)[0]?.properties["dashed"]).toBe(true);
  });

  it("solid when both parties are authenticated (the twin)", async () => {
    const { map } = await mount([alert()], mapOf(A, B));
    expect(lines(map)[0]?.properties["dashed"]).toBe(false);
  });

  it("a proximity alert naming no peer at all is a ring, counted", async () => {
    const { map } = await mount(
      [alert({ detail: {}, peerTrackId: null })],
      mapOf(A),
    );
    expect(rings(map)).toHaveLength(1);
    expect(layerCounters().alert_peer_missing).toBe(1);
  });
});

describe("AlertLayer: rings and clears", () => {
  for (const kind of [
    "zone_incursion",
    "height_exceedance",
    "height_120m",
    "nonconformance",
  ] as const) {
    it(`a raised ${kind} is a ring on its aircraft (presence)`, async () => {
      const { map } = await mount([alert({ kind })], mapOf(A));
      expect(rings(map)).toHaveLength(1);
      expect(rings(map)[0]?.properties).toMatchObject({
        kind,
        trackId: "TEST-TRK-0001",
      });
      expect(lines(map)).toHaveLength(0);
    });
  }

  it("a cleared alert draws nothing (absence)", async () => {
    const { map, rerender } = await mount([alert()], mapOf(A, B));
    expect(lines(map)).toHaveLength(1);
    rerender(
      [
        alert({ state: "cleared", clearReason: "resolved" }),
        alert({
          alertId: "z",
          kind: "zone_incursion",
          state: "cleared",
          clearReason: "landed",
        }),
      ],
      mapOf(A, B),
    );
    expect(lastData(map).features).toEqual([]);
  });

  it("an alert with none of its aircraft on the map draws nothing and is counted once", async () => {
    const { map, rerender } = await mount(
      [alert({ kind: "lost_link" })],
      mapOf(B),
    );
    expect(lastData(map).features).toEqual([]);
    expect(layerCounters().alert_aircraft_missing).toBe(1);
    rerender([alert({ kind: "lost_link", state: "updated" })], mapOf(B));
    expect(layerCounters().alert_aircraft_missing).toBe(1);
    rerender([alert({ kind: "lost_link" })], mapOf(A));
    expect(rings(map)).toHaveLength(1);
  });

  it("an alert no longer passed is forgotten, so its next gap counts again", async () => {
    const { rerender } = await mount([alert({ kind: "lost_link" })], mapOf());
    rerender([], mapOf());
    rerender([alert({ kind: "lost_link" })], mapOf());
    expect(layerCounters().alert_aircraft_missing).toBe(2);
  });

  it("takes any iterable of alerts", async () => {
    const { map } = await mount(
      new Map([["x", alert({ kind: "zone_incursion" })]]).values() as never,
      mapOf(A),
    );
    expect(rings(map)).toHaveLength(1);
  });
});

describe("AlertLayer: on the map", () => {
  it("the ring and line take the severity token colours resolved on the map", async () => {
    const r = await renderLoadedMap(
      <AlertLayer alerts={[]} tracks={mapOf()} />,
    );
    r.map.options.container.style.setProperty(
      "--us-severity-critical",
      "#88122b",
    );
    act(() => {
      r.map.setStyle(r.map.getStyle());
    });
    r.result.rerender(
      <MapView {...mapProps()}>
        <AlertLayer alerts={[]} tracks={mapOf()} />
      </MapView>,
    );
    await vi.waitFor(() => expect(r.map.getLayer(ids.ring)).toBeDefined());
    const paint = layer(r.map, ids.ring).paint as Record<string, unknown>;
    expect((paint["circle-stroke-color"] as unknown[])[3]).toBe("#88122b");
    expect(MockMap.instances).toHaveLength(1);
  });
});
