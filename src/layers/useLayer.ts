"use client";
// The lifecycle every kit layer shares (docs/PLAN.md §3.9, §8; WP-6, used
// by every layer WP): add a GeoJSON source and its layers when the map has
// loaded, put them back after each style re-apply (language or scheme;
// MapView's `style.load`), apply data at most once per animation frame,
// and remove everything on unmount.
//
// The signature `useLayer({ id, build(map), update(map, data), data })` is
// frozen by the WP-6 brief; options beyond it are optional additions.
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { useMapContext } from "../map/context.js";
import { parseHexColour, type PatternImage } from "../symbology/zone.js";
import { countLayer } from "./counters.js";

/** @beta */
export interface UseLayerOptions<D> {
  /** The GeoJSON source id; unique per map. */
  id: string;
  /**
   * Adds the source `id` and its layers to a freshly loaded style and
   * returns the ids of the layers it added, which are removed on unmount.
   * Called after the map's load and after every style re-apply.
   */
  build(map: MapLibreMap): readonly string[];
  /** Puts `data` on the map, typically one `setData` on the source. */
  update(map: MapLibreMap, data: D): void;
  data: D;
  /**
   * Layout visibility of every layer (default true), or per layer id. Read
   * on every render and after every rebuild.
   */
  visible?: boolean | ((layerId: string) => boolean);
}

function isVisible(
  visible: UseLayerOptions<unknown>["visible"],
  layerId: string,
): boolean {
  if (visible === undefined) return true;
  return typeof visible === "boolean" ? visible : visible(layerId);
}

function applyVisibility(
  map: MapLibreMap,
  layerIds: readonly string[],
  visible: UseLayerOptions<unknown>["visible"],
): void {
  for (const id of layerIds) {
    if (map.getLayer(id) === undefined) continue;
    const v = isVisible(visible, id) ? "visible" : "none";
    if (map.getLayoutProperty(id, "visibility") !== v) {
      map.setLayoutProperty(id, "visibility", v);
    }
  }
}

function removeAll(
  map: MapLibreMap,
  sourceId: string,
  layerIds: readonly string[],
): void {
  for (const id of [...layerIds].reverse()) {
    if (map.getLayer(id) !== undefined) map.removeLayer(id);
  }
  if (map.getSource(sourceId) !== undefined) map.removeSource(sourceId);
}

/**
 * Registers a layer's source and layers on the enclosing MapView's map
 * and keeps them there; returns the map after its load (null before load
 * and with no WebGL). Data handed over twice in one frame is applied
 * once, with the newer value; the older one is counted as superseded.
 *
 * @beta
 */
export function useLayer<D>(opts: UseLayerOptions<D>): MapLibreMap | null {
  const { map: ctxMap, onStyleLoad } = useMapContext();
  const latest = useRef(opts);
  const layerIds = useRef<readonly string[]>([]);
  const mapRef = useRef<MapLibreMap | null>(null);
  const frame = useRef<number | null>(null);
  const pushed = useRef<{ data: D } | null>(null);

  // First, so the handlers below always read this render's options.
  useEffect(() => {
    latest.current = opts;
  });

  useEffect(() => {
    let added: MapLibreMap | null = null;
    // MapView unmounts before its layers and removes the map with its
    // style ("remove" event); then there is nothing left to take off it.
    let removed = false;
    const onRemove = (): void => {
      removed = true;
    };
    const off = onStyleLoad((map) => {
      if (added !== map) map.on("remove", onRemove);
      added = map;
      mapRef.current = map;
      const o = latest.current;
      if (map.getSource(o.id) === undefined) layerIds.current = o.build(map);
      applyVisibility(map, layerIds.current, o.visible);
      o.update(map, o.data);
      pushed.current = { data: o.data };
    });
    return () => {
      off();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      if (added !== null) {
        added.off("remove", onRemove);
        if (!removed) removeAll(added, latest.current.id, layerIds.current);
      }
      mapRef.current = null;
      pushed.current = null;
    };
  }, [onStyleLoad]);

  const { data } = opts;
  useEffect(() => {
    if (mapRef.current === null || pushed.current?.data === data) return;
    if (frame.current !== null) {
      // The frame already scheduled reads the newest data.
      countLayer("update_superseded");
      return;
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const m = mapRef.current;
      const o = latest.current;
      // While a style re-applies the source is gone; `style.load` pushes.
      if (m === null || m.getSource(o.id) === undefined) return;
      if (pushed.current?.data === o.data) return;
      o.update(m, o.data);
      pushed.current = { data: o.data };
    });
  }, [data]);

  useEffect(() => {
    const m = mapRef.current;
    if (m === null || m.getSource(opts.id) === undefined) return;
    applyVisibility(m, layerIds.current, opts.visible);
  });

  return ctxMap;
}

/**
 * The fallback for a token that did not resolve. Display-only constant.
 *
 * @beta
 */
export const UNRESOLVED_COLOUR = "#808080";

/**
 * The colour a CSS variable (a `tokens` name) has on the map's element, in
 * the map's scheme (MapView sets `data-theme`). MapLibre paints with
 * colours, not variables. A token that does not resolve to `#rrggbb` is
 * counted and drawn in a neutral grey, never left out.
 *
 * @beta
 */
export function resolveColour(map: MapLibreMap, token: string): string {
  const v = getComputedStyle(map.getContainer()).getPropertyValue(token).trim();
  if (parseHexColour(v) === null) {
    countLayer("token_unresolved");
    return UNRESOLVED_COLOUR;
  }
  return v;
}

/**
 * Adds a generated image, or replaces it when the style already has one.
 *
 * @beta
 */
export function putImage(
  map: MapLibreMap,
  name: string,
  image: PatternImage,
): void {
  if (map.hasImage(name)) map.updateImage(name, image);
  else map.addImage(name, image);
}
