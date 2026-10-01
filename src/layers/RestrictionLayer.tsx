"use client";
// RestrictionLayer (docs/PLAN.md §3.9, WP-6; spec 02 F2): dynamic airspace
// restrictions (ED-318 features with reason DAR) styled by the state the
// API gave them: `planned` dashed, `active` solid and thick, `ended` and
// `cancelled` thin and dimmed. Every restriction handed over is drawn,
// whatever its state or reason: an ended or cancelled one stays visible,
// dimmed, until the app stops passing it (02 §1 failure rule: the client
// never removes what the server sent). The state is the server's; the kit
// never derives it from the times.
import type { Map as MapLibreMap } from "maplibre-gl";
import { useMemo } from "react";

import {
  RESTRICTION_LINE_KEYS,
  restrictionLine,
  restrictionLineFilter,
  type RestrictionLineKey,
} from "../symbology/restriction.js";
import { zoneDimExpression, zoneStyle } from "../symbology/zone.js";
import type { RestrictionView } from "./ZoneCard.js";
import { HoverCard, resolveZoneColours } from "./ZoneLayer.js";
import {
  setSourceData,
  useFeaturePointer,
  zoneFeatureCollection,
  type ZoneFeatureCollection,
} from "./zoneFeatures.js";
import { useLayer } from "./useLayer.js";

export const RESTRICTION_LAYER_ID = "us-restrictions";

/** Fill opacity of a restriction before dimming. Display-only constant. */
export const RESTRICTION_FILL_OPACITY = 0.15;

export interface RestrictionLayerIds {
  source: string;
  fill: string;
  lines: Readonly<Record<RestrictionLineKey, string>>;
}

export function restrictionLayerIds(id: string): RestrictionLayerIds {
  const lines = {} as Record<RestrictionLineKey, string>;
  for (const k of RESTRICTION_LINE_KEYS) lines[k] = `${id}-line-${k}`;
  return { source: id, fill: `${id}-fill`, lines };
}

const EMPTY: ZoneFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function buildRestrictionLayers(
  map: MapLibreMap,
  id: string,
): readonly string[] {
  const ids = restrictionLayerIds(id);
  const style = zoneStyle(resolveZoneColours(map));
  const dim = zoneDimExpression();
  map.addSource(ids.source, { type: "geojson", data: EMPTY });
  map.addLayer({
    id: ids.fill,
    type: "fill",
    source: ids.source,
    paint: {
      "fill-color": style.fillColor,
      "fill-opacity": ["*", RESTRICTION_FILL_OPACITY, dim],
    },
  });
  const added = [ids.fill];
  for (const k of RESTRICTION_LINE_KEYS) {
    const line = restrictionLine(k === "unstated" ? null : k);
    const layerId = ids.lines[k];
    map.addLayer({
      id: layerId,
      type: "line",
      source: ids.source,
      filter: restrictionLineFilter(k),
      paint: {
        "line-color": style.lineColor,
        "line-width": line.widthPx,
        "line-opacity": dim,
        ...(line.dash === null ? {} : { "line-dasharray": [...line.dash] }),
      },
    });
    added.push(layerId);
  }
  return added;
}

export interface RestrictionLayerProps {
  restrictions: readonly RestrictionView[];
  /** Default true. */
  visible?: boolean;
  /** Called with the identifier of the clicked restriction. */
  onSelect?(id: string): void;
  /** The source id and layer id prefix (default `RESTRICTION_LAYER_ID`). */
  id?: string;
}

export function RestrictionLayer(props: RestrictionLayerProps) {
  const {
    restrictions,
    visible = true,
    onSelect,
    id = RESTRICTION_LAYER_ID,
  } = props;
  const ids = restrictionLayerIds(id);
  const data = useMemo(
    () => zoneFeatureCollection(restrictions, null),
    [restrictions],
  );
  const map = useLayer({
    id,
    data,
    build: (m) => buildRestrictionLayers(m, id),
    update: setSourceData(id),
    visible,
  });
  const hover = useFeaturePointer(map, ids.fill, onSelect);
  const restriction =
    hover === null
      ? undefined
      : restrictions.find((r) => r.identifier === hover.identifier);
  if (map === null || hover === null || restriction === undefined || !visible) {
    return null;
  }
  return <HoverCard map={map} hover={hover} zone={restriction} restriction />;
}
