// The view-model enumerations of docs/PLAN.md §3.1, frozen in WP-0.
//
// Each enumeration is a readonly array and the union type derived from it,
// so an exhaustive switch in `symbology` and the iteration of a legend use
// one source. The string values mirror uspace-core/core at the tag in
// docs/CORE_VERSION (read from the Go source, not typed from memory;
// checked by scripts/check-enums.sh) and the spec text where core has no
// constant (04 §3.3 alert and violation kinds, states and clear reasons;
// 02 F2 restriction states). A wrong value here makes a status invisible on
// every console: fix a mismatch by reading the source, never by editing the
// test.

// core/vertical.go VerticalRef
export const VERTICAL_REFS = ["AGL", "AMSL", "WGS84"] as const;
export type VerticalRef = (typeof VERTICAL_REFS)[number];

// core/vertical.go AltSource
export const ALT_SOURCES = ["geodetic", "pressure", "network", "none"] as const;
export type AltSource = (typeof ALT_SOURCES)[number];

// core/enums.go Trust
export const TRUSTS = [
  "authenticated",
  "provider",
  "surveillance",
  "broadcast",
  "sensor",
  "simulated",
] as const;
export type Trust = (typeof TRUSTS)[number];

// core/enums.go Severity
export const SEVERITIES = ["info", "warning", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

// core/enums.go ZoneType; ED-318 spelling (00 §5)
export const ZONE_TYPES = [
  "PROHIBITED",
  "REQ_AUTHORIZATION",
  "CONDITIONAL",
  "NO_RESTRICTION",
  "USPACE",
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

// core/ident.go IdentStatus
export const IDENT_STATUSES = [
  "registered",
  "suspended",
  "unknown_operator",
  "unidentified",
] as const;
export type IdentStatus = (typeof IDENT_STATUSES)[number];

// core/ident.go IdentReason
export const IDENT_REASONS = [
  "matched",
  "session_binding",
  "uas_suspended",
  "uas_revoked",
  "operator_suspended",
  "operator_revoked",
  "serial_unknown",
  "not_a_serial",
  "operator_absent",
  "operator_mismatch",
  "owner_unknown",
  "not_in_registry",
  "serial_conflict",
  "no_serial",
  "registry_unavailable",
] as const;
export type IdentReason = (typeof IDENT_REASONS)[number];

// core/ident.go IdentBasis. `provider` = a Display Provider peer's claim,
// neither authenticated nor broadcast (core v1.1.0 `BasisProvider`,
// reconciliation Q-A8, PLAN §14 Q18); carried ahead of core and listed as
// a skip in docs/CORE_VERSION until the pinned tag has it. Rendered with
// its own caveat, never as `authenticated`.
export const IDENT_BASES = [
  "authenticated",
  "as_broadcast",
  "provider",
] as const;
export type IdentBasis = (typeof IDENT_BASES)[number];

// core/time.go TimeSource
export const TIME_SOURCES = [
  "source_clock",
  "broadcast",
  "receiver",
  "provider",
  "system",
] as const;
export type TimeSource = (typeof TIME_SOURCES)[number];

// spec 04 §3.3 alert/v1 kinds
export const ALERT_KINDS = [
  "proximity",
  "nonconformance",
  "nonconformance_nearby",
  "height_exceedance",
  "zone_incursion",
  "lost_link",
  "restriction_activated",
  "emergency_nearby",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

// spec 04 §3.3 violation/v1 kinds
export const VIOLATION_KINDS = [
  "height_120m",
  "zone_incursion",
  "unregistered",
  "no_authorisation",
  "identification_mismatch",
  "rid_absent",
] as const;
export type ViolationKind = (typeof VIOLATION_KINDS)[number];

// spec 04 §3.3 alert/v1 state
export const ALERT_STATES = ["raised", "updated", "cleared"] as const;
export type AlertState = (typeof ALERT_STATES)[number];

// spec 04 §3.3 clear_reason plus `landed` (LESSONS C-14, decided in
// uspace-core)
export const CLEAR_REASONS = [
  "resolved",
  "stale",
  "source_disabled",
  "flight_ended",
  "acknowledged_timeout",
  "landed",
] as const;
export type ClearReason = (typeof CLEAR_REASONS)[number];

// spec 02 F2 restriction states
export const RESTRICTION_STATES = [
  "planned",
  "active",
  "ended",
  "cancelled",
] as const;
export type RestrictionState = (typeof RESTRICTION_STATES)[number];

// LESSONS B-03, B-04, B-11 wording; `disabled` wins over every other state
export const SOURCE_STATES = [
  "disabled",
  "healthy",
  "stale",
  "lagging",
  "unreachable",
  "never_heard",
] as const;
export type SourceState = (typeof SOURCE_STATES)[number];

export const DISABLED_BYS = ["type", "instance", "default_deny"] as const;
export type DisabledBy = (typeof DISABLED_BYS)[number];

// Type guards, generated from the arrays so a guard cannot drift from its
// enumeration. They are the only functions in `model`.
function guard<T extends string>(values: readonly T[]): (x: unknown) => x is T {
  const set: ReadonlySet<string> = new Set(values);
  return (x: unknown): x is T => typeof x === "string" && set.has(x);
}

export const isVerticalRef = guard(VERTICAL_REFS);
export const isAltSource = guard(ALT_SOURCES);
export const isTrust = guard(TRUSTS);
export const isSeverity = guard(SEVERITIES);
export const isZoneType = guard(ZONE_TYPES);
export const isIdentStatus = guard(IDENT_STATUSES);
export const isIdentReason = guard(IDENT_REASONS);
export const isIdentBasis = guard(IDENT_BASES);
export const isTimeSource = guard(TIME_SOURCES);
export const isAlertKind = guard(ALERT_KINDS);
export const isViolationKind = guard(VIOLATION_KINDS);
export const isAlertState = guard(ALERT_STATES);
export const isClearReason = guard(CLEAR_REASONS);
export const isRestrictionState = guard(RESTRICTION_STATES);
export const isSourceState = guard(SOURCE_STATES);
export const isDisabledBy = guard(DISABLED_BYS);
