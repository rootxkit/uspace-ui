"use client";
// ClusterLayer (F3411 NET0480, NET0490; owner decision 2026-10-31): the
// clusters of Network RID peer flights the server sent for a view wider
// than NetDetailsMaxDisplayAreaDiagonalKm, each drawn as its box with the
// number of flights in it. It reads the boxes and counts as given: the
// server decides when to cluster and which flight belongs where; the kit
// measures no distance and assigns nothing (CLAUDE.md rule 2). A cluster
// carries no per-flight detail, so there is nothing to select or hover.
import type * as GeoJSON from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useMemo } from "react";

import { mapFontstack } from "../fonts/faces.js";
import type { ClusterView } from "../model/index.js";
import { tokens } from "../theme/tokens.js";
import { resolveColour, useLayer } from "./useLayer.js";

/** @beta */
export const CLUSTER_LAYER_ID = "us-clusters";

/**
 * Fill opacity of a cluster box. Display-only constant.
 *
 * @beta
 */
export const CLUSTER_FILL_OPACITY = 0.12;

/**
 * Size of a cluster's count. Display-only constant.
 *
 * @beta
 */
export const CLUSTER_LABEL_SIZE_PX = 14;

/** @beta */
export interface ClusterLayerIds {
  source: string;
  fill: string;
  line: string;
  label: string;
}

/** @beta */
export function clusterLayerIds(id: string): ClusterLayerIds {
  return {
    source: id,
    fill: `${id}-fill`,
    line: `${id}-line`,
    label: `${id}-label`,
  };
}

/** @beta */
export type ClusterFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  { count: number; label: string }
>;

/**
 * The clusters as GeoJSON: each box as given, its corners in ring order,
 * with its count as a property and a label.
 *
 * @beta
 */
export function clusterFeatureCollection(
  clusters: readonly ClusterView[],
): ClusterFeatureCollection {
  return {
    type: "FeatureCollection",
    features: clusters.map((c) => ({
      type: "Feature",
      properties: {
        count: c.numberOfFlights,
        label: String(c.numberOfFlights),
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [c.minLng, c.minLat],
            [c.maxLng, c.minLat],
            [c.maxLng, c.maxLat],
            [c.minLng, c.maxLat],
            [c.minLng, c.minLat],
          ],
        ],
      },
    })),
  };
}

const EMPTY: ClusterFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildClusterLayers(map: MapLibreMap, id: string): readonly string[] {
  const ids = clusterLayerIds(id);
  const colour = resolveColour(map, tokens.trust.provider);
  const halo = resolveColour(map, "--us-surface");
  map.addSource(ids.source, { type: "geojson", data: EMPTY });
  map.addLayer({
    id: ids.fill,
    type: "fill",
    source: ids.source,
    paint: { "fill-color": colour, "fill-opacity": CLUSTER_FILL_OPACITY },
  });
  map.addLayer({
    id: ids.line,
    type: "line",
    source: ids.source,
    paint: { "line-color": colour, "line-width": 1.5 },
  });
  map.addLayer({
    id: ids.label,
    type: "symbol",
    source: ids.source,
    layout: {
      "text-field": ["get", "label"],
      "text-font": [mapFontstack],
      "text-size": CLUSTER_LABEL_SIZE_PX,
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": colour,
      "text-halo-color": halo,
      "text-halo-width": 2,
    },
  });
  return [ids.fill, ids.line, ids.label];
}

/** @public */
export interface ClusterLayerProps {
  clusters: readonly ClusterView[];
  /** Default true. */
  visible?: boolean;
  /** The source id and layer id prefix (default `CLUSTER_LAYER_ID`). */
  id?: string;
}

/** @public */
export function ClusterLayer(props: ClusterLayerProps) {
  const { clusters, visible = true, id = CLUSTER_LAYER_ID } = props;
  const data = useMemo(() => clusterFeatureCollection(clusters), [clusters]);
  useLayer({
    id,
    data,
    build: (m) => buildClusterLayers(m, id),
    update: (m, d) => {
      (m.getSource(id) as GeoJSONSource | undefined)?.setData(d);
    },
    visible,
  });
  return null;
}
