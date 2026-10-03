// MannedLayer over the WP-3 MapLibre mock (WP-12): both altitudes carried
// to the hover card with their datums (R-09: the barometric row says
// "pressure altitude", never AMSL), the emergency ring with its twin,
// staleness that arrives with no new frame (E-02), nothing removed
// without the store's `remove()` (a track ten times past the stale
// threshold is still drawn, dimmed; the twin: removed once the store
// removes it), a backlog sample never drawn as live (T-04), an absent
// trust class drawn as broadcast, one setData per frame, selection and
// labels, and the lifecycle.
import { act, cleanup, screen } from "@testing-library/react";
import type * as GeoJSON from "geojson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { omit } from "../live/test/omit.js";
import { createMannedStore } from "../live/trackStore.js";
import { MapView, type MapViewProps } from "../map/MapView.js";
import { MockMap, resetMapMock } from "../map/test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "../map/test/render-map.js";
import type { MannedView } from "../model/index.js";
import { MANNED_ICON_IDS, type MannedTrack } from "../symbology/manned.js";
import { resetLayerCountersForTests } from "./counters.js";
import {
  MANNED_LAYER_ID,
  MannedLayer,
  mannedLayerIds,
  type MannedLayerProps,
} from "./MannedLayer.js";
import {
  TRAFFIC_NOW_MS as NOW_MS,
  TRAFFIC_STALE_AFTER_S as STALE_AFTER_S,
  mannedTrack,
} from "./traffic.testing.js";

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

const ids = mannedLayerIds(MANNED_LAYER_ID);

type FC = GeoJSON.FeatureCollection<GeoJSON.Point, Record<string, unknown>>;

function layerOf(
  tracks: Iterable<MannedTrack>,
  over: Partial<MannedLayerProps> = {},
) {
  return (
    <MannedLayer
      tracks={tracks}
      staleAfterS={STALE_AFTER_S}
      nowMs={NOW_MS}
      {...over}
    />
  );
}

async function mount(
  tracks: Iterable<MannedTrack>,
  over: Partial<MannedLayerProps> = {},
  view: Partial<MapViewProps> = {},
) {
  const r = await renderLoadedMap(layerOf(tracks, over), view);
  const rerender = (
    next: Iterable<MannedTrack>,
    nextOver: Partial<MannedLayerProps> = over,
  ): void => {
    r.result.rerender(
      <MapView {...mapProps(view)}>{layerOf(next, nextOver)}</MapView>,
    );
  };
  return { ...r, rerender };
}

function lastData(map: MockMap): FC {
  const s = map.getSource(MANNED_LAYER_ID);
  if (s === undefined) throw new Error("no manned source");
  const last = s.setData.mock.calls.at(-1);
  if (last === undefined) throw new Error("setData was never called");
  return last[0] as FC;
}

function propsOf(map: MockMap, id = "TEST-MAN-0001"): Record<string, unknown> {
  const f = lastData(map).features.find(
    (p) => p.properties["identifier"] === id,
  );
  if (f === undefined) throw new Error(`no feature for ${id}`);
  return f.properties;
}

function hoverOn(map: MockMap, id: string): void {
  map.queryRenderedFeatures.mockReturnValue([
    { properties: { identifier: id } },
  ] as never);
  act(() => map.fire("mousemove", { point: { x: 10, y: 20 } }));
}

describe("MannedLayer: setup", () => {
  it("adds its source, four layers and the twelve manned icons on load", async () => {
    const { map } = await mount([mannedTrack()]);
    expect(map.getSource(MANNED_LAYER_ID)).toBeDefined();
    for (const l of [ids.selected, ids.emergency, ids.icon, ids.label]) {
      expect(map.getLayer(l), l).toBeDefined();
    }
    for (const { id } of MANNED_ICON_IDS)
      expect(map.hasImage(id), id).toBe(true);
  });

  it("removes its layers and source on unmount", async () => {
    const { map, result } = await mount([mannedTrack()]);
    result.rerender(<MapView {...mapProps()} />);
    expect(map.getLayer(ids.icon)).toBeUndefined();
    expect(map.getSource(MANNED_LAYER_ID)).toBeUndefined();
  });

  it("puts the position through as sent, [lng, lat]", async () => {
    const { map } = await mount([mannedTrack({ lat: 41.71, lng: 44.81 })]);
    const f = lastData(map).features[0];
    expect(f?.geometry.coordinates).toEqual([44.81, 41.71]);
  });
});

describe("trust and caveats", () => {
  it("draws surveillance as surveillance, without the broadcast caveat", async () => {
    const { map } = await mount([mannedTrack({ trust: "surveillance" })]);
    expect(propsOf(map)["trust"]).toBe("surveillance");
    expect(propsOf(map)["label"]).not.toMatch(/unverified/);
  });

  it("draws broadcast as broadcast, labelled unverified (R-05)", async () => {
    const { map } = await mount([mannedTrack({ trust: "broadcast" })]);
    expect(propsOf(map)["trust"]).toBe("broadcast");
    expect(propsOf(map)["label"]).toMatch(/broadcast and unverified/);
  });

  it("draws a provider position with the provider caveat", async () => {
    const { map } = await mount([mannedTrack({ trust: "provider" })]);
    expect(propsOf(map)["label"]).toMatch(/provider, unverified/);
  });

  it("draws a track with no trust class as broadcast and says so", async () => {
    const plain: MannedView = { ...mannedTrack() };
    delete (plain as MannedTrack).trust;
    const { map } = await mount([plain]);
    expect(propsOf(map)["trust"]).toBe("broadcast");
    expect(propsOf(map)["trustStated"]).toBe(false);
    expect(propsOf(map)["label"]).toMatch(/trust class not provided/);
  });

  it("labels by callsign, then address, then says neither is known", async () => {
    const { map, rerender } = await mount([mannedTrack()]);
    expect(String(propsOf(map)["label"]).split("\n")[0]).toBe("TEST001");
    rerender([mannedTrack({ callsign: null })]);
    flushFrames();
    expect(String(propsOf(map)["label"]).split("\n")[0]).toBe("4c0001");
    rerender([mannedTrack({ callsign: " ", icao24: null })]);
    flushFrames();
    expect(String(propsOf(map)["label"]).split("\n")[0]).toBe(
      "no callsign or address",
    );
  });
});

describe("emergency", () => {
  it("an emergency track carries the flag the halo layer filters on, and its label says so", async () => {
    const { map } = await mount([mannedTrack({ emergency: true })]);
    expect(propsOf(map)["emergency"]).toBe(true);
    expect(propsOf(map)["label"]).toMatch(/emergency/);
    expect(map.getLayer(ids.emergency)).toMatchObject({
      filter: ["==", ["get", "emergency"], true],
    });
  });

  it("a track without one does not (the twin)", async () => {
    const { map } = await mount([mannedTrack()]);
    expect(propsOf(map)["emergency"]).toBe(false);
    expect(propsOf(map)["label"]).not.toMatch(/emergency/);
  });
});

describe("never hide, never look fresh", () => {
  it("ages to stale with no new frame (E-02): the tick alone moves it", async () => {
    const track = mannedTrack({ receivedAtMs: NOW_MS - 1000 });
    const list = [track];
    const { map, rerender } = await mount(list);
    expect(propsOf(map)["age"]).toBe("live");
    rerender(list, { nowMs: NOW_MS + 15_000 });
    flushFrames();
    expect(propsOf(map)["age"]).toBe("aging");
    rerender(list, { nowMs: NOW_MS + 60_000 });
    flushFrames();
    expect(propsOf(map)["age"]).toBe("stale");
    expect(propsOf(map)["label"]).toMatch(/Stale/);
  });

  it("a track ten times past the stale threshold is still drawn, dimmed (presence)", async () => {
    const old = mannedTrack({
      receivedAtMs: NOW_MS - 10 * STALE_AFTER_S * 1000 - 1000,
    });
    const { map } = await mount([old]);
    expect(lastData(map).features).toHaveLength(1);
    expect(propsOf(map)["age"]).toBe("stale");
  });

  it("leaves the map only when the store removes it with a reason (the twin)", async () => {
    const store = createMannedStore({
      trailPoints: 0,
      maxTracks: 10,
      now: () => NOW_MS,
    });
    store.upsert(omit(mannedTrack(), "receivedAtMs"));
    const { map, rerender } = await mount(store.snapshot().values(), {
      nowMs: NOW_MS + 100 * STALE_AFTER_S * 1000,
    });
    expect(lastData(map).features).toHaveLength(1);
    store.remove("TEST-MAN-0001", "stale");
    rerender(store.snapshot().values(), {
      nowMs: NOW_MS + 100 * STALE_AFTER_S * 1000,
    });
    flushFrames();
    expect(lastData(map).features).toHaveLength(0);
    expect(store.recentlyRemoved().at(-1)?.reason).toBe("stale");
  });

  it("a backlog sample is history: drawn stale and labelled, however young", async () => {
    const t = mannedTrack();
    const { map } = await mount([
      { ...t, times: { ...t.times, backlog: true } },
    ]);
    expect(propsOf(map)["age"]).toBe("stale");
    expect(propsOf(map)["label"]).toMatch(/history, not live/);
  });

  it("a live sample of the same age is drawn live (the twin)", async () => {
    const { map } = await mount([mannedTrack()]);
    expect(propsOf(map)["age"]).toBe("live");
    expect(propsOf(map)["label"]).not.toMatch(/history|Stale/);
  });

  it("without a usable stale threshold the age is unknown and the label says so", async () => {
    const { map } = await mount([mannedTrack()], { staleAfterS: 0 });
    expect(propsOf(map)["age"]).toBe("unknown");
    expect(propsOf(map)["label"]).toMatch(/Age not known/);
  });
});

describe("updates", () => {
  it("coalesces many updates in one frame into one setData", async () => {
    const { map, rerender } = await mount([mannedTrack()]);
    const s = map.getSource(MANNED_LAYER_ID);
    const before = s?.setData.mock.calls.length ?? 0;
    for (let i = 0; i < 50; i++) {
      rerender([mannedTrack({ lng: 44.79 + i * 0.0001 })]);
    }
    flushFrames();
    expect(s?.setData.mock.calls.length).toBe(before + 1);
    expect(lastData(map).features[0]?.geometry.coordinates[0]).toBeCloseTo(
      44.79 + 49 * 0.0001,
    );
  });

  it("marks the selected track and calls onSelect on a click", async () => {
    const onSelect = vi.fn();
    const { map } = await mount([mannedTrack()], {
      selectedId: "TEST-MAN-0001",
      onSelect,
    });
    expect(propsOf(map)["selected"]).toBe(true);
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: "TEST-MAN-0001" } },
    ] as never);
    act(() => map.fire("click", { point: { x: 1, y: 1 } }));
    expect(onSelect).toHaveBeenCalledWith("TEST-MAN-0001");
  });

  it("hides the label layer when labels is false and keeps the icons", async () => {
    const { map } = await mount([mannedTrack()], { labels: false });
    expect(map.getLayoutProperty(ids.label, "visibility")).toBe("none");
    expect(map.getLayoutProperty(ids.icon, "visibility")).toBe("visible");
  });
});

describe("the hover card", () => {
  it("names both altitudes by their datum; the barometric one is never AMSL (R-09)", async () => {
    const { map } = await mount([mannedTrack()]);
    hoverOn(map, "TEST-MAN-0001");
    const card = screen.getByRole("tooltip");
    const pressure = card.querySelector('[data-field="alt-pressure"]');
    const wgs84 = card.querySelector('[data-field="alt-wgs84"]');
    expect(pressure?.textContent).toMatch(/Pressure altitude/);
    expect(pressure?.textContent).toMatch(/914 m pressure altitude/);
    expect(pressure?.textContent).not.toMatch(/AMSL|sea level/);
    expect(wgs84?.textContent).toMatch(/962 m above the WGS84 ellipsoid/);
  });

  it("shows a dash, not a zero, for an altitude the API did not send", async () => {
    const { map } = await mount([
      mannedTrack({ altPressureM: null, altWgs84M: null }),
    ]);
    hoverOn(map, "TEST-MAN-0001");
    const card = screen.getByRole("tooltip");
    expect(
      card.querySelector('[data-field="alt-pressure"] dd')?.textContent,
    ).toBe("—");
    expect(card.querySelector('[data-field="alt-wgs84"] dd')?.textContent).toBe(
      "—",
    );
  });

  it("is in Georgian on a Georgian map", async () => {
    const { map } = await mount([mannedTrack()], {}, { lang: "ka" });
    hoverOn(map, "TEST-MAN-0001");
    expect(screen.getByRole("tooltip").textContent).toMatch(
      /ბარომეტრული სიმაღლე/,
    );
  });

  it("goes away when the pointer leaves", async () => {
    const { map } = await mount([mannedTrack()]);
    hoverOn(map, "TEST-MAN-0001");
    expect(screen.queryByRole("tooltip")).not.toBeNull();
    act(() => map.fire("mouseout"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
