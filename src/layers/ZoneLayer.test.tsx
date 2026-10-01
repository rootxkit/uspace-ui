// ZoneLayer, RestrictionLayer and useLayer over the WP-3 MapLibre mock:
// per-frame coalescing, geometry pass-through, the properties that reach
// the map, dimming as MapLibre would evaluate it, selection, labels, the
// hover card, and the lifecycle across style re-applies and unmount.
import {
  createExpression,
  latest,
  validateStyleMin,
  type StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { act, cleanup, render, screen } from "@testing-library/react";
import type * as GeoJSON from "geojson";
import type { LayerSpecification } from "maplibre-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mapFontstack } from "../fonts/faces.js";
import { MapView } from "../map/MapView.js";
import { MockMap, resetMapMock } from "../map/test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "../map/test/render-map.js";
import type { ZoneView } from "../model/index.js";
import { ZONE_DIMMED_OPACITY } from "../symbology/zone.js";
import { layerCounters, resetLayerCountersForTests } from "./counters.js";
import { RestrictionLayer, restrictionLayerIds } from "./RestrictionLayer.js";
import { UNRESOLVED_COLOUR } from "./useLayer.js";
import type { RestrictionView } from "./ZoneCard.js";
import { ZONE_LAYER_ID, ZoneLayer, zoneLayerIds } from "./ZoneLayer.js";

vi.mock("maplibre-gl", async () =>
  (await import("../map/test/maplibre-mock.js")).maplibreMockModule(),
);

// requestAnimationFrame under the test's control: frames run on `flush`.
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

const square = (x: number, y: number): GeoJSON.Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x, y],
      [x + 0.01, y],
      [x + 0.01, y + 0.01],
      [x, y + 0.01],
      [x, y],
    ],
  ],
});

function zone(over: Partial<ZoneView> = {}): ZoneView {
  return {
    identifier: "GEO-TEST-Z0001",
    name: "Test zone",
    type: "PROHIBITED",
    variant: "COMMON",
    reason: ["SECURITY"],
    message: "Test message",
    lowerLimitM: 0,
    lowerRef: "AGL",
    upperLimitM: 120,
    upperRef: "AMSL",
    geometry: square(44.78, 41.69),
    applies: null,
    restrictionState: null,
    version: "7",
    updatedAt: "2026-10-01T08:30:00Z",
    ...over,
  };
}

const MULTI: GeoJSON.MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    square(44.79, 41.7).coordinates,
    square(44.81, 41.71).coordinates,
  ],
};

function sourceOf(map: MockMap, id = ZONE_LAYER_ID) {
  const s = map.getSource(id);
  if (s === undefined) throw new Error(`no source ${id}`);
  return s;
}

type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

function lastData(map: MockMap, id = ZONE_LAYER_ID): FC {
  const calls = sourceOf(map, id).setData.mock.calls;
  const last = calls.at(-1);
  if (last === undefined) throw new Error("setData was never called");
  return last[0] as FC;
}

function layer(map: MockMap, id: string): LayerSpecification {
  const l = map.getLayer(id);
  if (l === undefined) throw new Error(`no layer ${id}`);
  return l;
}

function paint(map: MockMap, id: string, name: string): unknown {
  return (layer(map, id).paint as Record<string, unknown>)[name];
}

function evalPaint(
  expr: unknown,
  kind: "fill" | "line",
  name: string,
  properties: Record<string, unknown>,
): unknown {
  const spec =
    kind === "fill"
      ? latest.paint_fill[name as "fill-opacity"]
      : latest.paint_line[name as "line-opacity"];
  const parsed = createExpression(expr, spec);
  if (parsed.result !== "success")
    throw new Error(JSON.stringify(parsed.value));
  return parsed.value.evaluate({ zoom: 12 }, { type: "Polygon", properties });
}

const ids = zoneLayerIds(ZONE_LAYER_ID);

describe("ZoneLayer", () => {
  it("adds its source, four layers and the two pattern images on load", async () => {
    const { map } = await renderLoadedMap(<ZoneLayer zones={[zone()]} />);
    expect(map.getSource(ZONE_LAYER_ID)).toBeDefined();
    for (const l of [ids.fill, ids.pattern, ids.line, ids.label]) {
      expect(map.getLayer(l)).toBeDefined();
    }
    expect([...map.images.keys()].sort()).toEqual([
      "us-zone-pattern-CONDITIONAL",
      "us-zone-pattern-REQ_AUTHORIZATION",
    ]);
    expect(lastData(map).features).toHaveLength(1);
  });

  it("builds layers MapLibre's style validator accepts", async () => {
    const { map } = await renderLoadedMap(<ZoneLayer zones={[zone()]} />);
    const style = {
      version: 8,
      glyphs: "https://kit.test/{fontstack}/{range}.pbf",
      sources: {
        [ZONE_LAYER_ID]: {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        },
      },
      layers: [...map.layers.values()],
    } as unknown as StyleSpecification;
    expect(validateStyleMin(style)).toEqual([]);
  });

  it("applies two renders in one frame with one setData, the newer data", async () => {
    const first = [zone()];
    const { result, map } = await renderLoadedMap(<ZoneLayer zones={first} />);
    flushFrames();
    const setData = sourceOf(map).setData;
    setData.mockClear();
    const a = [zone({ identifier: "GEO-TEST-Z0002" })];
    const b = [zone({ identifier: "GEO-TEST-Z0003" })];
    result.rerender(
      <MapView {...mapProps()}>
        <ZoneLayer zones={a} />
      </MapView>,
    );
    result.rerender(
      <MapView {...mapProps()}>
        <ZoneLayer zones={b} />
      </MapView>,
    );
    expect(setData).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
    flushFrames();
    expect(setData).toHaveBeenCalledTimes(1);
    expect(lastData(map).features[0]?.properties["identifier"]).toBe(
      "GEO-TEST-Z0003",
    );
    expect(layerCounters().update_superseded).toBe(1);
  });

  it("a single render in a frame is applied too, and supersedes nothing (the twin)", async () => {
    const { result, map } = await renderLoadedMap(
      <ZoneLayer zones={[zone()]} />,
    );
    const setData = sourceOf(map).setData;
    setData.mockClear();
    result.rerender(
      <MapView {...mapProps()}>
        <ZoneLayer zones={[zone({ name: "Renamed" })]} />
      </MapView>,
    );
    flushFrames();
    expect(setData).toHaveBeenCalledTimes(1);
    expect(lastData(map).features[0]?.properties["name"]).toBe("Renamed");
    expect(layerCounters().update_superseded).toBe(0);
  });

  it("puts only the listed properties on the map: identifier yes, extendedProperties no", async () => {
    const served = {
      ...zone(),
      extendedProperties: { cis_applicability: "applies" },
    } as ZoneView;
    const { map } = await renderLoadedMap(<ZoneLayer zones={[served]} />);
    const properties = lastData(map).features[0]?.properties ?? {};
    expect(properties["identifier"]).toBe("GEO-TEST-Z0001");
    expect(Object.keys(properties).sort()).toEqual(
      [
        "applies",
        "identifier",
        "lowerLimitM",
        "lowerRef",
        "name",
        "restrictionState",
        "selected",
        "type",
        "upperLimitM",
        "upperRef",
      ].sort(),
    );
    expect(properties).not.toHaveProperty("extendedProperties");
    expect(properties).not.toHaveProperty("message");
  });

  it("passes a Polygon and a MultiPolygon through untouched", async () => {
    const poly = zone();
    const multi = zone({ identifier: "GEO-TEST-Z0002", geometry: MULTI });
    const before = structuredClone([poly.geometry, multi.geometry]);
    const { map } = await renderLoadedMap(<ZoneLayer zones={[poly, multi]} />);
    const [f0, f1] = lastData(map).features;
    expect(f0?.geometry).toBe(poly.geometry);
    expect(f1?.geometry).toBe(multi.geometry);
    expect([f0?.geometry, f1?.geometry]).toEqual(before);
  });

  it("gives a zone with applies: false the dimmed paint, and null the full one", async () => {
    const { map } = await renderLoadedMap(
      <ZoneLayer
        zones={[
          zone({ applies: false }),
          zone({ identifier: "GEO-TEST-Z0002", applies: null }),
          zone({ identifier: "GEO-TEST-Z0003", applies: true }),
        ]}
      />,
    );
    const [dimmed, unstated, applies] = lastData(map).features.map(
      (f) => f.properties,
    );
    const lineOpacity = paint(map, ids.line, "line-opacity");
    const fillOpacity = paint(map, ids.fill, "fill-opacity");
    const line = (p: Record<string, unknown> | undefined) =>
      evalPaint(lineOpacity, "line", "line-opacity", p ?? {});
    const fill = (p: Record<string, unknown> | undefined) =>
      evalPaint(fillOpacity, "fill", "fill-opacity", p ?? {}) as number;
    expect(line(dimmed)).toBe(ZONE_DIMMED_OPACITY);
    expect(line(unstated)).toBe(1);
    expect(line(applies)).toBe(1);
    expect(fill(dimmed)).toBeLessThan(fill(applies));
    expect(fill(unstated)).toBe(fill(applies));
  });

  it("marks the selected zone, and only it", async () => {
    const { map } = await renderLoadedMap(
      <ZoneLayer
        zones={[zone(), zone({ identifier: "GEO-TEST-Z0002" })]}
        selectedId="GEO-TEST-Z0002"
      />,
    );
    expect(lastData(map).features.map((f) => f.properties["selected"])).toEqual(
      [false, true],
    );
  });

  it("calls onSelect with the identifier of a clicked zone", async () => {
    const onSelect = vi.fn();
    const { map } = await renderLoadedMap(
      <ZoneLayer zones={[zone()]} onSelect={onSelect} />,
    );
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: "GEO-TEST-Z0001" } },
    ] as never);
    act(() => map.fire("click", { point: { x: 5, y: 6 } }));
    expect(onSelect).toHaveBeenCalledWith("GEO-TEST-Z0001");
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 5, y: 6 },
      { layers: [ids.fill] },
    );
  });

  it("does not call onSelect for a click beside every zone (the twin)", async () => {
    const onSelect = vi.fn();
    const { map } = await renderLoadedMap(
      <ZoneLayer zones={[zone()]} onSelect={onSelect} />,
    );
    map.queryRenderedFeatures.mockReturnValue([]);
    act(() => map.fire("click", { point: { x: 5, y: 6 } }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("labels with the kit's map fontstack, shown by default", async () => {
    const { map } = await renderLoadedMap(<ZoneLayer zones={[zone()]} />);
    const label = layer(map, ids.label);
    expect((label.layout as Record<string, unknown>)["text-font"]).toEqual([
      mapFontstack,
    ]);
    expect(map.getLayoutProperty(ids.label, "visibility")).toBe("visible");
  });

  it("hides the labels, and only them, with labels={false}", async () => {
    const { map } = await renderLoadedMap(
      <ZoneLayer zones={[zone()]} labels={false} />,
    );
    expect(map.getLayoutProperty(ids.label, "visibility")).toBe("none");
    expect(map.getLayoutProperty(ids.line, "visibility")).toBe("visible");
  });

  it("hides every layer with visible={false} and shows them again", async () => {
    const { result, map } = await renderLoadedMap(
      <ZoneLayer zones={[zone()]} visible={false} />,
    );
    for (const l of [ids.fill, ids.pattern, ids.line, ids.label]) {
      expect(map.getLayoutProperty(l, "visibility")).toBe("none");
    }
    result.rerender(
      <MapView {...mapProps()}>
        <ZoneLayer zones={[zone()]} />
      </MapView>,
    );
    for (const l of [ids.fill, ids.pattern, ids.line, ids.label]) {
      expect(map.getLayoutProperty(l, "visibility")).toBe("visible");
    }
  });

  it("puts the source, the layers, the images and the data back after a scheme change", async () => {
    const zones = [zone()];
    const { result, map } = await renderLoadedMap(<ZoneLayer zones={zones} />);
    result.rerender(
      <MapView {...mapProps({ scheme: "dark" })}>
        <ZoneLayer zones={zones} />
      </MapView>,
    );
    expect(map.setStyleCalls).toHaveLength(1);
    await vi.waitFor(() => expect(map.getSource(ZONE_LAYER_ID)).toBeDefined());
    expect(map.getLayer(ids.label)).toBeDefined();
    expect(map.images.size).toBe(2);
    expect(lastData(map).features[0]?.properties["identifier"]).toBe(
      "GEO-TEST-Z0001",
    );
  });

  it("skips a frame that lands while the style re-applies, and the reload pushes the newest data", async () => {
    const { result, map } = await renderLoadedMap(
      <ZoneLayer zones={[zone()]} />,
    );
    const renamed = [zone({ name: "During reload" })];
    result.rerender(
      <MapView {...mapProps()}>
        <ZoneLayer zones={renamed} />
      </MapView>,
    );
    expect(frames.size).toBe(1);
    // The style goes away before the frame runs; style.load is held back.
    MockMap.autoLoad = false;
    map.setStyle(map.getStyle());
    expect(map.getSource(ZONE_LAYER_ID)).toBeUndefined();
    expect(() => flushFrames()).not.toThrow();
    act(() => map.fire("style.load"));
    expect(lastData(map).features[0]?.properties["name"]).toBe("During reload");
  });

  it("removes its layers and source on unmount", async () => {
    const { result, map } = await renderLoadedMap(
      <ZoneLayer zones={[zone()]} />,
    );
    result.rerender(<MapView {...mapProps()} />);
    expect(map.getSource(ZONE_LAYER_ID)).toBeUndefined();
    for (const l of [ids.fill, ids.pattern, ids.line, ids.label]) {
      expect(map.getLayer(l)).toBeUndefined();
    }
  });

  it("unmounts with its MapView without touching the removed map", async () => {
    const { result, map } = await renderLoadedMap(
      <ZoneLayer zones={[zone()]} />,
    );
    const removeLayer = vi.spyOn(map, "removeLayer");
    result.unmount();
    expect(map.removed).toBe(true);
    expect(removeLayer).not.toHaveBeenCalled();
  });

  it("draws in the token colours resolved on the map's element", async () => {
    const result = render(
      <MapView {...mapProps()}>
        <ZoneLayer zones={[zone()]} />
      </MapView>,
    );
    await vi.waitFor(() => expect(MockMap.instances).toHaveLength(1));
    const map = MockMap.instances[0] as MockMap;
    map.options.container.style.setProperty("--us-zone-PROHIBITED", "#861325");
    // The style re-applies, as on a scheme change, and resolves again.
    result.rerender(
      <MapView {...mapProps({ scheme: "dark" })}>
        <ZoneLayer zones={[zone()]} />
      </MapView>,
    );
    await vi.waitFor(() => expect(map.getLayer(ids.line)).toBeDefined());
    const colour = paint(map, ids.line, "line-color") as unknown[];
    expect(colour[3]).toBe("#861325");
  });

  it("counts a token that does not resolve and draws it grey, never leaves it out", async () => {
    const { map } = await renderLoadedMap(<ZoneLayer zones={[zone()]} />);
    expect(layerCounters().token_unresolved).toBeGreaterThan(0);
    const colour = paint(map, ids.line, "line-color") as unknown[];
    expect(colour).toContain(UNRESOLVED_COLOUR);
  });
});

describe("the zone hover card", () => {
  async function hoverOver(z: ZoneView, lang: "en" | "ka" = "en") {
    const { map } = await renderLoadedMap(<ZoneLayer zones={[z]} />, { lang });
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: z.identifier } },
    ] as never);
    act(() => map.fire("mousemove", { point: { x: 10, y: 20 } }));
    return map;
  }

  it("shows the name, type, limits with reference, message, version and update time", async () => {
    await hoverOver(zone({ applies: true }));
    const card = screen.getByRole("tooltip");
    const text = card.textContent ?? "";
    expect(text).toContain("Test zone");
    expect(text).toContain("GEO-TEST-Z0001");
    expect(text).toContain("Prohibited");
    expect(text).toContain("0 m AGL");
    expect(text).toContain("120 m AMSL");
    expect(text).toContain("Test message");
    expect(text).toContain("7");
    expect(text).toContain("2026-10-01 08:30 UTC");
    expect(text).toContain("Applies now, as the server reports");
  });

  it("says 'does not apply now' as the server reports, for applies: false", async () => {
    await hoverOver(zone({ applies: false }));
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Does not apply now, as the server reports",
    );
  });

  it("says nothing about applicability when the server did not (applies: null)", async () => {
    await hoverOver(zone({ applies: null }));
    const card = screen.getByRole("tooltip");
    expect(card.querySelector('[data-field="applicability"]')).toBeNull();
    expect(card.textContent).not.toMatch(/apply|applies/i);
  });

  it("shows dashes for a missing version, update time and limit", async () => {
    await hoverOver(
      zone({ version: null, updatedAt: null, upperLimitM: null, name: null }),
    );
    const card = screen.getByRole("tooltip");
    const dd = (f: string) =>
      card.querySelector(`[data-field="${f}"] dd`)?.textContent;
    expect(dd("version")).toBe("—");
    expect(dd("updated")).toBe("—");
    expect(dd("upper")).toBe("—");
    expect(card.textContent).toContain("Unnamed zone");
  });

  it("speaks Georgian in a ka map", async () => {
    await hoverOver(zone({ applies: true }), "ka");
    const text = screen.getByRole("tooltip").textContent ?? "";
    expect(text).toContain("აკრძალული");
    expect(text).toContain("ახლა მოქმედებს, სერვერის ცნობით");
  });

  it("goes away when the pointer leaves the zone or the map", async () => {
    const map = await hoverOver(zone());
    expect(screen.getByRole("tooltip")).toBeTruthy();
    map.queryRenderedFeatures.mockReturnValue([]);
    act(() => map.fire("mousemove", { point: { x: 300, y: 300 } }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: "GEO-TEST-Z0001" } },
    ] as never);
    act(() => map.fire("mousemove", { point: { x: 10, y: 20 } }));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    act(() => map.fire("mouseout"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("RestrictionLayer", () => {
  const rids = restrictionLayerIds("us-restrictions");
  const dar = (
    id: string,
    restrictionState: RestrictionView["restrictionState"],
  ): RestrictionView =>
    zone({
      identifier: id,
      name: `Restriction ${id}`,
      type: "REQ_AUTHORIZATION",
      reason: ["DAR"],
      restrictionState,
    });
  const trio: RestrictionView[] = [
    dar("DARA1B2", "planned"),
    dar("DARC3D4", "active"),
    dar("DARE5F6", "ended"),
    dar("DARG7H8", "cancelled"),
  ];

  it("has a line layer per state with its dash array", async () => {
    const { map } = await renderLoadedMap(
      <RestrictionLayer restrictions={trio} />,
    );
    const dash = (k: keyof typeof rids.lines) =>
      paint(map, rids.lines[k], "line-dasharray");
    expect(dash("planned")).toEqual([3, 2]);
    expect(dash("cancelled")).toEqual([1, 2]);
    expect(dash("active")).toBeUndefined();
    expect(dash("ended")).toBeUndefined();
    const width = (k: keyof typeof rids.lines) =>
      paint(map, rids.lines[k], "line-width") as number;
    expect(width("active")).toBeGreaterThan(width("ended"));
  });

  it("still draws a cancelled restriction, dimmed", async () => {
    const { map } = await renderLoadedMap(
      <RestrictionLayer restrictions={trio} />,
    );
    const cancelled = lastData(map, "us-restrictions").features.find(
      (f) => f.properties["identifier"] === "DARG7H8",
    );
    expect(cancelled).toBeDefined();
    expect(map.getLayoutProperty(rids.lines.cancelled, "visibility")).toBe(
      "visible",
    );
    const opacity = paint(map, rids.lines.cancelled, "line-opacity");
    expect(
      evalPaint(opacity, "line", "line-opacity", cancelled?.properties ?? {}),
    ).toBe(ZONE_DIMMED_OPACITY);
    const active = lastData(map, "us-restrictions").features.find(
      (f) => f.properties["identifier"] === "DARC3D4",
    );
    expect(
      evalPaint(opacity, "line", "line-opacity", active?.properties ?? {}),
    ).toBe(1);
  });

  it("shows the state and the times in its hover card", async () => {
    const r = {
      ...dar("DARC3D4", "active"),
      startsAt: "2026-10-02T09:00:00Z",
      endsAt: "2026-10-02T11:30:00Z",
    };
    const { map } = await renderLoadedMap(
      <RestrictionLayer restrictions={[r]} />,
    );
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: "DARC3D4" } },
    ] as never);
    act(() => map.fire("mousemove", { point: { x: 1, y: 1 } }));
    const text = screen.getByRole("tooltip").textContent ?? "";
    expect(text).toContain("Active");
    expect(text).toContain("2026-10-02 09:00 UTC");
    expect(text).toContain("2026-10-02 11:30 UTC");
  });

  it("says the state was not provided, and dashes absent times", async () => {
    const { map } = await renderLoadedMap(
      <RestrictionLayer restrictions={[dar("DARK9L0", null)]} />,
    );
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { identifier: "DARK9L0" } },
    ] as never);
    act(() => map.fire("mousemove", { point: { x: 1, y: 1 } }));
    const card = screen.getByRole("tooltip");
    expect(card.textContent).toContain("State not provided");
    expect(card.querySelector('[data-field="starts"] dd')?.textContent).toBe(
      "—",
    );
  });

  it("hides with visible={false}", async () => {
    const { map } = await renderLoadedMap(
      <RestrictionLayer restrictions={trio} visible={false} />,
    );
    expect(map.getLayoutProperty(rids.fill, "visibility")).toBe("none");
  });
});
