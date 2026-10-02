// TrackLayer over the WP-3 MapLibre mock (WP-7): the forward-only guard
// (T-13) with its twin, backlog to the trail only (T-04) with its twin,
// bounded trails (E-10), the arrow, the emergency ring, staleness that
// arrives with no new frame (E-02), one setData for 400 upserts in a
// frame, selection, labels and the R-05 wording, and the lifecycle.
import {
  createExpression,
  featureFilter,
  latest,
  validateStyleMin,
  type StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { act, cleanup } from "@testing-library/react";
import type * as GeoJSON from "geojson";
import type { LayerSpecification } from "maplibre-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapView } from "../map/MapView.js";
import { MockMap, resetMapMock } from "../map/test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "../map/test/render-map.js";
import type { MapViewProps } from "../map/MapView.js";
import { TRUSTS, type TrackView } from "../model/index.js";
import { TRACK_ICON_IDS, trackIconId } from "../symbology/track.js";
import { TRACK_ICON_PIXEL_RATIO } from "../symbology/trackIcon.js";
import { layerCounters, resetLayerCountersForTests } from "./counters.js";
import { TrackHold, compareCapturedAt } from "./trackFeatures.js";
import {
  TRACK_LAYER_ID,
  TrackLayer,
  trackLayerIds,
  type TrackLayerProps,
} from "./TrackLayer.js";

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

// The test's clock and policy value; neither is a default of the kit.
const NOW_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const STALE_AFTER_S = 30;

function track(over: Partial<TrackView> = {}): TrackView {
  return {
    trackId: "TEST-TRK-0001",
    trust: "authenticated",
    source: "operator_ws",
    sourceInstance: "test-1",
    lat: 41.7,
    lng: 44.8,
    altAmslM: 550,
    altWgs84M: 570,
    altSource: "geodetic",
    heightM: 40,
    heightRef: "TakeoffLocation",
    speedMs: 8,
    trackDeg: 90,
    vspeedMs: 0,
    status: "Airborne",
    emergency: false,
    identification: {
      status: "registered",
      reason: "session_binding",
      serial: "TEST-SN-0001",
      operatorReg: "GEO-TEST-OP-0001",
      registeredOperatorReg: null,
      mismatch: false,
      basis: "authenticated",
    },
    flightId: null,
    intentId: null,
    times: {
      ts: "2026-01-01T11:59:59.900Z",
      rxTs: "2026-01-01T12:00:00.000Z",
      capturedAt: "2026-01-01T12:00:00.000Z",
      timeSource: "source_clock",
      backlog: false,
    },
    receivedAtMs: NOW_MS,
    ...over,
  };
}

function at(capturedAt: string, over: Partial<TrackView> = {}): TrackView {
  const base = track(over);
  return { ...base, times: { ...base.times, ...over.times, capturedAt } };
}

const ids = trackLayerIds(TRACK_LAYER_ID);

function layerOf(
  tracks: Iterable<TrackView>,
  over: Partial<TrackLayerProps> = {},
) {
  return (
    <TrackLayer
      tracks={tracks}
      staleAfterS={STALE_AFTER_S}
      nowMs={NOW_MS}
      {...over}
    />
  );
}

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

function sourceOf(map: MockMap) {
  const s = map.getSource(TRACK_LAYER_ID);
  if (s === undefined) throw new Error("no track source");
  return s;
}

function lastData(map: MockMap): FC {
  const last = sourceOf(map).setData.mock.calls.at(-1);
  if (last === undefined) throw new Error("setData was never called");
  return last[0] as FC;
}

function points(map: MockMap) {
  return lastData(map).features.filter((f) => f.geometry.type === "Point");
}

function trails(map: MockMap) {
  return lastData(map).features.filter(
    (f) => f.geometry.type === "LineString",
  ) as GeoJSON.Feature<GeoJSON.LineString, Record<string, unknown>>[];
}

function pointOf(map: MockMap, id = "TEST-TRK-0001") {
  const f = points(map).find((p) => p.properties["identifier"] === id);
  if (f === undefined) throw new Error(`no point for ${id}`);
  return f as GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>;
}

function layer(map: MockMap, id: string): LayerSpecification {
  const l = map.getLayer(id);
  if (l === undefined) throw new Error(`no layer ${id}`);
  return l;
}

async function mount(
  tracks: Iterable<TrackView>,
  over: Partial<TrackLayerProps> = {},
  view: Partial<MapViewProps> = {},
) {
  const r = await renderLoadedMap(layerOf(tracks, over), view);
  const rerender = (
    next: Iterable<TrackView>,
    nextOver: Partial<TrackLayerProps> = over,
  ): void => {
    r.result.rerender(
      <MapView {...mapProps(view)}>{layerOf(next, nextOver)}</MapView>,
    );
  };
  return { ...r, rerender };
}

describe("TrackLayer: setup", () => {
  it("adds its source, six layers and the twelve SDF icons on load", async () => {
    const { map } = await mount([track()]);
    expect(map.getSource(TRACK_LAYER_ID)).toBeDefined();
    for (const l of Object.values(ids).filter((x) => x !== ids.source)) {
      expect(map.getLayer(l), l).toBeDefined();
    }
    expect([...map.images.keys()].sort()).toEqual(
      TRACK_ICON_IDS.map((i) => i.id).sort(),
    );
    for (const id of map.images.keys()) {
      expect(map.imageOptions.get(id)).toEqual({
        sdf: true,
        pixelRatio: TRACK_ICON_PIXEL_RATIO,
      });
    }
    expect(points(map)).toHaveLength(1);
  });

  it("builds layers MapLibre's style validator accepts", async () => {
    const { map } = await mount([track()]);
    const style = {
      version: 8,
      glyphs: "https://kit.test/{fontstack}/{range}.pbf",
      sources: {
        [TRACK_LAYER_ID]: {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        },
      },
      layers: [...map.layers.values()],
    } as unknown as StyleSpecification;
    expect(validateStyleMin(style)).toEqual([]);
  });

  it("puts the icons, layers and data back after a scheme change", async () => {
    const tracks = [track()];
    const { map, rerender } = await mount(tracks, {}, {});
    act(() => {
      map.setStyle(map.getStyle());
    });
    rerender(tracks);
    await vi.waitFor(() => expect(map.getSource(TRACK_LAYER_ID)).toBeDefined());
    expect(map.images.size).toBe(12);
    expect(pointOf(map).properties["identifier"]).toBe("TEST-TRK-0001");
  });

  it("removes its layers and source on unmount", async () => {
    const { result, map } = await mount([track()]);
    result.rerender(<MapView {...mapProps()} />);
    expect(map.getSource(TRACK_LAYER_ID)).toBeUndefined();
    expect(map.getLayer(ids.icon)).toBeUndefined();
  });
});

describe("TrackLayer: forward only (T-13)", () => {
  it("applies an update captured later: the symbol moves", async () => {
    const { map, rerender } = await mount([at("2026-01-01T12:00:00.000Z")]);
    rerender([at("2026-01-01T12:00:01.000Z", { lng: 44.81 })]);
    flushFrames();
    expect(pointOf(map).geometry.coordinates).toEqual([44.81, 41.7]);
    expect(layerCounters().track_out_of_order).toBe(0);
  });

  it("ignores and counts an update captured earlier: the symbol stays", async () => {
    const { map, rerender } = await mount([at("2026-01-01T12:00:01.000Z")]);
    const setData = sourceOf(map).setData;
    setData.mockClear();
    const older = [at("2026-01-01T12:00:00.500Z", { lng: 44.7 })];
    rerender(older);
    flushFrames();
    expect(layerCounters().track_out_of_order).toBe(1);
    expect(setData).not.toHaveBeenCalled();
    // The same late object handed over again is not counted twice.
    rerender(older);
    flushFrames();
    expect(layerCounters().track_out_of_order).toBe(1);
    rerender([at("2026-01-01T12:00:02Z", { lng: 44.82 })]);
    flushFrames();
    expect(pointOf(map).geometry.coordinates).toEqual([44.82, 41.7]);
  });

  it("orders capturedAt by its fraction, whatever the digits", () => {
    expect(
      compareCapturedAt("2026-01-01T12:00:00Z", "2026-01-01T12:00:00.1Z"),
    ).toBe(-1);
    expect(
      compareCapturedAt("2026-01-01T12:00:00.5Z", "2026-01-01T12:00:00.45Z"),
    ).toBe(1);
    expect(
      compareCapturedAt("2026-01-01T12:00:00.100Z", "2026-01-01T12:00:00.1Z"),
    ).toBe(0);
    expect(
      compareCapturedAt("2026-01-01T12:00:01Z", "2026-01-01T12:00:00.999Z"),
    ).toBe(1);
  });

  it("applies and counts an update whose capturedAt cannot be ordered; it never hides it", async () => {
    expect(
      compareCapturedAt("2026-01-01T16:00:00+04:00", "2026-01-01T12:00:00Z"),
    ).toBeNull();
    const { map, rerender } = await mount([at("2026-01-01T12:00:00Z")]);
    rerender([at("2026-01-01T16:00:01+04:00", { lng: 44.83 })]);
    flushFrames();
    expect(layerCounters().track_time_unordered).toBe(1);
    expect(pointOf(map).geometry.coordinates).toEqual([44.83, 41.7]);
  });

  it("an equal capturedAt replaces the fields without a new trail point", async () => {
    const { map, rerender } = await mount([at("2026-01-01T12:00:00Z")], {
      trails: { points: 10 },
    });
    rerender([at("2026-01-01T12:00:00Z", { emergency: true })]);
    flushFrames();
    expect(pointOf(map).properties["emergency"]).toBe(true);
    expect(trails(map)).toHaveLength(0);
  });
});

describe("TrackLayer: backlog and trails (T-04, E-10)", () => {
  it("a live sample moves the position and extends the trail", async () => {
    const { map, rerender } = await mount([at("2026-01-01T12:00:00Z")], {
      trails: { points: 10 },
    });
    rerender([at("2026-01-01T12:00:01Z", { lng: 44.801 })]);
    flushFrames();
    expect(pointOf(map).geometry.coordinates).toEqual([44.801, 41.7]);
    expect(trails(map)[0]?.geometry.coordinates).toEqual([
      [44.8, 41.7],
      [44.801, 41.7],
    ]);
  });

  it("a backlog sample extends the trail and leaves the position (the twin)", async () => {
    const { map, rerender } = await mount([at("2026-01-01T12:00:00Z")], {
      trails: { points: 10 },
    });
    const history = at("2026-01-01T11:59:50Z", {
      lng: 44.79,
      times: {
        ts: null,
        rxTs: "2026-01-01T12:00:00Z",
        capturedAt: "2026-01-01T11:59:50Z",
        timeSource: "system",
        backlog: true,
      },
    });
    rerender([history]);
    flushFrames();
    expect(pointOf(map).geometry.coordinates).toEqual([44.8, 41.7]);
    expect(trails(map)[0]?.geometry.coordinates).toEqual([
      [44.8, 41.7],
      [44.79, 41.7],
    ]);
    // History is not out of order.
    expect(layerCounters().track_out_of_order).toBe(0);
  });

  it("a track that has only sent backlog has a trail and no symbol, drawn as history", () => {
    const hold = new TrackHold();
    const b = (capturedAt: string, lng: number) =>
      at(capturedAt, {
        lng,
        times: {
          ts: null,
          rxTs: capturedAt,
          capturedAt,
          timeSource: "system",
          backlog: true,
        },
      });
    hold.apply([b("2026-01-01T11:59:00Z", 44.7)], 5);
    hold.apply([b("2026-01-01T11:59:01Z", 44.71)], 5);
    const held = [...hold.entries()].map(([, h]) => h);
    expect(held).toHaveLength(1);
    expect(held[0]?.view).toBeNull();
    expect(held[0]?.trail).toHaveLength(2);
  });

  it("keeps at most `points` positions per trail and counts what it drops", async () => {
    const tick = (s: number) =>
      at(`2026-01-01T12:00:${String(s).padStart(2, "0")}Z`, {
        lng: 44.8 + s / 1000,
      });
    const { map, rerender } = await mount([tick(0)], { trails: { points: 3 } });
    for (let s = 1; s <= 5; s++) {
      rerender([tick(s)]);
      flushFrames();
    }
    const line = trails(map)[0]?.geometry.coordinates ?? [];
    expect(line).toHaveLength(3);
    expect(line.at(-1)).toEqual([44.805, 41.7]);
    expect(layerCounters().trail_point_evicted).toBe(3);
  });

  it("draws no trail and hides the trail layer without `trails` (the twin)", async () => {
    const { map, rerender } = await mount([at("2026-01-01T12:00:00Z")]);
    rerender([at("2026-01-01T12:00:01Z", { lng: 44.801 })]);
    flushFrames();
    expect(trails(map)).toHaveLength(0);
    expect(map.getLayoutProperty(ids.trail, "visibility")).toBe("none");
  });

  it("drops a track the app no longer passes, with its trail", async () => {
    const two = [track(), track({ trackId: "TEST-TRK-0002" })];
    const { map, rerender } = await mount(two);
    expect(points(map)).toHaveLength(2);
    rerender([two[0] as TrackView]);
    flushFrames();
    expect(points(map).map((p) => p.properties["identifier"])).toEqual([
      "TEST-TRK-0001",
    ]);
  });

  it("reads a one-shot iterator such as Map.values()", async () => {
    const store = new Map([["TEST-TRK-0001", track()]]);
    const { map } = await mount(store.values());
    expect(points(map)).toHaveLength(1);
  });
});

function evalLayout(
  map: MockMap,
  layerId: string,
  name: "icon-image",
  properties: Record<string, unknown>,
): string {
  const expr = (layer(map, layerId).layout as Record<string, unknown>)[name];
  const parsed = createExpression(expr, latest.layout_symbol[name]);
  if (parsed.result !== "success") throw new Error("expression rejected");
  const v = parsed.value.evaluate(
    { zoom: 12 },
    { type: "Point", properties },
    undefined,
    undefined,
    TRACK_ICON_IDS.map((i) => i.id),
  ) as { name: string };
  return v.name;
}

function drawnBy(
  map: MockMap,
  layerId: string,
  properties: Record<string, unknown>,
): boolean {
  const filter = (layer(map, layerId) as { filter?: unknown }).filter;
  return featureFilter(filter as never).filter(
    { zoom: 12 },
    { type: 1, properties },
  );
}

describe("TrackLayer: symbols", () => {
  it("a null trackDeg selects the non-rotating icon, without an arrow (R-10)", async () => {
    const { map } = await mount([track({ trackDeg: null })]);
    const p = pointOf(map).properties;
    expect(p["trackDeg"]).toBeNull();
    expect(evalLayout(map, ids.icon, "icon-image", p)).toBe(
      trackIconId("authenticated", false),
    );
  });

  it("a known trackDeg selects the arrow icon (the twin)", async () => {
    const { map } = await mount([track({ trackDeg: 270 })]);
    const p = pointOf(map).properties;
    expect(evalLayout(map, ids.icon, "icon-image", p)).toBe(
      trackIconId("authenticated", true),
    );
  });

  it("every trust class draws its own icon, and broadcast its hollow one", async () => {
    const tracks = TRUSTS.map((trust, i) =>
      track({ trackId: `TEST-TRK-${i}`, trust, trackDeg: null }),
    );
    const { map } = await mount(tracks);
    for (const [i, trust] of TRUSTS.entries()) {
      const p = pointOf(map, `TEST-TRK-${i}`).properties;
      expect(evalLayout(map, ids.icon, "icon-image", p)).toBe(
        trackIconId(trust, false),
      );
    }
  });

  it("emergency: true adds the halo", async () => {
    const { map } = await mount([track({ emergency: true })]);
    expect(drawnBy(map, ids.emergency, pointOf(map).properties)).toBe(true);
  });

  it("emergency: false draws no halo (the twin)", async () => {
    const { map } = await mount([track({ emergency: false })]);
    expect(drawnBy(map, ids.emergency, pointOf(map).properties)).toBe(false);
  });

  it("marks an unidentified track and draws its status, not registered", async () => {
    const { map } = await mount([track({ identification: null })]);
    const p = pointOf(map).properties;
    expect(p["ident"]).toBe("none");
    expect(p["mark"]).not.toBe("");
    expect(drawnBy(map, ids.mark, p)).toBe(true);
  });

  it("a registered status with a mismatch is drawn as the mismatch (G-02)", async () => {
    const base = track();
    const { map } = await mount([
      track({
        identification: {
          ...(base.identification as NonNullable<TrackView["identification"]>),
          mismatch: true,
        },
      }),
    ]);
    const p = pointOf(map).properties;
    expect(p["ident"]).toBe("unknown_operator");
    expect(p["label"]).toContain("operator mismatch");
  });
});

describe("TrackLayer: age without frames (E-02)", () => {
  it("nowMs advancing moves a track from live to stale with no new frame", async () => {
    const tracks = [track({ receivedAtMs: NOW_MS })];
    const { map, rerender } = await mount(tracks);
    expect(pointOf(map).properties["age"]).toBe("live");
    rerender(tracks, { nowMs: NOW_MS + 15_000 });
    flushFrames();
    expect(pointOf(map).properties["age"]).toBe("aging");
    rerender(tracks, { nowMs: NOW_MS + 31_000 });
    flushFrames();
    expect(pointOf(map).properties["age"]).toBe("stale");
    // Still drawn: stale is faded, never removed.
    expect(points(map)).toHaveLength(1);
  });

  it("with no usable threshold the age is unknown, not live", async () => {
    const { map } = await mount([track()], { staleAfterS: Number.NaN });
    expect(pointOf(map).properties["age"]).toBe("unknown");
  });
});

describe("TrackLayer: per-frame coalescing (PLAN §8)", () => {
  it("applies 400 upserts within one frame with one setData", async () => {
    const tracks = Array.from({ length: 200 }, (_, i) =>
      track({ trackId: `TEST-TRK-${i}` }),
    );
    const { map, rerender } = await mount(tracks);
    const setData = sourceOf(map).setData;
    setData.mockClear();
    let current = tracks;
    for (let k = 1; k <= 400; k++) {
      const i = k % 200;
      current = current.map((t, j) =>
        j === i
          ? at(
              `2026-01-01T12:00:${String(k % 60).padStart(2, "0")}.${String(k).padStart(3, "0")}Z`,
              {
                trackId: t.trackId,
                lng: 44.8 + k / 1e5,
              },
            )
          : t,
      );
      rerender(current);
    }
    expect(setData).not.toHaveBeenCalled();
    flushFrames();
    expect(setData).toHaveBeenCalledTimes(1);
    expect(points(map)).toHaveLength(200);
    expect(layerCounters().update_superseded).toBeGreaterThan(0);
  });
});

describe("TrackLayer: selection and labels", () => {
  it("calls onSelect with the track id of a clicked symbol", async () => {
    const onSelect = vi.fn();
    const { map } = await mount([track()], { onSelect });
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: "TEST-TRK-0001" } },
    ] as never);
    act(() => map.fire("click", { point: { x: 3, y: 4 } }));
    expect(onSelect).toHaveBeenCalledWith("TEST-TRK-0001");
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 3, y: 4 },
      { layers: [ids.icon] },
    );
  });

  it("calls nothing for a click beside every symbol (the twin)", async () => {
    const onSelect = vi.fn();
    const { map } = await mount([track()], { onSelect });
    map.queryRenderedFeatures.mockReturnValue([]);
    act(() => map.fire("click", { point: { x: 3, y: 4 } }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the selected track, and only it, with the selection ring", async () => {
    const { map } = await mount(
      [track(), track({ trackId: "TEST-TRK-0002" })],
      { selectedId: "TEST-TRK-0002" },
    );
    expect(
      drawnBy(map, ids.selected, pointOf(map, "TEST-TRK-0002").properties),
    ).toBe(true);
    expect(drawnBy(map, ids.selected, pointOf(map).properties)).toBe(false);
  });

  it("shows labels by default and hides them, and only them, with labels={false}", async () => {
    const tracks = [track()];
    const { map, rerender } = await mount(tracks);
    expect(map.getLayoutProperty(ids.label, "visibility")).toBe("visible");
    rerender(tracks, { labels: false });
    expect(map.getLayoutProperty(ids.label, "visibility")).toBe("none");
    expect(map.getLayoutProperty(ids.icon, "visibility")).toBe("visible");
    expect(map.getLayoutProperty(ids.mark, "visibility")).toBe("visible");
  });

  it("hides every layer with visible={false}", async () => {
    const tracks = [track()];
    const { map, rerender } = await mount(tracks);
    rerender(tracks, { visible: false });
    expect(map.getLayoutProperty(ids.icon, "visibility")).toBe("none");
    expect(map.getLayoutProperty(ids.emergency, "visibility")).toBe("none");
  });

  it("labels a registered track by its registration's public part", async () => {
    const { map } = await mount([track()]);
    expect(pointOf(map).properties["label"]).toBe("GEO-TEST-OP-0001");
  });

  it("labels by the serial when no registration was given", async () => {
    const base = track();
    const { map } = await mount([
      track({
        identification: {
          ...(base.identification as NonNullable<TrackView["identification"]>),
          operatorReg: null,
        },
      }),
    ]);
    expect(pointOf(map).properties["label"]).toBe("TEST-SN-0001");
  });

  it("labels an unidentified track 'unidentified' whatever it broadcast (I-02)", async () => {
    const base = track();
    const { map } = await mount([
      track({
        identification: {
          ...(base.identification as NonNullable<TrackView["identification"]>),
          status: "unidentified",
          reason: "no_serial",
          serial: null,
        },
      }),
    ]);
    expect(String(pointOf(map).properties["label"]).split("\n")[0]).toBe(
      "unidentified",
    );
  });

  it("labels a broadcast track 'broadcast and unverified' (R-05)", async () => {
    const { map } = await mount([track({ trust: "broadcast" })]);
    expect(pointOf(map).properties["label"]).toContain(
      "broadcast and unverified",
    );
  });

  it("does not say so on an authenticated track (the twin)", async () => {
    const { map } = await mount([track({ trust: "authenticated" })]);
    expect(pointOf(map).properties["label"]).not.toContain("unverified");
  });

  it("says 'reported by a provider, unverified' on a provider track", async () => {
    const { map } = await mount([track({ trust: "provider" })]);
    expect(pointOf(map).properties["label"]).toContain(
      "reported by a provider, unverified",
    );
  });

  it("names a non-registered status and an emergency in the label", async () => {
    const base = track();
    const { map } = await mount([
      track({
        emergency: true,
        identification: {
          ...(base.identification as NonNullable<TrackView["identification"]>),
          status: "suspended",
          reason: "uas_suspended",
        },
      }),
    ]);
    const lines = String(pointOf(map).properties["label"]).split("\n");
    expect(lines).toEqual(["GEO-TEST-OP-0001", "suspended", "emergency"]);
  });

  it("labels in Georgian on a ka map", async () => {
    const { map } = await mount(
      [track({ trust: "broadcast" })],
      {},
      { lang: "ka" },
    );
    expect(pointOf(map).properties["label"]).toContain("დაუდასტურებელი");
  });
});

describe("TrackLayer: lifecycle", () => {
  it("unmounts with its MapView without touching the removed map", async () => {
    const { result, map } = await mount([track()]);
    const removeLayer = vi.spyOn(map, "removeLayer");
    result.unmount();
    expect(map.removed).toBe(true);
    expect(removeLayer).not.toHaveBeenCalled();
    expect(MockMap.instances.length).toBeGreaterThan(0);
  });
});
