// The catalogue keys of the alert enumerations (docs/PLAN.md §3.13,
// WP-11): one name per alert and violation kind, per state and per clear
// reason. Typed `Key`, so the compiler checks that each exists; the
// catalogue test lists them as the dynamic keys of the alert components.
import type { Key } from "../i18n/en.js";
import type {
  AlertKind,
  AlertState,
  ClearReason,
  ViolationKind,
} from "../model/index.js";

/** The name of each alert and violation kind (`zone_incursion` is both). */
export const ALERT_KIND_KEYS: Readonly<Record<AlertKind | ViolationKind, Key>> =
  Object.freeze({
    proximity: "alert.kind.proximity",
    nonconformance: "alert.kind.nonconformance",
    nonconformance_nearby: "alert.kind.nonconformance_nearby",
    height_exceedance: "alert.kind.height_exceedance",
    zone_incursion: "alert.kind.zone_incursion",
    lost_link: "alert.kind.lost_link",
    restriction_activated: "alert.kind.restriction_activated",
    emergency_nearby: "alert.kind.emergency_nearby",
    height_120m: "alert.kind.height_120m",
    unregistered: "alert.kind.unregistered",
    no_authorisation: "alert.kind.no_authorisation",
    identification_mismatch: "alert.kind.identification_mismatch",
    rid_absent: "alert.kind.rid_absent",
  });

export const ALERT_STATE_KEYS: Readonly<Record<AlertState, Key>> =
  Object.freeze({
    raised: "alert.state.raised",
    updated: "alert.state.updated",
    cleared: "alert.state.cleared",
  });

export const CLEAR_REASON_KEYS: Readonly<Record<ClearReason, Key>> =
  Object.freeze({
    resolved: "alert.clear_reason.resolved",
    stale: "alert.clear_reason.stale",
    source_disabled: "alert.clear_reason.source_disabled",
    flight_ended: "alert.clear_reason.flight_ended",
    acknowledged_timeout: "alert.clear_reason.acknowledged_timeout",
    landed: "alert.clear_reason.landed",
  });

/**
 * The `nonconformance` reasons spec 04 §3.3 names. Any other value the
 * API sends is shown as sent, never mapped to one of these.
 */
export const NONCONFORMANCE_REASON_KEYS: Readonly<Record<string, Key>> =
  Object.freeze({
    threshold_exceeded: "alert.reason.threshold_exceeded",
    constraint_breached: "alert.reason.constraint_breached",
  });

/** The one-line summary of each kind (summary.ts). */
export const ALERT_SUMMARY_KEYS: Readonly<
  Record<AlertKind | ViolationKind, Key>
> = Object.freeze({
  proximity: "alert.summary.proximity",
  nonconformance: "alert.summary.nonconformance",
  nonconformance_nearby: "alert.summary.nonconformance_nearby",
  height_exceedance: "alert.summary.height_exceedance",
  zone_incursion: "alert.summary.zone_incursion",
  lost_link: "alert.summary.lost_link",
  restriction_activated: "alert.summary.restriction_activated",
  emergency_nearby: "alert.summary.emergency_nearby",
  height_120m: "alert.summary.height_120m",
  unregistered: "alert.summary.unregistered",
  no_authorisation: "alert.summary.no_authorisation",
  identification_mismatch: "alert.summary.identification_mismatch",
  rid_absent: "alert.summary.rid_absent",
});
