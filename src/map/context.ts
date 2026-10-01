"use client";
import type { Map as MapLibreMap } from "maplibre-gl";
import { createContext, useContext, useEffect, useRef } from "react";

import type { MapScheme } from "./basemap.js";
import type { MapLang } from "./messages.js";
import type { BBox, Viewport } from "./viewport.js";

/** Adds a kit layer's sources and layers to a freshly loaded style. */
export type StyleLoadHandler = (map: MapLibreMap) => void;

export interface MapContextValue {
  /** The map after its `load` event; null before, and with no WebGL. */
  map: MapLibreMap | null;
  lang: MapLang;
  scheme: MapScheme;
  initial: Viewport;
  /** The initial view's bbox, measured from the container (see viewportBBox). */
  initialBBox: BBox;
  /** Registers a re-adder; returns the unregister function. */
  onStyleLoad(handler: StyleLoadHandler): () => void;
}

export const MapContext = createContext<MapContextValue | null>(null);

/** The context of the enclosing `MapView`; throws outside one. */
export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (ctx === null) {
    throw new Error("uspace-ui/map: this component must be inside <MapView>");
  }
  return ctx;
}

/** The MapLibre map after load, or null (before load, no WebGL, outside a MapView). */
export function useMap(): MapLibreMap | null {
  return useContext(MapContext)?.map ?? null;
}

/**
 * Calls `add(map)` once the map has loaded and again after every style
 * re-apply (language or scheme change), which drops every source and
 * layer. Layer components put their sources and layers back here.
 */
export function useStyleLoad(add: StyleLoadHandler): void {
  const { onStyleLoad } = useMapContext();
  const ref = useRef(add);
  useEffect(() => {
    ref.current = add;
  });
  useEffect(() => onStyleLoad((map) => ref.current(map)), [onStyleLoad]);
}
