// Identification symbology (docs/PLAN.md §3.8, WP-7; spec 04 §3.2): the
// colour, mark, order and wording of an identification as the API sent
// it. The status, reason, basis and mismatch are decided by uspace-core's
// `identify` (authority) or the USSP's resolver; nothing here re-decides
// them (CLAUDE.md rule 2). What this file adds is display hygiene only:
// a mismatch is never drawn in the registered colour (LESSONS G-02,
// CLAUDE.md rule 6), and a basis that is not authenticated always carries
// its caveat (R-05, PLAN §14 Q18).
import type { Key } from "../i18n/en.js";
import type {
  IdentBasis,
  IdentReason,
  IdentStatus,
  Identification,
} from "../model/index.js";
import { tokens } from "../theme/tokens.js";

/**
 * An identification status, or `none`: the track carries no block.
 *
 * @public
 */
export type IdentKey = IdentStatus | "none";

/**
 * The CSS variable of a status's colour; `none` is the grey of no block.
 *
 * @public
 */
export function identToken(s: IdentStatus | null): string {
  if (s === null) return tokens.identNone;
  switch (s) {
    case "registered":
    case "suspended":
    case "unknown_operator":
    case "unidentified":
      return tokens.ident[s];
    default:
      return s satisfies never;
  }
}

/**
 * Legend order: the expected status first, then the ones that need
 * someone's attention, then no identification at all (predecessor
 * `identification.ts`). A display-only constant.
 *
 * @beta
 */
export const IDENT_ORDER: readonly IdentKey[] = Object.freeze([
  "registered",
  "suspended",
  "unknown_operator",
  "unidentified",
  "none",
] satisfies IdentKey[]);

/** @public */
export function identOrder(): readonly IdentKey[] {
  return IDENT_ORDER;
}

/**
 * The statuses LESSONS G-03 lists: an unidentified or unknown-operator
 * aircraft in a PROHIBITED or REQ_AUTHORISATION zone raises
 * `identification` (core `IdentStatus.IncidentStatus`). The server raises
 * it; the kit uses this only to order and annotate the legend.
 *
 * @public
 */
export function needsAttention(s: IdentStatus | null): boolean {
  if (s === null) return false;
  switch (s) {
    case "unknown_operator":
    case "unidentified":
      return true;
    case "registered":
    case "suspended":
      return false;
    default:
      return s satisfies never;
  }
}

/**
 * The status a track is drawn with. `none` for no identification block.
 * A `registered` status that comes with `mismatch: true` is drawn as
 * `unknown_operator`, which is what G-02 says a mismatch is: the server
 * should never send that pair, and if it does the map must not show the
 * registered colour on it (CLAUDE.md rule 6, never upgrade). Every other
 * status is drawn as given.
 *
 * @beta
 */
export function identDrawn(ident: Identification | null): IdentKey {
  if (ident === null) return "none";
  if (ident.mismatch && ident.status === "registered")
    return "unknown_operator";
  return ident.status;
}

/**
 * A mark drawn beside the track's symbol, so that the identification
 * status reads without colour (the palette is chosen for colour-vision
 * deficiency, PLAN §3.2, but colour is never the only cue). `registered`
 * is the one status with no mark. The glyphs are in the basemap's Latin
 * glyph ranges (U+0000-00FF, U+2000-206F). Display-only constants.
 *
 * @beta
 */
export function identMark(s: IdentKey): string {
  switch (s) {
    case "registered":
      return "";
    case "suspended":
      return "!";
    case "unknown_operator":
      return "?";
    case "unidentified":
      return "×";
    case "none":
      return "–";
    default:
      return s satisfies never;
  }
}

/**
 * The catalogue key of a status's name; `none` for no identification.
 *
 * @beta
 */
export const IDENT_STATUS_KEYS: Readonly<Record<IdentKey, Key>> = Object.freeze(
  {
    registered: "ident.status.registered",
    suspended: "ident.status.suspended",
    unknown_operator: "ident.status.unknown_operator",
    unidentified: "ident.status.unidentified",
    none: "ident.status.none",
  },
);

/**
 * The catalogue key of what a status means (the legend's hint).
 *
 * @beta
 */
export const IDENT_STATUS_HINT_KEYS: Readonly<Record<IdentKey, Key>> =
  Object.freeze({
    registered: "ident.hint.registered",
    suspended: "ident.hint.suspended",
    unknown_operator: "ident.hint.unknown_operator",
    unidentified: "ident.hint.unidentified",
    none: "ident.hint.none",
  });

/**
 * The catalogue key of a reason code (04 §3.2), for the detail.
 *
 * @beta
 */
export const IDENT_REASON_KEYS: Readonly<Record<IdentReason, Key>> =
  Object.freeze({
    matched: "ident.reason.matched",
    session_binding: "ident.reason.session_binding",
    uas_suspended: "ident.reason.uas_suspended",
    uas_revoked: "ident.reason.uas_revoked",
    operator_suspended: "ident.reason.operator_suspended",
    operator_revoked: "ident.reason.operator_revoked",
    serial_unknown: "ident.reason.serial_unknown",
    not_a_serial: "ident.reason.not_a_serial",
    operator_absent: "ident.reason.operator_absent",
    operator_mismatch: "ident.reason.operator_mismatch",
    owner_unknown: "ident.reason.owner_unknown",
    not_in_registry: "ident.reason.not_in_registry",
    serial_conflict: "ident.reason.serial_conflict",
    no_serial: "ident.reason.no_serial",
    registry_unavailable: "ident.reason.registry_unavailable",
  });

/**
 * The catalogue key of a basis's name (WP-2 keys).
 *
 * @beta
 */
export const IDENT_BASIS_KEYS: Readonly<Record<IdentBasis, Key>> =
  Object.freeze({
    authenticated: "ident.basis.authenticated",
    as_broadcast: "ident.basis.as_broadcast",
    provider: "ident.basis.provider",
  });

/**
 * The lines of an identification's detail text, as catalogue keys.
 *
 * @beta
 */
export interface IdentHint {
  /** What the status means. */
  status: Key;
  /** Why, from the reason code. */
  reason: Key;
  /**
   * The basis caveat: "as broadcast and unverified" (R-05), "reported by
   * a provider, unverified" (PLAN §14 Q18), or null for an authenticated
   * basis, which needs none.
   */
  caveat: Key | null;
  /** The mismatch line (G-02), whatever the status; null without one. */
  mismatch: Key | null;
}

/**
 * The basis caveat. A `registered` status on a broadcast basis has its
 * own wording, "registered, as broadcast and unverified" (R-05, the fix of
 * utm PR #21); every other status on that basis says "as broadcast and
 * unverified".
 */
function caveatKey(status: IdentStatus, basis: IdentBasis): Key | null {
  switch (basis) {
    case "authenticated":
      return null;
    case "as_broadcast":
      return status === "registered"
        ? "ident.registered_as_broadcast"
        : "ident.caveat.as_broadcast";
    case "provider":
      return "ident.caveat.provider";
    default:
      return basis satisfies never;
  }
}

/**
 * The detail text of an identification (TrackDetail, WP-12, renders it):
 * the status hint, the reason, the basis caveat and the mismatch line.
 * Total over every status, reason and basis.
 *
 * @beta
 */
export function identHintKey(
  status: IdentStatus,
  reason: IdentReason,
  basis: IdentBasis,
  mismatch = false,
): IdentHint {
  return {
    status: IDENT_STATUS_HINT_KEYS[status],
    reason: IDENT_REASON_KEYS[reason],
    caveat: caveatKey(status, basis),
    mismatch: mismatch ? "ident.mismatch" : null,
  };
}
