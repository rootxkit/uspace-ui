// Manned traffic symbology (docs/PLAN.md §3.8, WP-12; spec 02 F4, 04 §2):
// what a manned aircraft looks like on the map, from the fields the API
// sent. A family of its own (a plane silhouette, never one of the six
// track shapes, so a manned aircraft is never read as a drone), coloured
// by trust class (`surveillance` via the ANSP, `broadcast` from the
// USSP's own e-conspicuity receiver), hollow when the position is a
// broadcast (R-05: anyone can transmit it), faded by age bucket, a ring
// for an emergency and another for the selection. Pure: no React, no map,
// no clock, and no `Math`: the outline is drawn with trackIcon.ts's
// helpers.
//
// Changing what a colour, a fill or a ring *means* is a major (PLAN §12)
// and needs the `legend-change` label; manned.test.ts snapshots the
// expressions so such a change shows up in review.
import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";

import type { Key } from "../i18n/en.js";
import {
  TRUSTS,
  isTrust,
  type MannedView,
  type Trust,
} from "../model/index.js";
import { tokens, type AgeBucket } from "../theme/tokens.js";
import { TRACK_COLOUR_TOKENS, ageOpacityExpression } from "./track.js";
import {
  TRACK_ICON_PX,
  circlePath,
  polygonPath,
  sdCircle,
  sdPolygon,
  sdfBitmap,
  type IconPart,
  type IconPoint,
} from "./trackIcon.js";
import type { PatternImage } from "./zone.js";

/**
 * A manned track as the layers and the detail take it: the frozen
 * `MannedView` plus two fields the spec carries and PLAN §3.1 does not
 * (WP-12 spec gap, docs/PLAN.md §14 Q20): `trust` (04 §2 puts a trust
 * class on every track-like message; F4: `surveillance` via the ANSP,
 * `broadcast` from the USSP's own receiver) and `anomaly` (LESSONS I-04:
 * two identities on one address, counted by the server; shown when sent).
 * Both optional, so a `MannedStore` snapshot is accepted as it is.
 *
 * @public
 */
export type MannedTrack = MannedView & {
  trust?: Trust | null;
  anomaly?: string | null;
};

/**
 * How a manned symbol is filled.
 *
 * @beta
 */
export type MannedFill = "solid" | "hollow";

/**
 * `hollow` for a broadcast position (ADS-B or ADS-L heard by the USSP's
 * own receiver, R-05) and for simulated lab traffic; `solid` for every
 * class a system vouches for. Total over `Trust`.
 *
 * @beta
 */
export function mannedFill(t: Trust): MannedFill {
  switch (t) {
    case "broadcast":
    case "simulated":
      return "hollow";
    case "authenticated":
    case "provider":
    case "surveillance":
    case "sensor":
      return "solid";
    default:
      return t satisfies never;
  }
}

/**
 * The CSS variable of a manned symbol's colour: its trust class's.
 *
 * @beta
 */
export function mannedToken(t: Trust): string {
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
 * The trust class a manned track is drawn with: the API's, or `broadcast`
 * when the API sent none or one the kit does not know. `MannedView` (PLAN
 * §3.1) carries no `trust` although 04 §2 puts one on every track-like
 * message (WP-12 spec gap); an absent class is never drawn as vouched for
 * (CLAUDE.md rule 6: never upgrade), and the label says it was absent.
 *
 * @beta
 */
export function mannedTrustDrawn(t: unknown): Trust {
  return isTrust(t) ? t : "broadcast";
}

/**
 * The map image name of a manned icon, with or without a course.
 *
 * @beta
 */
export function mannedIconId(t: Trust, directional: boolean): string {
  return directional ? `us-manned-${t}-dir` : `us-manned-${t}`;
}

/**
 * Every icon the manned layer adds to the map, once per style.
 *
 * @beta
 */
export const MANNED_ICON_IDS: readonly {
  id: string;
  trust: Trust;
  directional: boolean;
}[] = Object.freeze(
  TRUSTS.flatMap((trust) =>
    [false, true].map((directional) => ({
      id: mannedIconId(trust, directional),
      trust,
      directional,
    })),
  ),
);

// --- the outline, in icon pixels (centre origin, nose up) --------------------
// Display-only constants: a top view of a fixed-wing aircraft, the outline
// width of a hollow one, and the ring that marks "no course reported".

const PLANE: readonly IconPoint[] = [
  [0, -16],
  [2.2, -12.5],
  [2.2, -4.5],
  [14, 1.5],
  [14, 4.5],
  [2.2, 1.5],
  [2.2, 9],
  [6.5, 12],
  [6.5, 14.5],
  [0, 12.8],
  [-6.5, 14.5],
  [-6.5, 12],
  [-2.2, 9],
  [-2.2, 1.5],
  [-14, 4.5],
  [-14, 1.5],
  [-2.2, -4.5],
  [-2.2, -12.5],
];
const STROKE = 3;
/**
 * A track with no reported course (`trackDeg` null, R-10) is drawn inside
 * a ring: the silhouette then cannot be read as pointing anywhere.
 */
const NO_COURSE_RING_R = 21;
const NO_COURSE_RING_W = 2;

const abs = (v: number): number => (v < 0 ? -v : v);

/**
 * Signed distance of point `p` (icon pixels) to a manned icon.
 *
 * @beta
 */
export function mannedIconDistance(
  t: Trust,
  directional: boolean,
  p: IconPoint,
): number {
  const plane = sdPolygon(p, PLANE);
  const d = mannedFill(t) === "solid" ? plane : abs(plane) - STROKE / 2;
  if (directional) return d;
  const ring = abs(sdCircle(p, NO_COURSE_RING_R)) - NO_COURSE_RING_W / 2;
  return d < ring ? d : ring;
}

/**
 * The icon as an SDF bitmap for `map.addImage(id, image, { sdf: true,
 * pixelRatio: TRACK_ICON_PIXEL_RATIO })`, tinted by `icon-color`.
 *
 * @beta
 */
export function mannedIconSdf(t: Trust, directional: boolean): PatternImage {
  return sdfBitmap((p) => mannedIconDistance(t, directional, p));
}

/**
 * The icon's SVG parts in the TRACK_ICON_PX viewBox (legends, the DOM).
 *
 * @beta
 */
export function mannedIconParts(t: Trust, directional: boolean): IconPart[] {
  const parts: IconPart[] = [
    mannedFill(t) === "solid"
      ? { d: polygonPath(PLANE), fill: true, strokeWidth: 0, dash: null }
      : { d: polygonPath(PLANE), fill: false, strokeWidth: STROKE, dash: null },
  ];
  if (!directional) {
    parts.push({
      d: circlePath(NO_COURSE_RING_R),
      fill: false,
      strokeWidth: NO_COURSE_RING_W,
      dash: null,
    });
  }
  return parts;
}

/**
 * The side of the icon's viewBox, for a consumer drawing `mannedIconParts`.
 *
 * @beta
 */
export const MANNED_ICON_PX = TRACK_ICON_PX;

// --- words -------------------------------------------------------------------

/**
 * The source classes 02 F4 names, with a word each; any other value is
 * shown as the server sent it (`manned.source_class.other`).
 *
 * @beta
 */
export const MANNED_SOURCE_CLASS_KEYS: Readonly<Record<string, Key>> =
  Object.freeze({
    ads_b: "manned.source_class.ads_b",
    mode_s: "manned.source_class.mode_s",
    ssr: "manned.source_class.ssr",
    atm_feed: "manned.source_class.atm_feed",
    ads_l: "manned.source_class.ads_l",
  });

// --- MapLibre expressions ----------------------------------------------------

/**
 * The `properties` of a manned aircraft's point feature (MannedLayer).
 *
 * @beta
 */
export interface MannedFeatureProperties {
  kind: "manned";
  /** The track id. */
  identifier: string;
  /** `mannedTrustDrawn` of the API's class. */
  trust: Trust;
  /** False when the API sent no trust class (drawn as broadcast). */
  trustStated: boolean;
  /** Course over ground as the API sent it; null: no course, ringed icon. */
  trackDeg: number | null;
  emergency: boolean;
  selected: boolean;
  age: AgeBucket;
  /** The label text, already translated; lines joined with "\n". */
  label: string;
}

/**
 * The colours the manned layers paint with, resolved per scheme.
 *
 * @beta
 */
export interface MannedColours {
  trust: Readonly<Record<Trust, string>>;
  emergency: string;
  selected: string;
  halo: string;
}

/**
 * The tokens of the rings and halo: the track layer's.
 *
 * @beta
 */
export const MANNED_COLOUR_TOKENS = TRACK_COLOUR_TOKENS;

/** @beta */
export interface MannedStyle {
  emergencyFilter: FilterSpecification;
  selectedFilter: FilterSpecification;
  iconImage: ExpressionSpecification;
  iconRotate: ExpressionSpecification;
  iconColor: ExpressionSpecification;
  iconOpacity: ExpressionSpecification;
  iconSize: ExpressionSpecification;
  textSize: ExpressionSpecification;
  ringRadius: ExpressionSpecification;
  emergencyRadius: ExpressionSpecification;
}

function byTrust(colours: MannedColours): ExpressionSpecification {
  const arms = TRUSTS.flatMap((t) => [t, colours.trust[t]]);
  const expr = ["match", ["get", "trust"], ...arms, colours.trust.broadcast];
  return expr as ExpressionSpecification;
}

/**
 * The icon per trust class, ringed when `trackDeg` is null. A class the
 * kit does not know draws as the hollow broadcast icon, never an upgrade.
 */
function iconImage(): ExpressionSpecification {
  const noCourse: ExpressionSpecification = ["==", ["get", "trackDeg"], null];
  const pick = (t: Trust): ExpressionSpecification => [
    "case",
    noCourse,
    mannedIconId(t, false),
    mannedIconId(t, true),
  ];
  const arms = TRUSTS.flatMap((t) => [t, pick(t)]);
  const expr = ["match", ["get", "trust"], ...arms, pick("broadcast")];
  return expr as ExpressionSpecification;
}

/** Zoom stops of the sizes. Display-only constants. */
const ZOOM_LOW = 8;
const ZOOM_HIGH = 16;

const byZoom = (low: number, high: number): ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["zoom"],
  ZOOM_LOW,
  low,
  ZOOM_HIGH,
  high,
];

/**
 * The paint and layout values of the manned layers, keyed on
 * `MannedFeatureProperties`; `colours` are the tokens resolved in the
 * map's scheme.
 *
 * @beta
 */
export function mannedStyle(colours: MannedColours): MannedStyle {
  return {
    emergencyFilter: ["==", ["get", "emergency"], true],
    selectedFilter: ["==", ["get", "selected"], true],
    iconImage: iconImage(),
    iconRotate: ["coalesce", ["get", "trackDeg"], 0],
    iconColor: byTrust(colours),
    iconOpacity: ageOpacityExpression(),
    // A manned aircraft draws larger than a drone at the same zoom.
    iconSize: byZoom(0.85, 1.3),
    textSize: byZoom(10, 13),
    ringRadius: byZoom(15, 23),
    emergencyRadius: byZoom(19, 27),
  };
}
