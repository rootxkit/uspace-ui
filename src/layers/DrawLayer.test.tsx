// DrawLayer over the WP-3 MapLibre mock (1.0.0; uspace-ussp Q28 gap 1):
// a click adds a vertex as MapLibre reports it and a click past the bound
// adds nothing and is counted (E-10, both ways); a drag moves a vertex and
// the click that ends it adds nothing; a circle's centre is placed by a
// click; the server's circle outline is drawn exactly as given, and
// without one nothing but the centre is drawn (the kit draws no circle).
import { act, cleanup } from "@testing-library/react";
import type * as GeoJSON from "geojson";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapView } from "../map/MapView.js";
import { MockMap, resetMapMock } from "../map/test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "../map/test/render-map.js";
import type { DrawOutline } from "../model/index.js";
import { layerCounters, resetLayerCountersForTests } from "./counters.js";
import {
  DRAW_LAYER_ID,
  DrawLayer,
  drawFeatureCollection,
  drawLayerIds,
  outlineWithClick,
  outlineWithMove,
  type DrawLayerProps,
} from "./DrawLayer.js";

vi.mock("maplibre-gl", async () =>
  (await import("../map/test/maplibre-mock.js")).maplibreMockModule(),
);

beforeEach(() => {
  stubSourceJson();
  resetLayerCountersForTests();
  // Frames run when a test flushes them (after a click), as the browser
  // would run the next one.
  frames.length = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  cleanup();
  resetMapMock();
  resetLayerCountersForTests();
});

const frames: FrameRequestCallback[] = [];

function flushFrames(): void {
  for (const cb of frames.splice(0)) cb(0);
}

const ids = drawLayerIds(DRAW_LAYER_ID);
const A = { lat: 41.7151, lng: 44.8271 };
const B = { lat: 41.72, lng: 44.83 };
const C = { lat: 41.71, lng: 44.835 };
const POLY: DrawOutline = { kind: "polygon", vertices: [] };
const CIRCLE: DrawOutline = { kind: "circle", center: null, radiusM: 300 };
// A circle outline as an API would return it (TEST values, not computed
// here: four points of a square stand in for the server's ring).
const SERVER_RING: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [44.82, 41.71],
      [44.83, 41.71],
      [44.83, 41.72],
      [44.82, 41.72],
      [44.82, 41.71],
    ],
  ],
};

type FC = ReturnType<typeof drawFeatureCollection>;

function lastData(map: MockMap): FC {
  const last = map.getSource(DRAW_LAYER_ID)?.setData.mock.calls.at(-1);
  if (last === undefined) throw new Error("setData was never called");
  return last[0] as FC;
}

const event = (p: { lat: number; lng: number }) => ({
  point: { x: 10, y: 10 },
  lngLat: { lat: p.lat, lng: p.lng },
  preventDefault: vi.fn(),
});

async function mount(
  start: DrawOutline,
  over: Partial<Omit<DrawLayerProps, "outline" | "onChange">> = {},
) {
  const changes: DrawOutline[] = [];
  function Harness() {
    const [outline, setOutline] = useState(start);
    return (
      <DrawLayer
        maxVertices={3}
        {...over}
        outline={outline}
        onChange={(o) => {
          changes.push(o);
          setOutline(o);
        }}
      />
    );
  }
  const r = await renderLoadedMap(<Harness />);
  return { ...r, changes };
}

function click(map: MockMap, p: { lat: number; lng: number }): void {
  act(() => map.fire("click", event(p)));
  act(() => flushFrames());
}

describe("DrawLayer: setup", () => {
  it("adds its source and five layers, and removes them on unmount", async () => {
    const { map, result } = await mount(POLY);
    for (const l of [ids.fill, ids.line, ids.circle, ids.points, ids.labels]) {
      expect(map.getLayer(l), l).toBeDefined();
    }
    result.rerender(<MapView {...mapProps()} />);
    expect(map.getSource(DRAW_LAYER_ID)).toBeUndefined();
  });
});

describe("a polygon", () => {
  it("adds each click as a vertex, exactly as MapLibre reports it", async () => {
    const { map, changes } = await mount(POLY);
    click(map, A);
    click(map, B);
    click(map, C);
    expect(changes.at(-1)).toEqual({ kind: "polygon", vertices: [A, B, C] });
    const fc = lastData(map);
    expect(fc.features.map((f) => f.properties.role)).toEqual([
      "area",
      "edge",
      "vertex",
      "vertex",
      "vertex",
    ]);
    // Closed by a copy of the first vertex, nothing else added.
    expect(fc.features[1]?.geometry).toEqual({
      type: "LineString",
      coordinates: [
        [A.lng, A.lat],
        [B.lng, B.lat],
        [C.lng, C.lat],
        [A.lng, A.lat],
      ],
    });
    expect(fc.features.slice(2).map((f) => f.properties.label)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("refuses a vertex past maxVertices and counts it", async () => {
    const { map, changes } = await mount({
      kind: "polygon",
      vertices: [A, B, C],
    });
    click(map, { lat: 41.0, lng: 44.0 });
    expect(changes).toEqual([]);
    expect(layerCounters().draw_vertex_refused).toBe(1);
  });

  it("adds one below the bound, counting nothing (the twin)", async () => {
    const { map, changes } = await mount({ kind: "polygon", vertices: [A, B] });
    click(map, C);
    expect(changes).toEqual([{ kind: "polygon", vertices: [A, B, C] }]);
    expect(layerCounters().draw_vertex_refused).toBe(0);
  });

  it("moves a dragged vertex, without panning, and the click ending the drag adds nothing", async () => {
    const { map, changes } = await mount({ kind: "polygon", vertices: [A, B] });
    map.queryRenderedFeatures.mockReturnValue([
      { properties: { index: 1 } },
    ] as never);
    const down = event(B);
    act(() => map.fire("mousedown", down));
    expect(down.preventDefault).toHaveBeenCalledTimes(1);
    act(() => map.fire("mousemove", event(C)));
    act(() => map.fire("mouseup", event(C)));
    map.queryRenderedFeatures.mockReturnValue([]);
    click(map, C);
    expect(changes).toEqual([{ kind: "polygon", vertices: [A, C] }]);
  });

  it("a mousedown beside every point starts no drag (the twin)", async () => {
    const { map, changes } = await mount({ kind: "polygon", vertices: [A] });
    const down = event(B);
    act(() => map.fire("mousedown", down));
    expect(down.preventDefault).not.toHaveBeenCalled();
    act(() => map.fire("mousemove", event(C)));
    expect(changes).toEqual([]);
  });

  it("adds nothing while inactive", async () => {
    const { map, changes } = await mount(POLY, { active: false });
    click(map, A);
    expect(changes).toEqual([]);
  });

  it("adds when active is given as true (the twin)", async () => {
    const { map, changes } = await mount(POLY, { active: true });
    click(map, A);
    expect(changes).toEqual([{ kind: "polygon", vertices: [A] }]);
  });
});

describe("a circle", () => {
  it("places the centre at a click and keeps the radius", async () => {
    const { map, changes } = await mount(CIRCLE);
    click(map, A);
    expect(changes).toEqual([{ kind: "circle", center: A, radiusM: 300 }]);
    expect(lastData(map).features.map((f) => f.properties.role)).toEqual([
      "center",
    ]);
  });

  it("draws the server's outline exactly as given", async () => {
    const { map } = await mount(
      { kind: "circle", center: A, radiusM: 300 },
      { circleOutline: SERVER_RING },
    );
    const fc = lastData(map);
    expect(fc.features.map((f) => f.properties.role)).toEqual([
      "circle",
      "center",
    ]);
    expect(fc.features[0]?.geometry).toBe(SERVER_RING);
  });

  it("draws no outline without one from the server: the kit draws no circle (the twin)", async () => {
    const { map } = await mount({ kind: "circle", center: A, radiusM: 300 });
    const fc = lastData(map);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [A.lng, A.lat],
    });
  });
});

describe("the pure steps", () => {
  it("outlineWithClick and outlineWithMove", () => {
    expect(outlineWithClick(POLY, A, 1)).toEqual({
      kind: "polygon",
      vertices: [A],
    });
    expect(outlineWithClick({ kind: "polygon", vertices: [A] }, B, 1)).toBe(
      null,
    );
    expect(
      outlineWithMove({ kind: "polygon", vertices: [A, B] }, 0, C),
    ).toEqual({ kind: "polygon", vertices: [C, B] });
    const same: DrawOutline = { kind: "polygon", vertices: [A] };
    expect(outlineWithMove(same, 5, C)).toBe(same);
    expect(outlineWithMove(CIRCLE, 0, B)).toEqual({ ...CIRCLE, center: B });
  });

  it("two vertices are an open edge, one is a point, none is nothing", () => {
    expect(
      drawFeatureCollection({ kind: "polygon", vertices: [A, B] }, null)
        .features[0]?.geometry,
    ).toEqual({
      type: "LineString",
      coordinates: [
        [A.lng, A.lat],
        [B.lng, B.lat],
      ],
    });
    expect(
      drawFeatureCollection({ kind: "polygon", vertices: [A] }, null).features,
    ).toHaveLength(1);
    expect(drawFeatureCollection(POLY, null).features).toEqual([]);
    expect(drawFeatureCollection(CIRCLE, null).features).toEqual([]);
  });
});

describe("events faster than the app renders", () => {
  it("keeps every click of one frame: each builds on the last", async () => {
    const { map, changes } = await mount(POLY);
    act(() => {
      map.fire("click", event(A));
      map.fire("click", event(B));
      map.fire("click", event(C));
    });
    expect(changes.at(-1)).toEqual({ kind: "polygon", vertices: [A, B, C] });
  });

  it("follows an app that refuses a change from its next render (the twin)", async () => {
    const changes: DrawOutline[] = [];
    // The app keeps [A]: on every change it renders its own outline again.
    function Refusing() {
      const [held, setHeld] = useState<DrawOutline>({
        kind: "polygon",
        vertices: [A],
      });
      return (
        <DrawLayer
          outline={held}
          maxVertices={3}
          onChange={(o) => {
            changes.push(o);
            setHeld({ kind: "polygon", vertices: [A] });
          }}
        />
      );
    }
    const { map } = await renderLoadedMap(<Refusing />);
    click(map, B);
    click(map, C);
    expect(changes).toEqual([
      { kind: "polygon", vertices: [A, B] },
      { kind: "polygon", vertices: [A, C] },
    ]);
  });
});
