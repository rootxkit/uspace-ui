"use client";
// ReceiverLayer (docs/PLAN.md §3.9, WP-12; spec 02 F9): Remote ID
// receivers at the positions the API gave, each with its source state as
// the server judged it (`createSourceStore`, B-11: `disabled` beats every
// other state): a colour, a mark that reads without colour, the state's
// word in the label, and a hover card in B-11's words (`disabled by
// <who>`, `silent since T`, `healthy`). Every receiver handed over is
// drawn whatever its state: a silent or disabled receiver is shown as
// such, never removed (01 §3 S4 MUST NOT). Click calls `onSelect`.
import type * as GeoJSON from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useMemo } from "react";

import { mapFontstack } from "../fonts/faces.js";
import { useTFor } from "../i18n/I18nProvider.js";
import type { Translate } from "../i18n/translate.js";
import { useMapContext } from "../map/context.js";
import {
  SOURCE_STATES,
  type SourceState,
  type SourceView,
} from "../model/index.js";
import { sourceDetailLines } from "../status/SourceStateBadge.js";
import { SOURCE_STATE_KEYS } from "../status/words.js";
import { tokens } from "../theme/tokens.js";
import { HoverPortal } from "./HoverPortal.js";
import { resolveColour, useLayer } from "./useLayer.js";
import { useFeaturePointer } from "./zoneFeatures.js";

/**
 * One receiver as the layer takes it: PLAN §3.9's `{ id, lat, lng,
 * state }`, plus the `SourceView` fields its hover card words when the
 * app has them (`disabledBy`, `disabledByWho`, `lastSeenAt`, `lagS`).
 *
 * @public
 */
export interface ReceiverInput {
  id: string;
  lat: number;
  lng: number;
  state: SourceState;
  disabledBy?: SourceView["disabledBy"];
  disabledByWho?: string | null;
  lastSeenAt?: string | null;
  lagS?: number | null;
}

/**
 * The CSS variable of a receiver's colour per state. Total.
 *
 * @beta
 */
export function receiverToken(s: SourceState): string {
  switch (s) {
    case "healthy":
      return "--us-age-live";
    case "lagging":
      return "--us-age-aging";
    case "stale":
      return "--us-age-stale";
    case "unreachable":
      return tokens.severity.warning;
    case "disabled":
      return tokens.severity.critical;
    case "never_heard":
      return "--us-text-muted";
    default:
      return s satisfies never;
  }
}

/**
 * The mark beside a receiver, so its state reads without colour; healthy
 * has none. In the basemap's Latin glyph ranges. Display-only constants.
 *
 * @beta
 */
export function receiverMark(s: SourceState): string {
  switch (s) {
    case "healthy":
      return "";
    case "lagging":
      return "»";
    case "stale":
      return "…";
    case "unreachable":
      return "?";
    case "disabled":
      return "×";
    case "never_heard":
      return "–";
    default:
      return s satisfies never;
  }
}

/** @beta */
export const RECEIVER_LAYER_ID = "us-receivers";

/** @beta */
export interface ReceiverLayerIds {
  source: string;
  circle: string;
  mark: string;
  label: string;
}

/** @beta */
export function receiverLayerIds(id: string): ReceiverLayerIds {
  return {
    source: id,
    circle: `${id}-circle`,
    mark: `${id}-mark`,
    label: `${id}-label`,
  };
}

/** @beta */
export interface ReceiverFeatureProperties {
  identifier: string;
  state: SourceState;
  mark: string;
  selected: boolean;
  /** The id and the state's word, already translated. */
  label: string;
}

/** @beta */
export type ReceiverFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  ReceiverFeatureProperties
>;

const EMPTY: ReceiverFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** @beta */
export function receiverFeatureCollection(
  receivers: readonly ReceiverInput[],
  selectedId: string | null,
  t: Translate,
): ReceiverFeatureCollection {
  return {
    type: "FeatureCollection",
    features: receivers.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        identifier: r.id,
        state: r.state,
        mark: receiverMark(r.state),
        selected: r.id === selectedId,
        label: `${r.id}\n${t(SOURCE_STATE_KEYS[r.state])}`,
      },
    })),
  };
}

/** Display-only constants: radius, stroke widths and offsets. */
const RADIUS_PX = 7;
const STROKE_PX = 2;
const SELECTED_STROKE_PX = 4;
const MARK_OFFSET_EM: [number, number] = [0.9, -0.9];
const LABEL_OFFSET_EM: [number, number] = [0, 1.2];

function buildReceiverLayers(map: MapLibreMap, id: string): readonly string[] {
  const ids = receiverLayerIds(id);
  const byState = [
    "match",
    ["get", "state"],
    ...SOURCE_STATES.flatMap((s) => [s, resolveColour(map, receiverToken(s))]),
    resolveColour(map, receiverToken("never_heard")),
  ];
  const text = resolveColour(map, "--us-text");
  const halo = resolveColour(map, "--us-surface");
  map.addSource(ids.source, { type: "geojson", data: EMPTY });
  map.addLayer({
    id: ids.circle,
    type: "circle",
    source: ids.source,
    paint: {
      "circle-radius": RADIUS_PX,
      "circle-color": halo,
      "circle-stroke-color": byState as never,
      "circle-stroke-width": [
        "case",
        ["==", ["get", "selected"], true],
        SELECTED_STROKE_PX,
        STROKE_PX,
      ],
    },
  });
  map.addLayer({
    id: ids.mark,
    type: "symbol",
    source: ids.source,
    filter: ["!=", ["get", "mark"], ""],
    layout: {
      "text-field": ["get", "mark"],
      "text-font": [mapFontstack],
      "text-size": 13,
      "text-offset": MARK_OFFSET_EM,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": text,
      "text-halo-color": halo,
      "text-halo-width": 2,
    },
  });
  map.addLayer({
    id: ids.label,
    type: "symbol",
    source: ids.source,
    layout: {
      "text-field": ["get", "label"],
      "text-font": [mapFontstack],
      "text-size": 11,
      "text-offset": LABEL_OFFSET_EM,
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: {
      "text-color": text,
      "text-halo-color": halo,
      "text-halo-width": 1.5,
    },
  });
  return [ids.circle, ids.mark, ids.label];
}

/** @public */
export interface ReceiverLayerProps {
  receivers: readonly ReceiverInput[];
  selectedId?: string | null;
  /** Called with the id of a clicked receiver. */
  onSelect?(id: string): void;
  /** Labels (default true); the marks and circles stay either way. */
  labels?: boolean;
  /** Default true. */
  visible?: boolean;
  /** The source id and layer id prefix (default `RECEIVER_LAYER_ID`). */
  id?: string;
}

/** @public */
export function ReceiverLayer(props: ReceiverLayerProps) {
  const {
    receivers,
    selectedId = null,
    onSelect,
    labels = true,
    visible = true,
    id = RECEIVER_LAYER_ID,
  } = props;
  const { lang } = useMapContext();
  const t = useTFor(lang);
  const ids = receiverLayerIds(id);
  const data = useMemo(
    () => receiverFeatureCollection(receivers, selectedId, t),
    [receivers, selectedId, t],
  );
  const map = useLayer({
    id,
    data,
    build: (m) => buildReceiverLayers(m, id),
    update: (m, d) => {
      (m.getSource(id) as GeoJSONSource | undefined)?.setData(d);
    },
    visible: (layerId) => visible && (layerId !== ids.label || labels),
  });
  const hover = useFeaturePointer(map, ids.circle, onSelect);
  const r =
    hover === null
      ? undefined
      : receivers.find((x) => x.id === hover.identifier);
  if (map === null || hover === null || r === undefined || !visible) {
    return null;
  }
  const lines = sourceDetailLines(
    {
      state: r.state,
      disabledBy: r.disabledBy ?? null,
      disabledByWho: r.disabledByWho ?? null,
      lastSeenAt: r.lastSeenAt ?? null,
      lagS: r.lagS ?? null,
    },
    null,
    t,
    lang,
  );
  return (
    <HoverPortal map={map} hover={hover}>
      <div
        className="us-receiver-card max-w-xs rounded-md border border-l-4 border-border bg-popover p-2 text-xs text-popover-foreground shadow-md"
        data-source-state={r.state}
        style={{ borderLeftColor: `var(${receiverToken(r.state)})` }}
      >
        <p className="m-0 mb-1 text-sm font-semibold">
          {t("receiver.card.title", { id: r.id })}
        </p>
        <p className="m-0 font-medium" data-part="state">
          {t(SOURCE_STATE_KEYS[r.state])}
        </p>
        {lines.map((line) => (
          <p
            key={line}
            className="m-0 text-muted-foreground"
            data-part="detail"
          >
            {line}
          </p>
        ))}
      </div>
    </HoverPortal>
  );
}
