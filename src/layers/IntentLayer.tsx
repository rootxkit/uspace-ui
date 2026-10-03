"use client";
// IntentLayer (docs/PLAN.md §3.9, WP-12; spec 02 F6, 04 §3.5): the
// footprints of operational intents, one feature per volume, with the
// polygons exactly as the API derived them (the kit builds no polygon
// from a circle or an altitude band: `volumes` are passed through as the
// same objects), styled by DSS state, a diamond pattern over another
// USSP's intent (`peer`), the authorisation number as the label, and a
// hover card with the time window in UTC.
//
// "Current" is not the kit's to decide: the app lists the intents the
// API says are in use (`activeIds`) and the layer emphasises those; no
// time is compared here (CLAUDE.md rule 2). Every intent handed over is
// drawn, whatever its state (never hide): a state the API did not send,
// or one the kit does not know, draws as a dashed muted outline, never as
// `Activated` (never upgrade).
import type * as GeoJSON from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useMemo, type ReactNode } from "react";

import { mapFontstack } from "../fonts/faces.js";
import { fmtNum, fmtTimeUTC } from "../i18n/format.js";
import { useTFor } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import type { Translate } from "../i18n/translate.js";
import { useMapContext } from "../map/context.js";
import type { IntentView } from "../model/index.js";
import {
  INTENT_ACTIVE_EXTRA_FILL,
  INTENT_ACTIVE_EXTRA_WIDTH_PX,
  INTENT_PEER_PATTERN_ID,
  INTENT_SELECTED_EXTRA_WIDTH_PX,
  INTENT_STATE_KEYS,
  INTENT_STATE_KEYS_ORDER,
  intentLook,
  intentPeerPatternImage,
  intentStateDrawn,
  intentStateFilter,
  type IntentFeatureProperties,
  type IntentStateKey,
} from "../symbology/intent.js";
import { parseHexColour } from "../symbology/zone.js";
import { cn } from "../ui/cn.js";
import { HoverPortal } from "./HoverPortal.js";
import { putImage, resolveColour, useLayer } from "./useLayer.js";
import { useFeaturePointer } from "./zoneFeatures.js";

/**
 * An intent as the layer takes it: `IntentView` with its volumes as
 * Polygons or MultiPolygons (a volume the API split stays one feature),
 * and `peer` when the API says it is another USSP's intent seen through
 * the DSS (02 F6: peer flights as `provider`). `IntentView` is accepted as
 * it is.
 */
export type IntentInput = Omit<IntentView, "volumes"> & {
  volumes: readonly (GeoJSON.Polygon | GeoJSON.MultiPolygon)[];
  peer?: boolean;
};

export const INTENT_LAYER_ID = "us-intents";

/** Label size in CSS pixels. Display-only constant. */
export const INTENT_LABEL_SIZE_PX = 12;

export interface IntentLayerIds {
  source: string;
  fill: string;
  pattern: string;
  lines: Readonly<Record<IntentStateKey, string>>;
  label: string;
}

export function intentLayerIds(id: string): IntentLayerIds {
  const lines = {} as Record<IntentStateKey, string>;
  for (const k of INTENT_STATE_KEYS_ORDER) lines[k] = `${id}-line-${k}`;
  return {
    source: id,
    fill: `${id}-fill`,
    pattern: `${id}-pattern`,
    lines,
    label: `${id}-label`,
  };
}

export type IntentFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  IntentFeatureProperties
>;

const EMPTY: IntentFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** The label: the authorisation number, else the intent id, and the state. */
export function intentLabel(i: IntentInput, t: Translate): string {
  const name = i.authorisationNumber?.trim() ?? "";
  return [
    name !== "" ? name : i.intentId,
    t(INTENT_STATE_KEYS[intentStateDrawn(i.dssState)]),
  ].join("\n");
}

/**
 * One feature per volume, in the API's order; `geometry` is the volume
 * object itself, untouched.
 */
export function intentFeatureCollection(
  intents: readonly IntentInput[],
  opts: {
    selectedId: string | null;
    activeIds: ReadonlySet<string>;
    t: Translate;
  },
): IntentFeatureCollection {
  const features: IntentFeatureCollection["features"] = [];
  for (const i of intents) {
    const label = intentLabel(i, opts.t);
    i.volumes.forEach((geometry, volume) => {
      features.push({
        type: "Feature",
        geometry: geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
        properties: {
          identifier: i.intentId,
          volume,
          state: intentStateDrawn(i.dssState),
          peer: i.peer === true,
          active: opts.activeIds.has(i.intentId),
          selected: i.intentId === opts.selectedId,
          label,
        },
      });
    });
  }
  return { type: "FeatureCollection", features };
}

function byState(pick: (k: IntentStateKey) => string | number): unknown[] {
  return [
    "match",
    ["get", "state"],
    ...INTENT_STATE_KEYS_ORDER.flatMap((k) => [k, pick(k)]),
    pick("unstated"),
  ];
}

function buildIntentLayers(map: MapLibreMap, id: string): readonly string[] {
  const ids = intentLayerIds(id);
  const colour = (k: IntentStateKey): string =>
    resolveColour(map, intentLook(k).token);
  const peer = resolveColour(map, intentLook("peer").token);
  const rgb = parseHexColour(peer);
  if (rgb !== null)
    putImage(map, INTENT_PEER_PATTERN_ID, intentPeerPatternImage(rgb));
  map.addSource(ids.source, { type: "geojson", data: EMPTY });
  map.addLayer({
    id: ids.fill,
    type: "fill",
    source: ids.source,
    paint: {
      "fill-color": byState(colour) as never,
      "fill-opacity": [
        "+",
        byState((k) => intentLook(k).fillOpacity),
        ["case", ["==", ["get", "active"], true], INTENT_ACTIVE_EXTRA_FILL, 0],
      ] as never,
    },
  });
  map.addLayer({
    id: ids.pattern,
    type: "fill",
    source: ids.source,
    filter: ["==", ["get", "peer"], true],
    paint: { "fill-pattern": INTENT_PEER_PATTERN_ID },
  });
  const added = [ids.fill, ids.pattern];
  for (const k of INTENT_STATE_KEYS_ORDER) {
    const look = intentLook(k);
    const layerId = ids.lines[k];
    map.addLayer({
      id: layerId,
      type: "line",
      source: ids.source,
      filter: intentStateFilter(k),
      paint: {
        "line-color": colour(k),
        "line-width": [
          "+",
          look.lineWidthPx,
          [
            "case",
            ["==", ["get", "selected"], true],
            INTENT_SELECTED_EXTRA_WIDTH_PX,
            0,
          ],
          [
            "case",
            ["==", ["get", "active"], true],
            INTENT_ACTIVE_EXTRA_WIDTH_PX,
            0,
          ],
        ],
        ...(look.dash === null ? {} : { "line-dasharray": [...look.dash] }),
      },
    });
    added.push(layerId);
  }
  map.addLayer({
    id: ids.label,
    type: "symbol",
    source: ids.source,
    layout: {
      "text-field": ["get", "label"],
      "text-font": [mapFontstack],
      "text-size": INTENT_LABEL_SIZE_PX,
    },
    paint: {
      "text-color": resolveColour(map, "--us-text"),
      "text-halo-color": resolveColour(map, "--us-surface"),
      "text-halo-width": 1.5,
    },
  });
  added.push(ids.label);
  return added;
}

function Row(props: { field: string; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2" data-field={props.field}>
      <dt className="shrink-0 text-muted-foreground">{props.label}</dt>
      <dd className="m-0 font-medium">{props.children}</dd>
    </div>
  );
}

export interface IntentCardProps {
  intent: IntentInput;
  /** Listed in the app's `activeIds`. */
  active: boolean;
  lang: Lang;
  className?: string;
}

/** What the API said about an intent, with its time window in UTC. */
export function IntentCard(props: IntentCardProps) {
  const { intent, active, lang, className } = props;
  const t = useTFor(lang);
  const drawn = intentStateDrawn(intent.dssState);
  const stateText =
    drawn === "unstated" &&
    intent.dssState !== null &&
    intent.dssState.trim() !== ""
      ? t("intent.state.other", { state: intent.dssState })
      : t(INTENT_STATE_KEYS[drawn]);
  return (
    <div
      className={cn(
        "us-intent-card max-w-xs rounded-md border border-l-4 border-border bg-popover p-2 text-xs text-popover-foreground shadow-md",
        className,
      )}
      data-intent-state={drawn}
      style={{ borderLeftColor: `var(${intentLook(drawn).token})` }}
    >
      <dl className="m-0 grid gap-0.5">
        <Row field="authorisation" label={t("intent.card.authorisation")}>
          {intent.authorisationNumber ?? t("common.dash")}
        </Row>
        <Row field="intent" label={t("intent.card.intent")}>
          {intent.intentId}
        </Row>
        <Row field="dss-state" label={t("intent.card.dss_state")}>
          {stateText}
        </Row>
        <Row field="local-state" label={t("intent.card.local_state")}>
          {intent.localState ?? t("common.dash")}
        </Row>
        <Row field="window" label={t("intent.card.window")}>
          {t("intent.window", {
            start: fmtTimeUTC(intent.timeStart, lang),
            end: fmtTimeUTC(intent.timeEnd, lang),
          })}
        </Row>
        <Row field="priority" label={t("intent.card.priority")}>
          {fmtNum(intent.priority, 0, undefined, lang)}
        </Row>
        <Row field="volumes" label={t("intent.card.volumes")}>
          {fmtNum(intent.volumes.length, 0, undefined, lang)}
        </Row>
      </dl>
      {active && (
        <p className="m-0 mt-1 font-semibold" data-part="active">
          {t("intent.active")}
        </p>
      )}
      {intent.peer === true && (
        <p className="m-0 mt-1 font-semibold" data-part="peer">
          {t("intent.peer")}
        </p>
      )}
    </div>
  );
}

export interface IntentLayerProps {
  intents: readonly IntentInput[];
  /**
   * The intents the app says are current, from the API's state (never
   * from a time comparison in the kit); emphasised. Default none.
   */
  activeIds?: Iterable<string>;
  selectedId?: string | null;
  /** Called with the intent id of a clicked footprint. */
  onSelect?(id: string): void;
  /** Labels (default true). */
  labels?: boolean;
  /** Default true. */
  visible?: boolean;
  /** The source id and layer id prefix (default `INTENT_LAYER_ID`). */
  id?: string;
}

const NONE: readonly string[] = [];

export function IntentLayer(props: IntentLayerProps) {
  const {
    intents,
    activeIds = NONE,
    selectedId = null,
    onSelect,
    labels = true,
    visible = true,
    id = INTENT_LAYER_ID,
  } = props;
  const { lang } = useMapContext();
  const t = useTFor(lang);
  const ids = intentLayerIds(id);
  const active = useMemo(() => new Set(activeIds), [activeIds]);
  const data = useMemo(
    () =>
      intentFeatureCollection(intents, { selectedId, activeIds: active, t }),
    [intents, selectedId, active, t],
  );
  const map = useLayer({
    id,
    data,
    build: (m) => buildIntentLayers(m, id),
    update: (m, d) => {
      (m.getSource(id) as GeoJSONSource | undefined)?.setData(d);
    },
    visible: (layerId) => visible && (layerId !== ids.label || labels),
  });
  const hover = useFeaturePointer(map, ids.fill, onSelect);
  const intent =
    hover === null
      ? undefined
      : intents.find((i) => i.intentId === hover.identifier);
  if (map === null || hover === null || intent === undefined || !visible) {
    return null;
  }
  return (
    <HoverPortal map={map} hover={hover}>
      <IntentCard
        intent={intent}
        active={active.has(intent.intentId)}
        lang={lang}
      />
    </HoverPortal>
  );
}
