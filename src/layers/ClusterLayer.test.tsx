// ClusterLayer over the WP-3 MapLibre mock: the clusters the server sent
// are drawn as given, each box with its count and no per-flight detail;
// none sent, nothing drawn; the source and its layers go on unmount.
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MapView } from "../map/MapView.js";
import { MockMap, resetMapMock } from "../map/test/maplibre-mock.js";
import {
  mapProps,
  renderLoadedMap,
  stubSourceJson,
} from "../map/test/render-map.js";
import type { ClusterView } from "../model/index.js";
import {
  CLUSTER_LAYER_ID,
  ClusterLayer,
  clusterFeatureCollection,
  clusterLayerIds,
  type ClusterFeatureCollection,
} from "./ClusterLayer.js";

vi.mock("maplibre-gl", async () =>
  (await import("../map/test/maplibre-mock.js")).maplibreMockModule(),
);

beforeEach(() => {
  stubSourceJson();
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  cleanup();
  resetMapMock();
});

const ids = clusterLayerIds(CLUSTER_LAYER_ID);

const two: ClusterView[] = [
  {
    minLat: 41.7,
    minLng: 44.8,
    maxLat: 41.71,
    maxLng: 44.815,
    numberOfFlights: 2,
  },
  {
    minLat: 41.71,
    minLng: 44.815,
    maxLat: 41.72,
    maxLng: 44.83,
    numberOfFlights: 1,
  },
];

function lastData(map: MockMap): ClusterFeatureCollection {
  const last = map.getSource(CLUSTER_LAYER_ID)?.setData.mock.calls.at(-1);
  if (last === undefined) throw new Error("setData was never called");
  return last[0] as ClusterFeatureCollection;
}

describe("ClusterLayer", () => {
  it("adds its source and three layers, and removes them on unmount", async () => {
    const { map, result } = await renderLoadedMap(
      <ClusterLayer clusters={two} />,
    );
    for (const l of [ids.fill, ids.line, ids.label])
      expect(map.getLayer(l), l).toBeDefined();
    result.rerender(<MapView {...mapProps()} />);
    expect(map.getSource(CLUSTER_LAYER_ID)).toBeUndefined();
  });

  it("draws each cluster's box as given with its count, and nothing of a flight", async () => {
    const { map } = await renderLoadedMap(<ClusterLayer clusters={two} />);
    const fc = lastData(map);
    expect(fc.features.map((f) => f.properties)).toEqual([
      { count: 2, label: "2" },
      { count: 1, label: "1" },
    ]);
    expect(fc.features[0]?.geometry.coordinates[0]).toEqual([
      [44.8, 41.7],
      [44.815, 41.7],
      [44.815, 41.71],
      [44.8, 41.71],
      [44.8, 41.7],
    ]);
  });

  it("draws nothing when the server sent no cluster", () => {
    expect(clusterFeatureCollection([]).features).toEqual([]);
  });
});
