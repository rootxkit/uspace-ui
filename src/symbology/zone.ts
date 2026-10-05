// Zone symbology (docs/PLAN.md §3.8, WP-6): pure maps from a zone's
// fields as the API served them to colour, pattern, opacity and the
// MapLibre expressions the zone layers use. No React, no map, no clock.
//
// What this file never does (CLAUDE.md rule 2, LESSONS T-09, Z-07): decide
// whether a zone applies. `applies` is a field the server sets (spec 02 F3,
// `?applies_at=` and `cis_applicability`, reconciliation M17); a zone is
// dimmed only when it says `false`, and `null` draws in full, because a
// zone drawn dimmed by a wrong rule is a zone a pilot flies into.
//
// Changing what a colour, pattern or line *means* is a major (PLAN §12)
// and needs the `legend-change` label; zone.test.ts snapshots the
// expressions so such a change shows up in review.
import type { ExpressionSpecification, FilterSpecification } from "maplibre-gl";

import type { Key } from "../i18n/en.js";
import {
  ZONE_TYPES,
  type RestrictionState,
  type ZoneType,
  type ZoneView,
} from "../model/index.js";
import { tokens } from "../theme/tokens.js";

/**
 * How a zone's area is filled; the second cue beside colour.
 *
 * @public
 */
export type ZonePattern = "solid" | "hatched" | "dotted" | "none";

/**
 * The CSS variable of a zone type's colour (styles/tokens.css).
 *
 * @public
 */
export function zoneToken(t: ZoneType): string {
  switch (t) {
    case "PROHIBITED":
    case "REQ_AUTHORIZATION":
    case "CONDITIONAL":
    case "NO_RESTRICTION":
    case "USPACE":
      return tokens.zone[t];
    default:
      return t satisfies never;
  }
}

/**
 * PROHIBITED solid (reads as the gravest, LESSONS Z-10), REQ_AUTHORIZATION
 * hatched, CONDITIONAL dotted, NO_RESTRICTION and USPACE outline only (the
 * two told apart by line weight, `zoneLineWidthPx`). Every type is
 * distinguishable without colour.
 *
 * @public
 */
export function zonePattern(t: ZoneType): ZonePattern {
  switch (t) {
    case "PROHIBITED":
      return "solid";
    case "REQ_AUTHORIZATION":
      return "hatched";
    case "CONDITIONAL":
      return "dotted";
    case "NO_RESTRICTION":
    case "USPACE":
      return "none";
    default:
      return t satisfies never;
  }
}

/**
 * Outline width per type, in CSS pixels. Display-only constants: USPACE
 * is the heavy outline, NO_RESTRICTION the light one.
 *
 * @beta
 */
export function zoneLineWidthPx(t: ZoneType): number {
  switch (t) {
    case "PROHIBITED":
      return 2.5;
    case "REQ_AUTHORIZATION":
    case "CONDITIONAL":
      return 2;
    case "NO_RESTRICTION":
      return 1;
    case "USPACE":
      return 3;
    default:
      return t satisfies never;
  }
}

/**
 * The catalogue key of a zone type's name (both catalogues carry it).
 *
 * @beta
 */
export const ZONE_TYPE_KEYS: Readonly<Record<ZoneType, Key>> = Object.freeze({
  PROHIBITED: "zone.type.PROHIBITED",
  REQ_AUTHORIZATION: "zone.type.REQ_AUTHORIZATION",
  CONDITIONAL: "zone.type.CONDITIONAL",
  NO_RESTRICTION: "zone.type.NO_RESTRICTION",
  USPACE: "zone.type.USPACE",
});

/**
 * The catalogue key naming a pattern, for the legend's text.
 *
 * @beta
 */
export const ZONE_PATTERN_KEYS: Readonly<Record<ZonePattern, Key>> =
  Object.freeze({
    solid: "zone.pattern.solid",
    hatched: "zone.pattern.hatched",
    dotted: "zone.pattern.dotted",
    none: "zone.pattern.none",
  });

/**
 * Fill opacity per pattern before dimming. Display-only constants.
 *
 * @beta
 */
export function zonePatternFillOpacity(p: ZonePattern): number {
  switch (p) {
    case "solid":
      return 0.3;
    case "hatched":
      return 0.1;
    case "dotted":
      return 0.08;
    case "none":
      return 0;
    default:
      return p satisfies never;
  }
}

/**
 * Legend order, gravest first. A display-only constant: the order a
 * legend lists the types in, not a ranking any logic reads.
 *
 * @beta
 */
export const ZONE_LEGEND_ORDER: readonly ZoneType[] = Object.freeze([
  "PROHIBITED",
  "REQ_AUTHORIZATION",
  "CONDITIONAL",
  "USPACE",
  "NO_RESTRICTION",
] satisfies ZoneType[]);

/** @beta */
export function zoneOrder(): readonly ZoneType[] {
  return ZONE_LEGEND_ORDER;
}

/**
 * Opacity factor of a dimmed zone. Display-only constant.
 *
 * @beta
 */
export const ZONE_DIMMED_OPACITY = 0.35;

/**
 * The restriction states that draw dimmed (spec 02 F2): not yet in force,
 * or no longer. The state is the server's; the kit only reads it.
 *
 * @beta
 */
export const DIMMED_RESTRICTION_STATES: readonly RestrictionState[] =
  Object.freeze(["planned", "ended", "cancelled"] satisfies RestrictionState[]);

/**
 * 1 for a zone drawn in full, `ZONE_DIMMED_OPACITY` for a dimmed one:
 * dimmed when the server said `applies: false` or the restriction state is
 * planned, ended or cancelled. `applies: null` (the server did not say) is
 * drawn in full: not stated is not "off" (CLAUDE.md rule 6).
 *
 * @public
 */
export function zoneOpacity(
  z: Pick<ZoneView, "applies" | "restrictionState">,
): number {
  if (z.applies === false) return ZONE_DIMMED_OPACITY;
  if (
    z.restrictionState !== null &&
    DIMMED_RESTRICTION_STATES.includes(z.restrictionState)
  ) {
    return ZONE_DIMMED_OPACITY;
  }
  return 1;
}

/**
 * The map image name of a type's fill pattern, or null for none.
 *
 * @beta
 */
export function zonePatternImageId(t: ZoneType): string | null {
  const p = zonePattern(t);
  return p === "hatched" || p === "dotted" ? `us-zone-pattern-${t}` : null;
}

/**
 * The zone types that draw a pattern image.
 *
 * @beta
 */
export const PATTERNED_ZONE_TYPES: readonly ZoneType[] = Object.freeze(
  ZONE_TYPES.filter((t) => zonePatternImageId(t) !== null),
);

/**
 * Side of a generated pattern tile, in pixels. Display-only constant.
 *
 * @beta
 */
export const PATTERN_TILE_PX = 8;

/** @beta */
export interface PatternImage {
  width: number;
  height: number;
  /** RGBA, row-major, `width * height * 4` bytes. */
  data: Uint8Array;
}

/** @beta */
export type Rgb = readonly [number, number, number];

/**
 * `#rrggbb` or `#rgb` as three bytes; null for anything else (a token
 * that did not resolve, a colour function). The caller counts the null.
 *
 * @beta
 */
export function parseHexColour(s: string): Rgb | null {
  const v = s.trim();
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  if (long !== null) {
    return [
      parseInt(long[1] ?? "", 16),
      parseInt(long[2] ?? "", 16),
      parseInt(long[3] ?? "", 16),
    ];
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (short !== null) {
    return [
      parseInt((short[1] ?? "").repeat(2), 16),
      parseInt((short[2] ?? "").repeat(2), 16),
      parseInt((short[3] ?? "").repeat(2), 16),
    ];
  }
  return null;
}

/**
 * A pattern tile in `rgb`: diagonal stripes for "hatched", a dot grid for
 * "dotted"; the rest is transparent. Pixel arithmetic on a tile, not
 * geometry: the tile repeats across whatever polygon the API sent.
 *
 * @beta
 */
export function zonePatternImage(
  pattern: "hatched" | "dotted",
  rgb: Rgb,
): PatternImage {
  const size = PATTERN_TILE_PX;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on =
        pattern === "hatched"
          ? (x + y) % size < 2
          : x % 4 >= 1 && x % 4 <= 2 && y % 4 >= 1 && y % 4 <= 2;
      if (!on) continue;
      const i = (y * size + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

/**
 * Each zone type's colour as resolved from its token, per scheme.
 *
 * @public
 */
export type ZoneColours = Readonly<Record<ZoneType, string>>;

/**
 * The `properties` a zone feature carries onto the map (ZoneLayer).
 *
 * @beta
 */
export interface ZoneFeatureProperties {
  identifier: string;
  name: string | null;
  type: ZoneType;
  applies: boolean | null;
  restrictionState: RestrictionState | null;
  selected: boolean;
  lowerLimitM: number | null;
  lowerRef: string | null;
  upperLimitM: number | null;
  upperRef: string | null;
}

/** A `match` on `properties.type` over every zone type. */
function byType(
  value: (t: ZoneType) => string | number,
  fallback: string | number,
): ExpressionSpecification {
  const arms = ZONE_TYPES.flatMap((t) => [t, value(t)]);
  // A `match` with one arm per type; its length is not a fixed tuple, so
  // the compiler cannot check it, and zone.test.ts parses it instead.
  const expr = ["match", ["get", "type"], ...arms, fallback];
  return expr as ExpressionSpecification;
}

/**
 * The dimming factor as an expression, the same rule as `zoneOpacity`:
 * `applies == false` or a dimmed restriction state; `null` is full.
 *
 * @beta
 */
export function zoneDimExpression(): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "applies"], false],
    ZONE_DIMMED_OPACITY,
    [
      "in",
      ["coalesce", ["get", "restrictionState"], ""],
      ["literal", [...DIMMED_RESTRICTION_STATES]],
    ],
    ZONE_DIMMED_OPACITY,
    1,
  ];
}

/**
 * Extra outline width of the selected zone. Display-only constant.
 *
 * @beta
 */
export const SELECTED_EXTRA_WIDTH_PX = 2;

/** @public */
export interface ZoneStyle {
  fillColor: ExpressionSpecification;
  fillOpacity: ExpressionSpecification;
  /** Which features the pattern layer draws. */
  patternFilter: FilterSpecification;
  fillPattern: ExpressionSpecification;
  patternOpacity: ExpressionSpecification;
  lineColor: ExpressionSpecification;
  lineWidth: ExpressionSpecification;
  lineOpacity: ExpressionSpecification;
}

/**
 * The paint values of the zone layers, keyed on `properties.type`,
 * `properties.applies`, `properties.restrictionState` and
 * `properties.selected`. `colours` are the tokens resolved in the map's
 * scheme (MapLibre cannot read a CSS variable); a pattern's colour is in
 * its image.
 *
 * @public
 */
export function zoneStyle(colours: ZoneColours): ZoneStyle {
  const dim = zoneDimExpression();
  const colour = byType((t) => colours[t], colours.PROHIBITED);
  return {
    fillColor: colour,
    fillOpacity: [
      "*",
      byType((t) => zonePatternFillOpacity(zonePattern(t)), 0),
      dim,
    ],
    patternFilter: [
      "in",
      ["get", "type"],
      ["literal", [...PATTERNED_ZONE_TYPES]],
    ],
    fillPattern: byType((t) => zonePatternImageId(t) ?? "", ""),
    patternOpacity: dim,
    lineColor: colour,
    lineWidth: [
      "+",
      byType(zoneLineWidthPx, 1),
      ["case", ["==", ["get", "selected"], true], SELECTED_EXTRA_WIDTH_PX, 0],
    ],
    lineOpacity: dim,
  };
}
