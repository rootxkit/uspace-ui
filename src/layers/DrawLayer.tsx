"use client";
// DrawLayer (1.0.0; uspace-ussp docs/PLAN.md Q28 gap 1): the outline a
// person is drawing, on the map. A click adds a polygon vertex or places a
// circle's centre; a vertex is moved by dragging it. Every point is the
// map's `lngLat` as MapLibre reports it: no snapping, no rounding, no
// reordering. The polygon's edges are drawn in the order given, closed by
// repeating the first vertex (a copy, not a computation).
//
// A circle needs geodesy to become an outline, and geodesy lives once, in
// Go (docs/PLAN.md §1.1, spec 00 §6, 06 T12; uspace-core
// `geodesy.Destination`, which the CISP already draws circles with). So
// the kit never draws one: the app passes `circleOutline`, the outline as
// its API drew it, and the layer shows it as given; without one the circle
// is its centre on the map and its radius in words (form/OutlineFields).
//
// The vertex list is bounded by `maxVertices`, the app's bound from its
// API (no default, CLAUDE.md rule 3): a click past it changes nothing and
// is counted (`draw_vertex_refused`, rule 9); OutlineFields says so.
// Dragging needs a pointer; OutlineFields is the keyboard and typed path
// to every point (WCAG 2.5.7).
import type * as GeoJSON from "geojson";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";

import { mapFontstack } from "../fonts/faces.js";
import type { DrawOutline, DrawPoint } from "../model/index.js";
import { countLayer } from "./counters.js";
import { resolveColour, useLayer } from "./useLayer.js";

/**
 * The default source id and layer id prefix.
 *
 * @beta
 */
export const DRAW_LAYER_ID = "uspace-draw";

/**
 * Display-only constants: the drawn line and the point marks.
 *
 * @beta
 */
export const DRAW_LINE_WIDTH_PX = 2;
/** @beta */
export const DRAW_POINT_RADIUS_PX = 6;
/** @beta */
export const DRAW_FILL_OPACITY = 0.12;

/** @beta */
export interface DrawLayerIds {
  source: string;
  fill: string;
  line: string;
  circle: string;
  points: string;
  labels: string;
}

/** @beta */
export function drawLayerIds(id: string): DrawLayerIds {
  return {
    source: id,
    fill: `${id}-fill`,
    line: `${id}-line`,
    circle: `${id}-circle`,
    points: `${id}-points`,
    labels: `${id}-labels`,
  };
}

/**
 * What a feature of the draw source is, as its `role` property says.
 *
 * @beta
 */
export type DrawRole = "area" | "edge" | "vertex" | "center" | "circle";

/** @beta */
export type DrawFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { role: DrawRole; index: number; label: string }
>;

const position = (p: DrawPoint): GeoJSON.Position => [p.lng, p.lat];

/**
 * The features of an outline: each vertex (numbered from 1 in the order
 * given), the edges and, from three vertices, the area, both closed by a
 * copy of the first vertex; for a circle its centre and, when the app has
 * one, the server's outline untouched.
 *
 * @beta
 */
export function drawFeatureCollection(
  outline: DrawOutline,
  circleOutline: GeoJSON.Polygon | GeoJSON.MultiPolygon | null,
): DrawFeatureCollection {
  const features: DrawFeatureCollection["features"] = [];
  if (outline.kind === "polygon") {
    const vs = outline.vertices;
    const ring = vs.length > 0 ? [...vs, vs[0] as DrawPoint].map(position) : [];
    if (vs.length >= 3) {
      features.push({
        type: "Feature",
        properties: { role: "area", index: -1, label: "" },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }
    if (vs.length >= 2) {
      features.push({
        type: "Feature",
        properties: { role: "edge", index: -1, label: "" },
        geometry: {
          type: "LineString",
          coordinates: vs.length === 2 ? vs.map(position) : ring,
        },
      });
    }
    vs.forEach((p, i) => {
      features.push({
        type: "Feature",
        properties: { role: "vertex", index: i, label: String(i + 1) },
        geometry: { type: "Point", coordinates: position(p) },
      });
    });
    return { type: "FeatureCollection", features };
  }
  if (circleOutline !== null) {
    features.push({
      type: "Feature",
      properties: { role: "circle", index: -1, label: "" },
      geometry: circleOutline,
    });
  }
  if (outline.center !== null) {
    features.push({
      type: "Feature",
      properties: { role: "center", index: 0, label: "" },
      geometry: { type: "Point", coordinates: position(outline.center) },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * The outline after a click at `p`: a vertex appended (refused at
 * `maxVertices`, returning null) or the circle's centre placed.
 *
 * @beta
 */
export function outlineWithClick(
  outline: DrawOutline,
  p: DrawPoint,
  maxVertices: number,
): DrawOutline | null {
  if (outline.kind === "circle") return { ...outline, center: p };
  if (outline.vertices.length >= maxVertices) return null;
  return { kind: "polygon", vertices: [...outline.vertices, p] };
}

/**
 * The outline with point `index` (a vertex, or 0 for the centre) at `p`.
 *
 * @beta
 */
export function outlineWithMove(
  outline: DrawOutline,
  index: number,
  p: DrawPoint,
): DrawOutline {
  if (outline.kind === "circle") return { ...outline, center: p };
  if (index < 0 || index >= outline.vertices.length) return outline;
  const vertices = [...outline.vertices];
  vertices[index] = p;
  return { kind: "polygon", vertices };
}

function buildDrawLayers(map: MapLibreMap, id: string): readonly string[] {
  const ids = drawLayerIds(id);
  const accent = resolveColour(map, "--us-brand-accent");
  const halo = resolveColour(map, "--us-surface");
  const text = resolveColour(map, "--us-text");
  map.addSource(ids.source, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: ids.fill,
    type: "fill",
    source: ids.source,
    filter: ["==", ["get", "role"], "area"],
    paint: { "fill-color": accent, "fill-opacity": DRAW_FILL_OPACITY },
  });
  // The draft edges are dashed; the server's circle is solid.
  map.addLayer({
    id: ids.line,
    type: "line",
    source: ids.source,
    filter: ["==", ["get", "role"], "edge"],
    paint: {
      "line-color": accent,
      "line-width": DRAW_LINE_WIDTH_PX,
      "line-dasharray": [2, 1],
    },
  });
  map.addLayer({
    id: ids.circle,
    type: "line",
    source: ids.source,
    filter: ["==", ["get", "role"], "circle"],
    paint: { "line-color": accent, "line-width": DRAW_LINE_WIDTH_PX },
  });
  map.addLayer({
    id: ids.points,
    type: "circle",
    source: ids.source,
    filter: ["in", ["get", "role"], ["literal", ["vertex", "center"]]],
    paint: {
      "circle-color": accent,
      "circle-radius": DRAW_POINT_RADIUS_PX,
      "circle-stroke-color": halo,
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: ids.labels,
    type: "symbol",
    source: ids.source,
    filter: ["==", ["get", "role"], "vertex"],
    layout: {
      "text-field": ["get", "label"],
      "text-font": [mapFontstack],
      "text-size": 11,
      "text-offset": [0, -1.4],
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": text,
      "text-halo-color": halo,
      "text-halo-width": 1.5,
    },
  });
  return [ids.fill, ids.line, ids.circle, ids.points, ids.labels];
}

/** @public */
export interface DrawLayerProps {
  /** The outline as the app holds it (controlled). */
  outline: DrawOutline;
  /** Every click and drag, with the outline it makes. */
  onChange(next: DrawOutline): void;
  /** The most vertices the app's API takes; required, no default. */
  maxVertices: number;
  /**
   * The circle's outline as the app's API drew it (uspace-core geodesy),
   * shown as given; null or absent: the centre only.
   */
  circleOutline?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  /** Clicks add points while true (default true); dragging stays. */
  active?: boolean;
  /** Default true. */
  visible?: boolean;
  /** The source id and layer id prefix (default `DRAW_LAYER_ID`). */
  id?: string;
}

/** The canvas cursor: a crosshair while a click places a point. */
const cursorOf = (p: Pick<DrawLayerProps, "active" | "visible">): string =>
  p.active === false || p.visible === false ? "" : "crosshair";

const pointOf = (e: MapMouseEvent): DrawPoint => ({
  lat: e.lngLat.lat,
  lng: e.lngLat.lng,
});

/** @public */
export function DrawLayer(props: DrawLayerProps) {
  const {
    outline,
    circleOutline = null,
    visible = true,
    id = DRAW_LAYER_ID,
  } = props;
  const ids = drawLayerIds(id);
  const data = useMemo(
    () => drawFeatureCollection(outline, circleOutline),
    [outline, circleOutline],
  );
  const map = useLayer({
    id,
    data,
    build: (m) => buildDrawLayers(m, id),
    update: (m, d) => {
      (m.getSource(id) as GeoJSONSource | undefined)?.setData(d);
    },
    visible,
  });
  // The handlers read the newest props without being re-registered.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (map === null) return undefined;
    let dragging: number | null = null;
    let dragged = false;
    // Events can arrive faster than the app re-renders (two clicks in one
    // frame): the outline handed up last builds on the one handed up
    // before, until the app's next outline arrives. An app that keeps its
    // own outline (refusing the change) is followed from its next render.
    let pending: { base: DrawOutline; next: DrawOutline } | null = null;
    const current = (): DrawOutline => {
      const held = latest.current.outline;
      if (pending !== null && pending.base === held) return pending.next;
      pending = null;
      return held;
    };
    const emit = (next: DrawOutline): void => {
      pending = { base: latest.current.outline, next };
      latest.current.onChange(next);
    };
    const hit = (e: MapMouseEvent): number | null => {
      if (map.getLayer(ids.points) === undefined) return null;
      const f = map.queryRenderedFeatures(e.point, {
        layers: [ids.points],
      })[0];
      const index: unknown = f?.properties["index"];
      return typeof index === "number" ? index : null;
    };
    const onDown = (e: MapMouseEvent): void => {
      if (latest.current.visible === false) return;
      const index = hit(e);
      if (index === null) return;
      // Keeps MapLibre from panning while a point is dragged.
      e.preventDefault();
      dragging = index;
      dragged = false;
      map.getCanvas().style.cursor = "grabbing";
    };
    const onMove = (e: MapMouseEvent): void => {
      if (dragging === null) return;
      dragged = true;
      emit(outlineWithMove(current(), dragging, pointOf(e)));
    };
    const onUp = (): void => {
      if (dragging === null) return;
      dragging = null;
      map.getCanvas().style.cursor = cursorOf(latest.current);
    };
    const onClick = (e: MapMouseEvent): void => {
      const p = latest.current;
      // The click that ends a drag places nothing.
      if (dragged) {
        dragged = false;
        return;
      }
      if (p.active === false || p.visible === false) return;
      if (hit(e) !== null) return;
      const next = outlineWithClick(current(), pointOf(e), p.maxVertices);
      if (next === null) {
        countLayer("draw_vertex_refused");
        return;
      }
      emit(next);
    };
    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    map.on("click", onClick);
    return () => {
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      map.off("click", onClick);
    };
  }, [map, ids.points]);
  // A crosshair while clicks place points; declared after the handlers,
  // so it is set once they listen.
  const cursor = cursorOf(props);
  useEffect(() => {
    if (map === null) return undefined;
    const canvas = map.getCanvas();
    canvas.style.cursor = cursor;
    return () => {
      canvas.style.cursor = "";
    };
  }, [map, cursor]);
  return null;
}
