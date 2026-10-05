"use client";
// AlertLayer (docs/PLAN.md §3.9, WP-11): the alerts on the map. A
// `proximity` alert is a line between the two aircraft, coloured by the
// alert's severity and dashed when either party is broadcast and
// unverified (R-05); every other kind is a ring on its aircraft; a
// cleared alert draws nothing (the list shows its clear). The severity is
// also told without colour: the line and the ring are wider the graver
// the alert. A party missing from the track map is never guessed: a ring
// on the party that is, and a counter (`alert_peer_missing`).
//
// It reads fields only: positions come from `tracks` (the track store's
// snapshot), the severity and kind from the alert. Updates are coalesced
// by useLayer into one `setData` per animation frame (PLAN §8).
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import { useMemo, useState } from "react";

import type { AlertView, Severity, TrackView } from "../model/index.js";
import { severityToken } from "../symbology/severity.js";
import {
  AlertGaps,
  alertFeatureCollection,
  type AlertFeatureCollection,
} from "./alertFeatures.js";
import { resolveColour, useLayer } from "./useLayer.js";

/**
 * The default source id; pass `id` to draw two alert layers on one map.
 *
 * @beta
 */
export const ALERT_LAYER_ID = "us-alerts";

/** @beta */
export interface AlertLayerIds {
  source: string;
  line: string;
  lineDashed: string;
  ring: string;
}

/** @beta */
export function alertLayerIds(id: string): AlertLayerIds {
  return {
    source: id,
    line: `${id}-line`,
    lineDashed: `${id}-line-dashed`,
    ring: `${id}-ring`,
  };
}

// Display-only constants: widths and the ring's radius in CSS pixels, the
// dash pattern in line widths.
/** @beta */
export const ALERT_WIDTH_PX: Readonly<Record<Severity, number>> = {
  critical: 5,
  warning: 3.5,
  info: 2,
};
/** @beta */
export const ALERT_RING_RADIUS_PX = 20;
/** @beta */
export const ALERT_DASH: [number, number] = [2, 1.5];

/** A `match` on the feature's severity. */
function bySeverity(
  values: Readonly<Record<Severity, string | number>>,
): ExpressionSpecification {
  return [
    "match",
    ["get", "severity"],
    "critical",
    values.critical,
    "warning",
    values.warning,
    values.info,
  ] as ExpressionSpecification;
}

/**
 * The severity colours resolved on the map's element, in its scheme.
 *
 * @beta
 */
export function resolveSeverityColours(
  map: MapLibreMap,
): Record<Severity, string> {
  return {
    critical: resolveColour(map, severityToken("critical")),
    warning: resolveColour(map, severityToken("warning")),
    info: resolveColour(map, severityToken("info")),
  };
}

const EMPTY: AlertFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildAlertLayers(map: MapLibreMap, id: string): readonly string[] {
  const ids = alertLayerIds(id);
  const colour = bySeverity(resolveSeverityColours(map));
  const width = bySeverity(ALERT_WIDTH_PX);
  map.addSource(ids.source, { type: "geojson", data: EMPTY });
  const isLine: ExpressionSpecification = [
    "==",
    ["geometry-type"],
    "LineString",
  ];
  map.addLayer({
    id: ids.line,
    type: "line",
    source: ids.source,
    filter: ["all", isLine, ["!=", ["get", "dashed"], true]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": colour, "line-width": width },
  });
  map.addLayer({
    id: ids.lineDashed,
    type: "line",
    source: ids.source,
    filter: ["all", isLine, ["==", ["get", "dashed"], true]],
    layout: { "line-join": "round" },
    paint: {
      "line-color": colour,
      "line-width": width,
      "line-dasharray": ALERT_DASH,
    },
  });
  map.addLayer({
    id: ids.ring,
    type: "circle",
    source: ids.source,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": ALERT_RING_RADIUS_PX,
      "circle-opacity": 0,
      "circle-stroke-color": colour,
      "circle-stroke-width": width,
    },
  });
  return [ids.line, ids.lineDashed, ids.ring];
}

/** @public */
export interface AlertLayerProps {
  /** Every alert the app shows (a store snapshot's values). */
  alerts: Iterable<AlertView>;
  /** The tracks by id (a track store's snapshot): the only positions used. */
  tracks: ReadonlyMap<string, TrackView>;
  /** Default true. */
  visible?: boolean;
  /** The source id and layer id prefix (default `ALERT_LAYER_ID`). */
  id?: string;
}

/** @public */
export function AlertLayer(props: AlertLayerProps) {
  const { alerts, tracks, visible = true, id = ALERT_LAYER_ID } = props;
  const [gaps] = useState(() => new AlertGaps());
  const data = useMemo(
    () => alertFeatureCollection(alerts, tracks, gaps),
    [alerts, tracks, gaps],
  );
  useLayer({
    id,
    data,
    build: (m) => buildAlertLayers(m, id),
    update: (m, d) => {
      (m.getSource(id) as GeoJSONSource | undefined)?.setData(d);
    },
    visible,
  });
  return null;
}
