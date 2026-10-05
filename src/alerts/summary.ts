// The one-line summary of an alert or a violation (docs/PLAN.md §3.13,
// WP-11): the kind's sentence from the alert's `detail`, through the
// catalogue, with the unit in every number and the datum in every
// altitude (E-13). It computes nothing: every number is the server's,
// shown as sent (`t_cpa_s` is the server's time to closest approach); a
// number the API did not send is a dash, never a zero and never another
// field's value (CLAUDE.md rule 6).
//
// The `detail` keys are those of spec 04 §3.3. Where uspace-core v1.3.0
// names the same quantity differently (alerting/conflict.go
// `d_cpa_horizontal_m`, `d_alt_at_cpa_m`; alerting/zone.go `identifier`)
// that name is read when the spec's is absent; `lost_link` reads
// `silence_s`, the name the USSP's conformance monitor sends (spec 04
// names no field for it). A clear reads only the `clearing_` numbers the
// clear carries (core alerting/conflict.go clearingDetail; C-14), so a
// clear never shows the raise's numbers.
import { DASH, fmtNum } from "../i18n/format.js";
import type { Lang } from "../i18n/lang.js";
import {
  createTranslator,
  type Catalogues,
  type Translate,
} from "../i18n/translate.js";
import { isZoneType, type AlertView } from "../model/index.js";
import { ZONE_TYPE_KEYS } from "../symbology/zone.js";
import {
  ALERT_KIND_KEYS,
  ALERT_SUMMARY_KEYS,
  CLEAR_REASON_KEYS,
  NONCONFORMANCE_REASON_KEYS,
} from "./words.js";

type Detail = Readonly<Record<string, unknown>>;

/**
 * The first of `keys` the detail carries: its value when a finite
 * number, else null. A key that is present but null (a vertical the
 * server could not judge, R-09) is not replaced by a later alias.
 *
 * @beta
 */
export function detailNumber(d: Detail, ...keys: string[]): number | null {
  for (const k of keys) {
    if (!Object.hasOwn(d, k)) continue;
    const v = d[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  return null;
}

/**
 * The first of `keys` the detail carries, when a non-empty string.
 *
 * @beta
 */
export function detailString(d: Detail, ...keys: string[]): string | null {
  for (const k of keys) {
    if (!Object.hasOwn(d, k)) continue;
    const v = d[k];
    return typeof v === "string" && v.trim() !== "" ? v : null;
  }
  return null;
}

/**
 * `true` or `false` as sent; null when absent or not a boolean.
 *
 * @beta
 */
export function detailFlag(d: Detail, key: string): boolean | null {
  const v = Object.hasOwn(d, key) ? d[key] : undefined;
  return typeof v === "boolean" ? v : null;
}

/**
 * The strings of an array field; non-strings are left out.
 *
 * @beta
 */
export function detailStrings(d: Detail, key: string): string[] {
  const v = Object.hasOwn(d, key) ? d[key] : undefined;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x !== "");
}

/**
 * The other party of a `proximity` alert, as `detail.peer` names it.
 *
 * @beta
 */
export interface AlertPeer {
  trackId: string | null;
  trust: string | null;
}

/**
 * `detail.peer {track_id, trust}` (spec 04 §3.3); the alert's
 * `peerTrackId` when the detail names no id.
 *
 * @beta
 */
export function alertPeer(alert: AlertView): AlertPeer {
  const raw = Object.hasOwn(alert.detail, "peer")
    ? alert.detail["peer"]
    : undefined;
  const peer: Detail =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Detail)
      : {};
  return {
    trackId: detailString(peer, "track_id") ?? alert.peerTrackId,
    trust: detailString(peer, "trust"),
  };
}

const join = (t: Translate, text: string, note: string | null): string =>
  note === null ? text : t("alert.summary.note", { text, note });

const n = (v: number | null, lang: Lang): string =>
  fmtNum(v, 0, undefined, lang);

/**
 * The numbers of a kind that has numbers, from `prefix` + key (`""` for a
 * raise or update, `"clearing_"` for a clear); null for a kind without.
 */
function numbers(
  alert: AlertView,
  t: Translate,
  lang: Lang,
  prefix: "" | "clearing_",
): string | null {
  const d = alert.detail;
  const num = (...keys: string[]): string =>
    n(detailNumber(d, ...keys.map((k) => prefix + k)), lang);
  switch (alert.kind) {
    case "proximity":
      return t("alert.numbers.proximity", {
        d: num("d_cpa_h_m", "d_cpa_horizontal_m"),
        t: num("t_cpa_s"),
        v: num("d_alt_m", "d_alt_at_cpa_m"),
      });
    case "nonconformance":
      return t("alert.numbers.nonconformance", {
        d: num("distance_outside_m"),
        h: num("height_over_m"),
      });
    case "height_exceedance":
      return t("alert.numbers.height_exceedance", { h: num("height_over_m") });
    case "height_120m":
      return t("alert.numbers.height_120m", {
        a: num("height_agl_m"),
        h: num("height_over_m"),
      });
    case "lost_link":
      return t("alert.numbers.lost_link", { s: num("silence_s") });
    case "zone_incursion":
    case "nonconformance_nearby":
    case "restriction_activated":
    case "emergency_nearby":
    case "unregistered":
    case "no_authorisation":
    case "identification_mismatch":
    case "rid_absent":
      return null;
    default:
      alert.kind satisfies never;
      return null;
  }
}

/** The party caveat of R-05 for a peer that is not authenticated. */
function peerCaveat(t: Translate, peer: AlertPeer): string | null {
  const id = peer.trackId ?? DASH;
  switch (peer.trust) {
    case "broadcast":
      return t("alert.summary.peer_broadcast", { peer: id });
    case "provider":
      return t("alert.summary.peer_provider", { peer: id });
    default:
      return null;
  }
}

/** The zone notes of R-09 and Z-09, in the order the brief lists them. */
function zoneNotes(t: Translate, d: Detail): string[] {
  const notes: string[] = [];
  if (detailFlag(d, "limit_not_judged") === true) {
    const why = detailStrings(d, "not_judged");
    notes.push(
      why.length === 0
        ? t("alert.summary.limit_not_judged")
        : t("alert.summary.limit_not_judged_why", { reasons: why.join(", ") }),
    );
  }
  if (detailFlag(d, "vertical_known") === false)
    notes.push(t("alert.summary.vertical_unknown"));
  if (detailFlag(d, "within_band") === false)
    notes.push(t("alert.summary.within_band_widened"));
  return notes;
}

function zoneName(t: Translate, d: Detail): { zone: string; type: string } {
  const type = detailString(d, "zone_type");
  return {
    zone: detailString(d, "zone_id", "identifier") ?? DASH,
    type:
      type === null ? DASH : isZoneType(type) ? t(ZONE_TYPE_KEYS[type]) : type,
  };
}

/**
 * True for a kind this kit has words for.
 *
 * @beta
 */
export function isKnownKind(kind: string): kind is AlertView["kind"] {
  return Object.hasOwn(ALERT_SUMMARY_KEYS, kind);
}

/**
 * The name of a kind; a kind this kit does not know is shown as sent.
 *
 * @beta
 */
export function kindName(t: Translate, kind: string): string {
  return isKnownKind(kind) ? t(ALERT_KIND_KEYS[kind]) : kind;
}

/** The sentence of an active (raised or updated) alert. */
function activeSummary(alert: AlertView, t: Translate, lang: Lang): string {
  const d = alert.detail;
  const key = ALERT_SUMMARY_KEYS[alert.kind] as string;
  const nums = numbers(alert, t, lang, "") ?? "";
  switch (alert.kind) {
    case "proximity": {
      const peer = alertPeer(alert);
      return join(
        t,
        t(key, { peer: peer.trackId ?? DASH, numbers: nums }),
        peerCaveat(t, peer),
      );
    }
    case "nonconformance": {
      const reason = detailString(d, "reason");
      const known =
        reason !== null && Object.hasOwn(NONCONFORMANCE_REASON_KEYS, reason)
          ? t(NONCONFORMANCE_REASON_KEYS[reason] as string)
          : reason;
      return t(key, { reason: known ?? DASH, numbers: nums });
    }
    case "height_120m": {
      const terrain = detailString(d, "terrain_source");
      return join(
        t,
        t(key, { numbers: nums }),
        terrain === null ? null : t("alert.summary.terrain", { terrain }),
      );
    }
    case "zone_incursion":
      return zoneNotes(t, d).reduce(
        (text, note) => join(t, text, note),
        t(key, zoneName(t, d)),
      );
    case "restriction_activated": {
      const text = t(key, {
        restriction: detailString(d, "restriction_id") ?? DASH,
      });
      const withdrawn =
        detailFlag(d, "authorisation_withdrawn") === true ||
        detailFlag(d, "withdrawn") === true;
      if (withdrawn)
        return join(t, text, t("alert.summary.authorisation_withdrawn"));
      if (detailFlag(d, "authorisation_updated") === true)
        return join(t, text, t("alert.summary.authorisation_updated"));
      return text;
    }
    case "emergency_nearby": {
      const peer = alertPeer(alert);
      return join(t, t(key), peerCaveat(t, peer));
    }
    case "height_exceedance":
    case "lost_link":
      return t(key, { numbers: nums });
    case "nonconformance_nearby":
    case "unregistered":
    case "no_authorisation":
    case "identification_mismatch":
    case "rid_absent":
      return t(key);
    default:
      alert.kind satisfies never;
      // A kind this kit does not know (a newer server): shown as sent.
      return String(alert.kind);
  }
}

/** The sentence of a cleared alert: its reason and its own numbers (C-14). */
function clearedSummary(alert: AlertView, t: Translate, lang: Lang): string {
  const reason =
    alert.clearReason === null ? DASH : t(CLEAR_REASON_KEYS[alert.clearReason]);
  const nums =
    alert.kind === "zone_incursion"
      ? t("alert.numbers.zone", { zone: zoneName(t, alert.detail).zone })
      : numbers(alert, t, lang, "clearing_");
  return nums === null
    ? t("alert.summary.cleared", { reason })
    : t("alert.summary.cleared_numbers", { reason, numbers: nums });
}

/**
 * The one-line summary of `alert` in the language of `t`. Pure: the list
 * calls it with the provider's translator, so an app's catalogue applies.
 *
 * @beta
 */
export function alertSummary(
  alert: AlertView,
  t: Translate,
  lang: Lang,
): string {
  return alert.state === "cleared"
    ? clearedSummary(alert, t, lang)
    : activeSummary(alert, t, lang);
}

/** @public */
export interface AlertSummaryProps {
  alert: AlertView;
  lang: Lang;
  /** The app's catalogues, ahead of the kit's (as `I18nProvider`). */
  catalogues?: Catalogues;
}

/**
 * The one-line summary as a string (PLAN §3.13): usable as a function
 * (`AlertSummary({ alert, lang })`, for a notification or a title) and
 * as an element (`<AlertSummary alert={a} lang="ka" />`).
 *
 * @public
 */
export function AlertSummary(props: AlertSummaryProps): string {
  const { alert, lang, catalogues } = props;
  return alertSummary(alert, createTranslator(lang, catalogues), lang);
}
