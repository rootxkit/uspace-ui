// Operational intent symbology (docs/PLAN.md §3.8, WP-12; spec 02 F6,
// 04 §3.5): how an intent's footprint draws, from the state the API gave
// it. Fill and outline per DSS state (`Accepted` thin, `Activated` solid,
// `Nonconforming` in the warning colour, `Contingent` in the critical
// colour), a dashed muted outline for a state the API did not send or the
// kit does not know (never drawn as if it were `Activated`), a diamond
// pattern over another USSP's intent seen through the DSS (`peer`), and
// emphasis for the selection and for what the app says is current. The
// state, the footprint and "current" are the server's and the app's; the
// kit derives none of them, and reads no clock. Pure: no React, no map.
import type { FilterSpecification } from "maplibre-gl";

import type { Key } from "../i18n/en.js";
import { tokens } from "../theme/tokens.js";
import type { PatternImage, Rgb } from "./zone.js";

/**
 * The ASTM F3548-21 operational intent states, string for string as
 * uspace-core v1.3.0 `f3548.OperationalIntentState` spells them
 * (f3548/types.gen.go: Accepted, Activated, Contingent, Nonconforming).
 *
 * @beta
 */
export const DSS_STATES = [
  "Accepted",
  "Activated",
  "Nonconforming",
  "Contingent",
] as const;
/** @beta */
export type DssState = (typeof DSS_STATES)[number];

/** @beta */
export function isDssState(v: unknown): v is DssState {
  return typeof v === "string" && (DSS_STATES as readonly string[]).includes(v);
}

/**
 * A DSS state as drawn: one of the four, or `unstated`.
 *
 * @beta
 */
export type IntentStateKey = DssState | "unstated";

/** @beta */
export const INTENT_STATE_KEYS_ORDER: readonly IntentStateKey[] = Object.freeze(
  [...DSS_STATES, "unstated"],
);

/**
 * The state an intent is drawn with: the API's `dssState` when it is one
 * of the four, else `unstated` (null, or a value the kit does not know,
 * which the card shows as sent).
 *
 * @beta
 */
export function intentStateDrawn(dssState: string | null): IntentStateKey {
  return isDssState(dssState) ? dssState : "unstated";
}

/**
 * The five looks the symbology is total over: four states and `peer`.
 *
 * @beta
 */
export type IntentKey = DssState | "peer";

/**
 * How one look draws. Widths in CSS pixels, dashes in line widths.
 *
 * @beta
 */
export interface IntentLook {
  /** The CSS variable of the outline and fill (or pattern) colour. */
  token: string;
  fillOpacity: number;
  lineWidthPx: number;
  /** MapLibre `line-dasharray`; null for a solid line. */
  dash: readonly number[] | null;
  pattern: "none" | "diamond";
}

/**
 * The look per state, and the `peer` overlay: another USSP's intent is
 * drawn with its state's outline and fill, and the diamond pattern in the
 * provider colour on top (its footprint is a peer's claim through the
 * DSS, PLAN §14 Q18). Display-only constants.
 *
 * @beta
 */
export function intentLook(k: IntentKey | "unstated"): IntentLook {
  switch (k) {
    case "Accepted":
      return {
        token: "--us-text",
        fillOpacity: 0.04,
        lineWidthPx: 1,
        dash: null,
        pattern: "none",
      };
    case "Activated":
      return {
        token: "--us-text",
        fillOpacity: 0.18,
        lineWidthPx: 2.5,
        dash: null,
        pattern: "none",
      };
    case "Nonconforming":
      return {
        token: tokens.severity.warning,
        fillOpacity: 0.22,
        lineWidthPx: 3,
        dash: null,
        pattern: "none",
      };
    case "Contingent":
      return {
        token: tokens.severity.critical,
        fillOpacity: 0.26,
        lineWidthPx: 3.5,
        dash: null,
        pattern: "none",
      };
    case "peer":
      return {
        token: tokens.trust.provider,
        fillOpacity: 0,
        lineWidthPx: 0,
        dash: null,
        pattern: "diamond",
      };
    case "unstated":
      return {
        token: "--us-text-muted",
        fillOpacity: 0.04,
        lineWidthPx: 1.5,
        dash: [2, 2],
        pattern: "none",
      };
    default:
      return k satisfies never;
  }
}

/**
 * Added to the outline of the selected intent. Display-only constant.
 *
 * @beta
 */
export const INTENT_SELECTED_EXTRA_WIDTH_PX = 2;
/**
 * Added to the outline, and to the fill opacity, of an intent the app
 * lists in `activeIds` (what the API says is current). Display-only.
 *
 * @beta
 */
export const INTENT_ACTIVE_EXTRA_WIDTH_PX = 1.5;
/** @beta */
export const INTENT_ACTIVE_EXTRA_FILL = 0.12;

/**
 * The catalogue key of a state's name.
 *
 * @beta
 */
export const INTENT_STATE_KEYS: Readonly<Record<IntentStateKey, Key>> =
  Object.freeze({
    Accepted: "intent.state.Accepted",
    Activated: "intent.state.Activated",
    Nonconforming: "intent.state.Nonconforming",
    Contingent: "intent.state.Contingent",
    unstated: "intent.state.unstated",
  });

/**
 * The `properties` of one intent volume's feature (IntentLayer).
 *
 * @beta
 */
export interface IntentFeatureProperties {
  /** The intent id; every volume of one intent carries it. */
  identifier: string;
  /** Which of the intent's volumes, in the API's order. */
  volume: number;
  state: IntentStateKey;
  peer: boolean;
  /** Listed in the app's `activeIds`. */
  active: boolean;
  selected: boolean;
  /** The label text, already translated; lines joined with "\n". */
  label: string;
}

/**
 * The features one state's outline layer draws.
 *
 * @beta
 */
export function intentStateFilter(k: IntentStateKey): FilterSpecification {
  return ["==", ["get", "state"], k];
}

/**
 * The peer pattern's image name.
 *
 * @beta
 */
export const INTENT_PEER_PATTERN_ID = "us-intent-peer";

/**
 * Side of the peer pattern tile, in pixels. Display-only constant.
 *
 * @beta
 */
export const INTENT_PATTERN_TILE_PX = 12;

/**
 * The diamond lattice tile of a peer intent, in `rgb`: the outline of a
 * diamond touching the tile's edge midpoints, so tiles join into a net.
 *
 * @beta
 */
export function intentPeerPatternImage(rgb: Rgb): PatternImage {
  const size = INTENT_PATTERN_TILE_PX;
  const half = size / 2;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - half;
      const dy = y + 0.5 - half;
      const manhattan = (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy);
      const off = manhattan - half;
      if ((off < 0 ? -off : off) > 0.75) continue;
      const i = (y * size + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}
