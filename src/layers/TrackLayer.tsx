"use client";
// TrackLayer (docs/PLAN.md §3.9, WP-7): the tracks the API sent, as one
// symbol each: shape by trust class (a broadcast track is always the
// hollow hexagon, R-05), colour and mark by identification status, opacity
// by age bucket, an arrow rotated by `trackDeg` (none when null, R-10), a
// ring for an emergency and another for the selection, optional labels and
// trails. It reads fields; it never decides a status, a trust class or a
// freshness, and it holds no threshold (`staleAfterS` is the feed's) and
// no timer (the app re-renders on its tick with a new `nowMs`).
//
// Updates are coalesced by useLayer into one `setData` per animation
// frame (PLAN §8), whatever the number of upserts in that frame.
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { mapFontstack } from "../fonts/faces.js";
import { createTranslator } from "../i18n/translate.js";
import { useMapContext } from "../map/context.js";
import type { TrackView } from "../model/index.js";
import { IDENT_ORDER, identToken, type IdentKey } from "../symbology/ident.js";
import {
  TRACK_COLOUR_TOKENS,
  TRACK_ICON_IDS,
  trackStyle,
  type TrackColours,
} from "../symbology/track.js";
import {
  TRACK_ICON_PIXEL_RATIO,
  trackIconSdf,
} from "../symbology/trackIcon.js";
import {
  TrackHold,
  trackFeatureCollection,
  type TrackFeatureCollection,
} from "./trackFeatures.js";
import { resolveColour, useLayer } from "./useLayer.js";

/**
 * The default source id; pass `id` to draw two track layers on one map.
 *
 * @beta
 */
export const TRACK_LAYER_ID = "us-tracks";

/** @beta */
export interface TrackLayerIds {
  source: string;
  trail: string;
  selected: string;
  emergency: string;
  icon: string;
  mark: string;
  label: string;
}

/** @beta */
export function trackLayerIds(id: string): TrackLayerIds {
  return {
    source: id,
    trail: `${id}-trail`,
    selected: `${id}-selected`,
    emergency: `${id}-emergency`,
    icon: `${id}-icon`,
    mark: `${id}-mark`,
    label: `${id}-label`,
  };
}

/**
 * The track colours resolved on the map's element, in its scheme.
 *
 * @beta
 */
export function resolveTrackColours(map: MapLibreMap): TrackColours {
  const ident = {} as Record<IdentKey, string>;
  for (const s of IDENT_ORDER) {
    ident[s] = resolveColour(map, identToken(s === "none" ? null : s));
  }
  return {
    ident,
    emergency: resolveColour(map, TRACK_COLOUR_TOKENS.emergency),
    selected: resolveColour(map, TRACK_COLOUR_TOKENS.selected),
    halo: resolveColour(map, TRACK_COLOUR_TOKENS.halo),
  };
}

/**
 * Puts the twelve SDF icons (six trust classes, plain and with the arrow)
 * on the map, once per style; a style re-apply drops them and the layer
 * puts them back.
 *
 * @public
 */
export function putTrackIcons(map: MapLibreMap): void {
  for (const { id, trust, directional } of TRACK_ICON_IDS) {
    if (map.hasImage(id)) continue;
    map.addImage(id, trackIconSdf(trust, directional), {
      sdf: true,
      pixelRatio: TRACK_ICON_PIXEL_RATIO,
    });
  }
}

const EMPTY: TrackFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Display-only constants: ring widths and the label's offset, in CSS pixels or ems. */
const EMERGENCY_RING_WIDTH_PX = 3;
const SELECTED_RING_WIDTH_PX = 2;
const LABEL_OFFSET_EM: [number, number] = [0, 1.6];
const MARK_OFFSET_EM: [number, number] = [1.1, -1.1];
const TRAIL_WIDTH_PX = 2;

function buildTrackLayers(map: MapLibreMap, id: string): readonly string[] {
  const ids = trackLayerIds(id);
  const colours = resolveTrackColours(map);
  const style = trackStyle(colours);
  putTrackIcons(map);
  map.addSource(ids.source, { type: "geojson", data: EMPTY });
  map.addLayer({
    id: ids.trail,
    type: "line",
    source: ids.source,
    filter: style.trailFilter,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": style.trailColor,
      "line-opacity": style.trailOpacity,
      "line-width": TRAIL_WIDTH_PX,
    },
  });
  map.addLayer({
    id: ids.selected,
    type: "circle",
    source: ids.source,
    filter: style.selectedFilter,
    paint: {
      "circle-radius": style.ringRadius,
      "circle-color": colours.selected,
      "circle-opacity": 0.15,
      "circle-stroke-color": colours.selected,
      "circle-stroke-width": SELECTED_RING_WIDTH_PX,
    },
  });
  map.addLayer({
    id: ids.emergency,
    type: "circle",
    source: ids.source,
    filter: style.emergencyFilter,
    paint: {
      "circle-radius": style.emergencyRadius,
      "circle-opacity": 0,
      "circle-stroke-color": colours.emergency,
      "circle-stroke-width": EMERGENCY_RING_WIDTH_PX,
    },
  });
  map.addLayer({
    id: ids.icon,
    type: "symbol",
    source: ids.source,
    filter: style.pointFilter,
    layout: {
      "icon-image": style.iconImage,
      "icon-rotate": style.iconRotate,
      "icon-rotation-alignment": "map",
      "icon-size": style.iconSize,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-color": style.iconColor,
      "icon-opacity": style.iconOpacity,
      "icon-halo-color": colours.halo,
      "icon-halo-width": 1,
    },
  });
  map.addLayer({
    id: ids.mark,
    type: "symbol",
    source: ids.source,
    filter: style.markFilter,
    layout: {
      "text-field": ["get", "mark"],
      "text-font": [mapFontstack],
      "text-size": style.textSize,
      "text-offset": MARK_OFFSET_EM,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": colours.selected,
      "text-halo-color": colours.halo,
      "text-halo-width": 2,
      "text-opacity": style.iconOpacity,
    },
  });
  map.addLayer({
    id: ids.label,
    type: "symbol",
    source: ids.source,
    filter: style.pointFilter,
    layout: {
      "text-field": ["get", "label"],
      "text-font": [mapFontstack],
      "text-size": style.textSize,
      "text-offset": LABEL_OFFSET_EM,
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: {
      "text-color": colours.selected,
      "text-halo-color": colours.halo,
      "text-halo-width": 1.5,
      "text-opacity": style.iconOpacity,
    },
  });
  return [
    ids.trail,
    ids.selected,
    ids.emergency,
    ids.icon,
    ids.mark,
    ids.label,
  ];
}

/** @public */
export interface TrackLayerProps {
  /** Every track the app shows (a store snapshot); read once per change. */
  tracks: Iterable<TrackView>;
  /** The feed's `stale_after_s` (PLAN §6.3). Required: no default. */
  staleAfterS: number;
  /** The app's clock tick, in ms since the epoch; drives the age buckets. */
  nowMs: number;
  selectedId?: string | null;
  /** Called with the track id of a clicked symbol. */
  onSelect?(id: string): void;
  /** Labels (default true). Marks, rings and symbols stay either way. */
  labels?: boolean;
  /** Trails of at most `points` positions per track (default off). */
  trails?: { points: number } | false;
  /** Default true. */
  visible?: boolean;
  /** The source id and layer id prefix (default `TRACK_LAYER_ID`). */
  id?: string;
}

// An iterator can be read once; the hold reads each `tracks` value once,
// and a value React hands over twice (StrictMode) must give the same list.
const lists = new WeakMap<object, readonly TrackView[]>();

function listOf(tracks: Iterable<TrackView>): readonly TrackView[] {
  if (Array.isArray(tracks)) return tracks as readonly TrackView[];
  let list = lists.get(tracks);
  if (list === undefined) {
    list = Array.from(tracks);
    lists.set(tracks, list);
  }
  return list;
}

/** @public */
export function TrackLayer(props: TrackLayerProps) {
  const {
    tracks,
    staleAfterS,
    nowMs,
    selectedId = null,
    onSelect,
    labels = true,
    trails = false,
    visible = true,
    id = TRACK_LAYER_ID,
  } = props;
  const { lang } = useMapContext();
  const ids = trackLayerIds(id);
  const trailPoints = trails === false ? 0 : trails.points;
  const [hold] = useState(() => new TrackHold());
  const version = useMemo(
    () => hold.apply(listOf(tracks), trailPoints),
    [hold, tracks, trailPoints],
  );
  const t = useMemo(() => createTranslator(lang), [lang]);
  const data = useMemo(
    () => trackFeatureCollection(hold, { nowMs, staleAfterS, selectedId, t }),
    // `version` stands for the hold's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hold, version, nowMs, staleAfterS, selectedId, t],
  );
  const map = useLayer({
    id,
    data,
    build: (m) => buildTrackLayers(m, id),
    update: (m, d) => {
      (m.getSource(id) as GeoJSONSource | undefined)?.setData(d);
    },
    visible: (layerId) =>
      visible &&
      (layerId !== ids.label || labels) &&
      (layerId !== ids.trail || trailPoints > 0),
  });

  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  });
  useEffect(() => {
    if (map === null) return;
    const onClick = (e: MapMouseEvent): void => {
      if (map.getLayer(ids.icon) === undefined) return;
      const hit = map.queryRenderedFeatures(e.point, { layers: [ids.icon] })[0];
      const trackId: unknown = hit?.properties["identifier"];
      if (typeof trackId === "string") select.current?.(trackId);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map, ids.icon]);
  return null;
}
