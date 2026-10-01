// Restriction symbology (docs/PLAN.md §3.8, WP-6; spec 02 F2): the line
// of a dynamic airspace restriction (reason DAR) per state as the API
// served it. The colour of a restriction is its zone type's
// (`zoneStyle`); the state is carried by the line: `planned` dashed,
// `active` solid and thick, `ended` and `cancelled` thin and dimmed. The
// kit never derives a state from the restriction's times.
import type { FilterSpecification } from "maplibre-gl";

import type { Key } from "../i18n/en.js";
import { RESTRICTION_STATES, type RestrictionState } from "../model/index.js";
import { zoneOpacity } from "./zone.js";

/**
 * The CSS variable a state's label and badge are drawn in. The state has
 * no palette of its own: it reads as text, strong while it is planned or
 * active and muted once it is over, beside the dash pattern that carries
 * it on the map.
 */
export function restrictionStateToken(s: RestrictionState): string {
  switch (s) {
    case "planned":
    case "active":
      return "--us-text";
    case "ended":
    case "cancelled":
      return "--us-text-muted";
    default:
      return s satisfies never;
  }
}

/** The catalogue key of a state's name; `unstated` for a null state. */
export const RESTRICTION_STATE_KEYS: Readonly<
  Record<RestrictionState | "unstated", Key>
> = Object.freeze({
  planned: "restriction.state.planned",
  active: "restriction.state.active",
  ended: "restriction.state.ended",
  cancelled: "restriction.state.cancelled",
  unstated: "restriction.state.unstated",
});

/** A restriction outline: width in CSS pixels, dash in line widths. */
export interface RestrictionLine {
  widthPx: number;
  /** MapLibre `line-dasharray`; null for a solid line. */
  dash: readonly number[] | null;
  opacity: number;
}

/**
 * The outline per state; `null` (the API sent no state) is a solid line of
 * medium weight in full: not stated is not "over". Widths and dashes are
 * display-only constants; the opacity is `zoneOpacity`'s, so a restriction
 * dims exactly when a zone in the same state would (the layer's expression
 * also dims on `applies: false`).
 */
export function restrictionLine(s: RestrictionState | null): RestrictionLine {
  const opacity = zoneOpacity({ applies: null, restrictionState: s });
  if (s === null) return { widthPx: 2, dash: null, opacity };
  switch (s) {
    case "planned":
      return { widthPx: 2, dash: [3, 2], opacity };
    case "active":
      return { widthPx: 3.5, dash: null, opacity };
    case "ended":
      return { widthPx: 1, dash: null, opacity };
    case "cancelled":
      return { widthPx: 1, dash: [1, 2], opacity };
    default:
      return s satisfies never;
  }
}

/** A line layer key: a state, or `unstated` for `restrictionState: null`. */
export type RestrictionLineKey = RestrictionState | "unstated";

export const RESTRICTION_LINE_KEYS: readonly RestrictionLineKey[] =
  Object.freeze([...RESTRICTION_STATES, "unstated"]);

/** The features one restriction line layer draws. */
export function restrictionLineFilter(
  k: RestrictionLineKey,
): FilterSpecification {
  return k === "unstated"
    ? ["==", ["coalesce", ["get", "restrictionState"], ""], ""]
    : ["==", ["get", "restrictionState"], k];
}
