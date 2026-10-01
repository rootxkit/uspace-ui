"use client";
// ZoneLayer (docs/PLAN.md §3.9, WP-6): ED-318 zones as the API served them,
// styled by type, dimmed only where the API said `applies: false` (or a
// restriction state that is not in force), with labels, selection and a
// hover card. It reads fields; it never decides whether a zone applies,
// where a zone is, or which points it covers (CLAUDE.md rule 2, LESSONS T-09).
import type { Map as MapLibreMap } from "maplibre-gl";
import { useMemo } from "react";
import { createPortal } from "react-dom";

import { mapFontstack } from "../fonts/faces.js";
import { useMapContext } from "../map/context.js";
import { ZONE_TYPES, type ZoneType, type ZoneView } from "../model/index.js";
import {
  parseHexColour,
  zonePattern,
  zonePatternImage,
  zonePatternImageId,
  zoneStyle,
  zoneToken,
  type ZoneColours,
} from "../symbology/zone.js";
import { ZoneCard, type RestrictionView } from "./ZoneCard.js";
import {
  setSourceData,
  useFeaturePointer,
  zoneFeatureCollection,
  type PointerHover,
  type ZoneFeatureCollection,
} from "./zoneFeatures.js";
import { putImage, resolveColour, useLayer } from "./useLayer.js";

/** The default source id; pass `id` to draw two zone layers on one map. */
export const ZONE_LAYER_ID = "us-zones";

/** Label size in CSS pixels. Display-only constant. */
export const ZONE_LABEL_SIZE_PX = 12;

export interface ZoneLayerIds {
  source: string;
  fill: string;
  pattern: string;
  line: string;
  label: string;
}

export function zoneLayerIds(id: string): ZoneLayerIds {
  return {
    source: id,
    fill: `${id}-fill`,
    pattern: `${id}-pattern`,
    line: `${id}-line`,
    label: `${id}-label`,
  };
}

/** Each zone type's token resolved on the map's element. */
export function resolveZoneColours(map: MapLibreMap): ZoneColours {
  const out = {} as Record<ZoneType, string>;
  for (const t of ZONE_TYPES) out[t] = resolveColour(map, zoneToken(t));
  return out;
}

/**
 * Puts the generated fill patterns on the map in the given colours, once
 * per style (re-put after a scheme change, in that scheme's colours).
 */
export function putZonePatterns(map: MapLibreMap, colours: ZoneColours): void {
  for (const t of ZONE_TYPES) {
    const name = zonePatternImageId(t);
    const p = zonePattern(t);
    const rgb = parseHexColour(colours[t]);
    if (name === null || rgb === null || (p !== "hatched" && p !== "dotted")) {
      continue;
    }
    putImage(map, name, zonePatternImage(p, rgb));
  }
}

const EMPTY: ZoneFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildZoneLayers(map: MapLibreMap, id: string): readonly string[] {
  const ids = zoneLayerIds(id);
  const colours = resolveZoneColours(map);
  putZonePatterns(map, colours);
  const style = zoneStyle(colours);
  map.addSource(ids.source, { type: "geojson", data: EMPTY });
  map.addLayer({
    id: ids.fill,
    type: "fill",
    source: ids.source,
    paint: { "fill-color": style.fillColor, "fill-opacity": style.fillOpacity },
  });
  map.addLayer({
    id: ids.pattern,
    type: "fill",
    source: ids.source,
    filter: style.patternFilter,
    paint: {
      "fill-pattern": style.fillPattern,
      "fill-opacity": style.patternOpacity,
    },
  });
  map.addLayer({
    id: ids.line,
    type: "line",
    source: ids.source,
    paint: {
      "line-color": style.lineColor,
      "line-width": style.lineWidth,
      "line-opacity": style.lineOpacity,
    },
  });
  map.addLayer({
    id: ids.label,
    type: "symbol",
    source: ids.source,
    layout: {
      "text-field": ["coalesce", ["get", "name"], ["get", "identifier"]],
      "text-font": [mapFontstack],
      "text-size": ZONE_LABEL_SIZE_PX,
    },
    paint: {
      "text-color": resolveColour(map, "--us-text"),
      "text-halo-color": resolveColour(map, "--us-surface"),
      "text-halo-width": 1.5,
      "text-opacity": style.lineOpacity,
    },
  });
  return [ids.fill, ids.pattern, ids.line, ids.label];
}

/** Offset of the hover card from the pointer. Display-only constant. */
export const HOVER_OFFSET_PX = 12;

/** The hover card of `zone`, placed beside the pointer, within the map. */
export function HoverCard(props: {
  map: MapLibreMap;
  hover: PointerHover;
  zone: RestrictionView;
  restriction?: boolean;
}) {
  const { lang } = useMapContext();
  const { map, hover, zone, restriction = false } = props;
  return createPortal(
    <div
      className="us-zone-hover pointer-events-none absolute z-10"
      role="tooltip"
      style={{
        left: hover.x + HOVER_OFFSET_PX,
        top: hover.y + HOVER_OFFSET_PX,
      }}
    >
      <ZoneCard zone={zone} lang={lang} restriction={restriction} />
    </div>,
    map.getContainer(),
  );
}

export interface ZoneLayerProps {
  zones: readonly ZoneView[];
  selectedId?: string | null;
  /** Called with the identifier of the clicked zone. */
  onSelect?(id: string): void;
  /** Name labels (default true). */
  labels?: boolean;
  /** Default true. */
  visible?: boolean;
  /** The source id and layer id prefix (default `ZONE_LAYER_ID`). */
  id?: string;
}

export function ZoneLayer(props: ZoneLayerProps) {
  const {
    zones,
    selectedId = null,
    onSelect,
    labels = true,
    visible = true,
    id = ZONE_LAYER_ID,
  } = props;
  const ids = zoneLayerIds(id);
  const data = useMemo(
    () => zoneFeatureCollection(zones, selectedId),
    [zones, selectedId],
  );
  const map = useLayer({
    id,
    data,
    build: (m) => buildZoneLayers(m, id),
    update: setSourceData(id),
    visible: (layerId) => visible && (layerId !== ids.label || labels),
  });
  const hover = useFeaturePointer(map, ids.fill, onSelect);
  const zone =
    hover === null
      ? undefined
      : zones.find((z) => z.identifier === hover.identifier);
  if (map === null || hover === null || zone === undefined || !visible) {
    return null;
  }
  return <HoverCard map={map} hover={hover} zone={zone} />;
}
