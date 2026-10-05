// Track symbology (docs/PLAN.md §3.8, WP-7): what a track looks like on
// the map, from the fields the API sent. Shape by trust class (with the
// hollow broadcast and the dashed simulated variants), colour by
// identification status, a mark beside the symbol for the status,
// opacity by age bucket, an arrow rotated by `trackDeg` (none when it is
// null, R-10), a ring for an emergency and another for the selection.
// Pure: no React, no map, no clock.
//
// Changing what a shape, colour or mark *means* is a major (PLAN §12) and
// needs the `legend-change` label; track.test.ts snapshots the
// expressions so such a change shows up in review.
import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";

import type { Key } from "../i18n/en.js";
import { TRUSTS, type Trust } from "../model/index.js";
import { AGE_BUCKETS, tokens, type AgeBucket } from "../theme/tokens.js";
import { ageOpacity } from "./age.js";
import { IDENT_ORDER, type IdentKey } from "./ident.js";
import {
  trustFill,
  trustShape,
  type Shape,
  type ShapeFill,
} from "./trackIcon.js";

export { trustFill, trustShape, type Shape, type ShapeFill };

/**
 * The CSS variable of a trust class's colour (badges, tables, legends).
 *
 * @public
 */
export function trustToken(t: Trust): string {
  switch (t) {
    case "authenticated":
    case "provider":
    case "surveillance":
    case "broadcast":
    case "sensor":
    case "simulated":
      return tokens.trust[t];
    default:
      return t satisfies never;
  }
}

/**
 * The catalogue key of a trust class's name.
 *
 * @public
 */
export const TRUST_KEYS: Readonly<Record<Trust, Key>> = Object.freeze({
  authenticated: "trust.authenticated",
  provider: "trust.provider",
  surveillance: "trust.surveillance",
  broadcast: "trust.broadcast",
  sensor: "trust.sensor",
  simulated: "trust.simulated",
});

/**
 * The catalogue key of a trust class's one-line meaning (04 §2).
 *
 * @beta
 */
export const TRUST_MEANING_KEYS: Readonly<Record<Trust, Key>> = Object.freeze({
  authenticated: "trust.authenticated.meaning",
  provider: "trust.provider.meaning",
  surveillance: "trust.surveillance.meaning",
  broadcast: "trust.broadcast.meaning",
  sensor: "trust.sensor.meaning",
  simulated: "trust.simulated.meaning",
});

/** The catalogue key naming how a shape is filled. */
export const TRUST_FILL_KEYS: Readonly<Record<ShapeFill, Key>> = Object.freeze({
  solid: "trust.fill.solid",
  hollow: "trust.fill.hollow",
  dashed: "trust.fill.dashed",
});

/**
 * Legend order: the order of 04 §2's table, most to least accountable
 * sender, then the lab's. A display-only constant.
 *
 * @beta
 */
export const TRUST_ORDER: readonly Trust[] = Object.freeze([...TRUSTS]);

/** @beta */
export function trustOrder(): readonly Trust[] {
  return TRUST_ORDER;
}

/**
 * The map image name of a trust class's icon, plain or with the arrow.
 *
 * @public
 */
export function trackIconId(t: Trust, directional: boolean): string {
  return directional ? `us-track-${t}-dir` : `us-track-${t}`;
}

/**
 * Every icon the track layer adds to the map, once per style.
 *
 * @beta
 */
export const TRACK_ICON_IDS: readonly {
  id: string;
  trust: Trust;
  directional: boolean;
}[] = Object.freeze(
  TRUSTS.flatMap((trust) =>
    [false, true].map((directional) => ({
      id: trackIconId(trust, directional),
      trust,
      directional,
    })),
  ),
);

/**
 * The `properties` of a track's point feature (TrackLayer).
 *
 * @beta
 */
export interface TrackFeatureProperties {
  kind: "track";
  /** The track id. */
  identifier: string;
  trust: Trust;
  /** The status drawn (`identDrawn`): the API's, or `none`. */
  ident: IdentKey;
  /** `identMark(ident)`; empty for registered. */
  mark: string;
  /** Course over ground as the API sent it; null draws no arrow (R-10). */
  trackDeg: number | null;
  emergency: boolean;
  selected: boolean;
  age: AgeBucket;
  /** The label text, already translated; lines joined with "\n". */
  label: string;
}

/**
 * The `properties` of a track's trail (TrackLayer).
 *
 * @beta
 */
export interface TrailFeatureProperties {
  kind: "trail";
  identifier: string;
  ident: IdentKey;
  age: AgeBucket;
}

/**
 * The colours the track layers paint with, resolved per scheme.
 *
 * @public
 */
export interface TrackColours {
  ident: Readonly<Record<IdentKey, string>>;
  /** The emergency ring: the critical severity's colour. */
  emergency: string;
  /** The selection ring and the marks: the text colour. */
  selected: string;
  /** Halo around icons and text: the surface colour. */
  halo: string;
}

/**
 * The token each `TrackColours` field resolves from.
 *
 * @beta
 */
export const TRACK_COLOUR_TOKENS = Object.freeze({
  emergency: tokens.severity.critical,
  selected: "--us-text",
  halo: "--us-surface",
});

function byIdent(colours: TrackColours): ExpressionSpecification {
  const arms = IDENT_ORDER.flatMap((s) => [s, colours.ident[s]]);
  // A `match` with one arm per status; its length is not a fixed tuple,
  // so the compiler cannot check it, and track.test.ts parses it instead.
  const expr = ["match", ["get", "ident"], ...arms, colours.ident.none];
  return expr as ExpressionSpecification;
}

/**
 * The opacity of a feature by its age bucket, the same numbers as
 * `ageOpacity`. A feature without a known bucket draws in full.
 *
 * @beta
 */
export function ageOpacityExpression(): ExpressionSpecification {
  const arms = AGE_BUCKETS.flatMap((b) => [b, ageOpacity(b)]);
  const expr = ["match", ["get", "age"], ...arms, 1];
  return expr as ExpressionSpecification;
}

/**
 * The icon per trust class, plain when `trackDeg` is null and with the
 * arrow otherwise. A trust value the kit does not know draws as the
 * hollow broadcast icon: the least trusted symbol, never an upgrade.
 */
function iconImage(): ExpressionSpecification {
  const noDirection: ExpressionSpecification = [
    "==",
    ["get", "trackDeg"],
    null,
  ];
  const arms = TRUSTS.flatMap((t) => [
    t,
    ["case", noDirection, trackIconId(t, false), trackIconId(t, true)],
  ]);
  const expr = [
    "match",
    ["get", "trust"],
    ...arms,
    [
      "case",
      noDirection,
      trackIconId("broadcast", false),
      trackIconId("broadcast", true),
    ],
  ];
  return expr as ExpressionSpecification;
}

/** Zoom stops of the icon size, label size and ring radius. Display-only constants. */
const ZOOM_LOW = 8;
const ZOOM_HIGH = 16;

/** @public */
export interface TrackStyle {
  pointFilter: FilterSpecification;
  trailFilter: FilterSpecification;
  emergencyFilter: FilterSpecification;
  selectedFilter: FilterSpecification;
  /** Points with a status mark (every status but registered). */
  markFilter: FilterSpecification;
  iconImage: ExpressionSpecification;
  iconRotate: ExpressionSpecification;
  iconColor: ExpressionSpecification;
  iconOpacity: ExpressionSpecification;
  iconSize: ExpressionSpecification;
  textSize: ExpressionSpecification;
  ringRadius: ExpressionSpecification;
  /** The emergency ring sits outside the selection ring. */
  emergencyRadius: ExpressionSpecification;
  trailColor: ExpressionSpecification;
  trailOpacity: ExpressionSpecification;
}

/**
 * The paint and layout values of the track layers, keyed on the feature
 * properties of `TrackFeatureProperties` and `TrailFeatureProperties`.
 * `colours` are the tokens resolved in the map's scheme (MapLibre cannot
 * read a CSS variable).
 *
 * @public
 */
export function trackStyle(colours: TrackColours): TrackStyle {
  const isPoint: FilterSpecification = ["==", ["geometry-type"], "Point"];
  const opacity = ageOpacityExpression();
  return {
    pointFilter: isPoint,
    trailFilter: ["==", ["geometry-type"], "LineString"],
    emergencyFilter: ["all", isPoint, ["==", ["get", "emergency"], true]],
    selectedFilter: ["all", isPoint, ["==", ["get", "selected"], true]],
    markFilter: ["all", isPoint, ["!=", ["get", "mark"], ""]],
    iconImage: iconImage(),
    iconRotate: ["coalesce", ["get", "trackDeg"], 0],
    iconColor: byIdent(colours),
    iconOpacity: opacity,
    iconSize: [
      "interpolate",
      ["linear"],
      ["zoom"],
      ZOOM_LOW,
      0.7,
      ZOOM_HIGH,
      1.1,
    ],
    textSize: [
      "interpolate",
      ["linear"],
      ["zoom"],
      ZOOM_LOW,
      10,
      ZOOM_HIGH,
      13,
    ],
    ringRadius: [
      "interpolate",
      ["linear"],
      ["zoom"],
      ZOOM_LOW,
      12,
      ZOOM_HIGH,
      19,
    ],
    emergencyRadius: [
      "interpolate",
      ["linear"],
      ["zoom"],
      ZOOM_LOW,
      16,
      ZOOM_HIGH,
      23,
    ],
    trailColor: byIdent(colours),
    trailOpacity: ["*", 0.6, opacity],
  };
}
