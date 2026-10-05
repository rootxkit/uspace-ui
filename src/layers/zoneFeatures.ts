"use client";
// What ZoneLayer and RestrictionLayer share: the features they put on the
// map (the API's geometry, untouched, with only the properties the style
// and the label need) and the pointer handling that finds the feature
// under the mouse. The map answers "which feature is here"
// (`queryRenderedFeatures`); the kit computes no containment.
import type * as GeoJSON from "geojson";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { ZoneView } from "../model/index.js";
import type { ZoneFeatureProperties } from "../symbology/zone.js";

/** @beta */
export type ZoneFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  ZoneFeatureProperties
>;

/**
 * One feature per zone, in the order given. `geometry` is the zone's own
 * object, passed through as the API sent it (LESSONS Z-11: a circle is
 * the API's to send as drawable geometry); `properties` carry the style
 * keys, the identifier, the name and the limits, and nothing else (no
 * `extendedProperties`, no message: the card reads those from the view).
 *
 * @beta
 */
export function zoneFeatureCollection(
  zones: readonly ZoneView[],
  selectedId: string | null,
): ZoneFeatureCollection {
  return {
    type: "FeatureCollection",
    features: zones.map((z) => ({
      type: "Feature",
      geometry: z.geometry,
      properties: {
        identifier: z.identifier,
        name: z.name,
        type: z.type,
        applies: z.applies,
        restrictionState: z.restrictionState,
        selected: z.identifier === selectedId,
        lowerLimitM: z.lowerLimitM,
        lowerRef: z.lowerRef,
        upperLimitM: z.upperLimitM,
        upperRef: z.upperRef,
      },
    })),
  };
}

/**
 * `update` for useLayer: one `setData` on the layer's GeoJSON source.
 *
 * @beta
 */
export function setSourceData(
  sourceId: string,
): (map: MapLibreMap, data: ZoneFeatureCollection) => void {
  return (map, data) => {
    (map.getSource(sourceId) as GeoJSONSource | undefined)?.setData(data);
  };
}

/**
 * The feature under the pointer: its identifier and the pointer's place.
 *
 * @beta
 */
export interface PointerHover {
  identifier: string;
  /** CSS pixels from the map container's top left corner. */
  x: number;
  y: number;
}

function identifierAt(
  map: MapLibreMap,
  layerId: string,
  e: MapMouseEvent,
): string | null {
  if (map.getLayer(layerId) === undefined) return null;
  const hit = map.queryRenderedFeatures(e.point, { layers: [layerId] })[0];
  const id: unknown = hit?.properties["identifier"];
  return typeof id === "string" ? id : null;
}

/**
 * Hover and click on the features of `layerId`: returns the hovered
 * feature, and calls `onSelect` with the identifier of a clicked one (a
 * click beside every feature calls nothing).
 *
 * @beta
 */
export function useFeaturePointer(
  map: MapLibreMap | null,
  layerId: string,
  onSelect: ((identifier: string) => void) | undefined,
): PointerHover | null {
  const [hover, setHover] = useState<PointerHover | null>(null);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  });
  useEffect(() => {
    if (map === null) return;
    const onMove = (e: MapMouseEvent): void => {
      const identifier = identifierAt(map, layerId, e);
      setHover(
        identifier === null ? null : { identifier, x: e.point.x, y: e.point.y },
      );
    };
    const onOut = (): void => {
      setHover(null);
    };
    const onClick = (e: MapMouseEvent): void => {
      const identifier = identifierAt(map, layerId, e);
      if (identifier !== null) select.current?.(identifier);
    };
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    map.on("click", onClick);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      map.off("click", onClick);
      setHover(null);
    };
  }, [map, layerId]);
  return hover;
}
