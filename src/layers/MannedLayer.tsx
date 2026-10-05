"use client";
// MannedLayer (docs/PLAN.md §3.9, WP-12; spec 02 F4): manned aircraft as
// the API sent them, one plane symbol each: colour by trust class, hollow
// for a broadcast position (R-05), faded by age bucket, rotated by
// `trackDeg` (ringed when there is none, R-10), a ring for an emergency
// and another for the selection, a label, and a hover card with both
// altitudes named by their datum (R-09: the barometric one says
// "pressure altitude", never AMSL). No identification: a manned track has
// none here.
//
// Never hide (01 §3 S4 MUST NOT; 02 F4 "never shows an empty sky as
// clear"): every track handed over is drawn, however old; a stale one
// fades and its label says so, and a track leaves the map only when the
// app stops passing it (the manned store's `remove(id, reason)`). Never
// look fresh: a backlog sample (T-04) and a track with no stale threshold
// are labelled, so neither reads as a live position. The layer holds no
// threshold (`staleAfterS` is the feed's) and no timer (the app's tick
// gives `nowMs`).
import type * as GeoJSON from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useMemo } from "react";

import { mapFontstack } from "../fonts/faces.js";
import { useTFor } from "../i18n/I18nProvider.js";
import type { Translate } from "../i18n/translate.js";
import { ageS } from "../live/time.js";
import { useMapContext } from "../map/context.js";
import { TRUSTS, type Trust } from "../model/index.js";
import { TrackDetail } from "../status/TrackDetail.js";
import { ageBucket } from "../symbology/age.js";
import {
  MANNED_COLOUR_TOKENS,
  MANNED_ICON_IDS,
  mannedIconSdf,
  mannedStyle,
  mannedToken,
  mannedTrustDrawn,
  type MannedColours,
  type MannedFeatureProperties,
  type MannedTrack,
} from "../symbology/manned.js";
import { TRACK_ICON_PIXEL_RATIO } from "../symbology/trackIcon.js";
import type { AgeBucket } from "../theme/tokens.js";
import { HoverPortal } from "./HoverPortal.js";
import { resolveColour, useLayer } from "./useLayer.js";
import { useFeaturePointer } from "./zoneFeatures.js";

/**
 * The default source id; pass `id` to draw two manned layers on one map.
 *
 * @beta
 */
export const MANNED_LAYER_ID = "us-manned";

/** @beta */
export interface MannedLayerIds {
  source: string;
  selected: string;
  emergency: string;
  icon: string;
  label: string;
}

/** @beta */
export function mannedLayerIds(id: string): MannedLayerIds {
  return {
    source: id,
    selected: `${id}-selected`,
    emergency: `${id}-emergency`,
    icon: `${id}-icon`,
    label: `${id}-label`,
  };
}

/**
 * The manned colours resolved on the map's element, in its scheme.
 *
 * @beta
 */
export function resolveMannedColours(map: MapLibreMap): MannedColours {
  const trust = {} as Record<Trust, string>;
  for (const t of TRUSTS) trust[t] = resolveColour(map, mannedToken(t));
  return {
    trust,
    emergency: resolveColour(map, MANNED_COLOUR_TOKENS.emergency),
    selected: resolveColour(map, MANNED_COLOUR_TOKENS.selected),
    halo: resolveColour(map, MANNED_COLOUR_TOKENS.halo),
  };
}

/**
 * Puts the twelve manned SDF icons on the map, once per style.
 *
 * @beta
 */
export function putMannedIcons(map: MapLibreMap): void {
  for (const { id, trust, directional } of MANNED_ICON_IDS) {
    if (map.hasImage(id)) continue;
    map.addImage(id, mannedIconSdf(trust, directional), {
      sdf: true,
      pixelRatio: TRACK_ICON_PIXEL_RATIO,
    });
  }
}

/** @beta */
export type MannedFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  MannedFeatureProperties
>;

const EMPTY: MannedFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * The age bucket a manned track draws with: the thirds rule on the age
 * since this console received it, except that a backlog sample is history
 * and draws as `stale` whatever its age (T-04: never drawn as live).
 *
 * @beta
 */
export function mannedAge(
  m: MannedTrack,
  nowMs: number,
  staleAfterS: number,
): AgeBucket {
  if (m.times.backlog) return "stale";
  return ageBucket(ageS(m, nowMs, "received"), staleAfterS);
}

/**
 * The label: the callsign, else the ICAO address, else "no callsign or
 * address"; then what must not be lost when the label is read alone: the
 * broadcast or provider caveat (R-05, Q18), a trust class the API did not
 * send, an emergency, and an age that is stale, history or not known.
 *
 * @beta
 */
export function mannedLabel(
  m: MannedTrack,
  age: AgeBucket,
  t: Translate,
): string {
  const callsign = m.callsign?.trim() ?? "";
  const icao24 = m.icao24?.trim() ?? "";
  const name =
    callsign !== ""
      ? callsign
      : icao24 !== ""
        ? icao24
        : t("manned.label.unknown");
  const lines = [name];
  const stated = m.trust !== undefined && m.trust !== null;
  const trust = mannedTrustDrawn(m.trust);
  if (!stated) lines.push(t("manned.trust_unstated"));
  else if (trust === "broadcast") lines.push(t("track.broadcast"));
  else if (trust === "provider") lines.push(t("track.provider"));
  if (m.emergency) lines.push(t("track.emergency"));
  if (m.times.backlog) lines.push(t("manned.history"));
  else if (age === "stale") lines.push(t("age.bucket.stale"));
  else if (age === "unknown") lines.push(t("age.bucket.unknown"));
  return lines.join("\n");
}

/** @beta */
export interface MannedFeatureOptions {
  nowMs: number;
  staleAfterS: number;
  selectedId: string | null;
  t: Translate;
}

/**
 * One point per manned track, in the order given; positions as sent.
 *
 * @beta
 */
export function mannedFeatureCollection(
  tracks: readonly MannedTrack[],
  opts: MannedFeatureOptions,
): MannedFeatureCollection {
  return {
    type: "FeatureCollection",
    features: tracks.map((m) => {
      const age = mannedAge(m, opts.nowMs, opts.staleAfterS);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
        properties: {
          kind: "manned",
          identifier: m.trackId,
          trust: mannedTrustDrawn(m.trust),
          trustStated: m.trust !== undefined && m.trust !== null,
          trackDeg: m.trackDeg,
          emergency: m.emergency,
          selected: m.trackId === opts.selectedId,
          age,
          label: mannedLabel(m, age, opts.t),
        },
      };
    }),
  };
}

/** Display-only constants: ring widths and the label's offset. */
const EMERGENCY_RING_WIDTH_PX = 3;
const SELECTED_RING_WIDTH_PX = 2;
const LABEL_OFFSET_EM: [number, number] = [0, 1.9];

function buildMannedLayers(map: MapLibreMap, id: string): readonly string[] {
  const ids = mannedLayerIds(id);
  const colours = resolveMannedColours(map);
  const style = mannedStyle(colours);
  putMannedIcons(map);
  map.addSource(ids.source, { type: "geojson", data: EMPTY });
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
      "circle-stroke-opacity": style.iconOpacity,
    },
  });
  map.addLayer({
    id: ids.icon,
    type: "symbol",
    source: ids.source,
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
    id: ids.label,
    type: "symbol",
    source: ids.source,
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
  return [ids.selected, ids.emergency, ids.icon, ids.label];
}

/** @public */
export interface MannedLayerProps {
  /** Every manned track the app shows (a manned store snapshot). */
  tracks: Iterable<MannedTrack>;
  /** The feed's `stale_after_s` (PLAN §6.3). Required: no default. */
  staleAfterS: number;
  /** The app's clock tick, in ms since the epoch; drives the age buckets. */
  nowMs: number;
  selectedId?: string | null;
  /** Called with the track id of a clicked symbol. */
  onSelect?(id: string): void;
  /** Labels (default true). Rings and symbols stay either way. */
  labels?: boolean;
  /** Default true. */
  visible?: boolean;
  /** The source id and layer id prefix (default `MANNED_LAYER_ID`). */
  id?: string;
}

// An iterator can be read once; a value React hands over twice
// (StrictMode) must give the same list.
const lists = new WeakMap<object, readonly MannedTrack[]>();

function listOf(tracks: Iterable<MannedTrack>): readonly MannedTrack[] {
  if (Array.isArray(tracks)) return tracks as readonly MannedTrack[];
  let list = lists.get(tracks);
  if (list === undefined) {
    list = Array.from(tracks);
    lists.set(tracks, list);
  }
  return list;
}

/** @public */
export function MannedLayer(props: MannedLayerProps) {
  const {
    tracks,
    staleAfterS,
    nowMs,
    selectedId = null,
    onSelect,
    labels = true,
    visible = true,
    id = MANNED_LAYER_ID,
  } = props;
  const { lang } = useMapContext();
  const ids = mannedLayerIds(id);
  const t = useTFor(lang);
  const list = useMemo(() => listOf(tracks), [tracks]);
  const data = useMemo(
    () => mannedFeatureCollection(list, { nowMs, staleAfterS, selectedId, t }),
    [list, nowMs, staleAfterS, selectedId, t],
  );
  const map = useLayer({
    id,
    data,
    build: (m) => buildMannedLayers(m, id),
    update: (m, d) => {
      (m.getSource(id) as GeoJSONSource | undefined)?.setData(d);
    },
    visible: (layerId) => visible && (layerId !== ids.label || labels),
  });
  const hover = useFeaturePointer(map, ids.icon, onSelect);
  const track =
    hover === null
      ? undefined
      : list.find((m) => m.trackId === hover.identifier);
  if (map === null || hover === null || track === undefined || !visible) {
    return null;
  }
  return (
    <HoverPortal map={map} hover={hover}>
      <div className="max-w-xs rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md">
        <TrackDetail
          track={track}
          nowMs={nowMs}
          staleAfterS={staleAfterS}
          lang={lang}
          compact
        />
      </div>
    </HoverPortal>
  );
}
