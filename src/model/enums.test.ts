// Pins every enumeration of src/model to the lists of docs/PLAN.md §3.1.
// The expected lists below are a copy of the plan text, so a silent edit of
// either side fails here. Do not "fix" a failure by editing this file: read
// the plan, the spec row and uspace-core, then decide which side is wrong.
import { describe, expect, expectTypeOf, it } from "vitest";

import * as model from "./index.js";
import type {
  AlertKind,
  AlertState,
  AltSource,
  ClearReason,
  DisabledBy,
  IdentBasis,
  IdentReason,
  IdentStatus,
  RestrictionState,
  Severity,
  SourceState,
  TimeSource,
  Trust,
  VerticalRef,
  ViolationKind,
  ZoneType,
} from "./index.js";

// docs/PLAN.md §3.1, copied by hand from the plan text.
const PLAN = {
  VERTICAL_REFS: ["AGL", "AMSL", "WGS84"],
  ALT_SOURCES: ["geodetic", "pressure", "network", "none"],
  TRUSTS: [
    "authenticated",
    "provider",
    "surveillance",
    "broadcast",
    "sensor",
    "simulated",
  ],
  SEVERITIES: ["info", "warning", "critical"],
  ZONE_TYPES: [
    "PROHIBITED",
    "REQ_AUTHORIZATION",
    "CONDITIONAL",
    "NO_RESTRICTION",
    "USPACE",
  ],
  IDENT_STATUSES: [
    "registered",
    "suspended",
    "unknown_operator",
    "unidentified",
  ],
  IDENT_REASONS: [
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
  ],
  IDENT_BASES: ["authenticated", "as_broadcast", "provider"],
  TIME_SOURCES: ["source_clock", "broadcast", "receiver", "provider", "system"],
  ALERT_KINDS: [
    "proximity",
    "nonconformance",
    "nonconformance_nearby",
    "height_exceedance",
    "zone_incursion",
    "lost_link",
    "restriction_activated",
    "emergency_nearby",
  ],
  VIOLATION_KINDS: [
    "height_120m",
    "zone_incursion",
    "unregistered",
    "no_authorisation",
    "identification_mismatch",
    "rid_absent",
  ],
  ALERT_STATES: ["raised", "updated", "cleared"],
  CLEAR_REASONS: [
    "resolved",
    "stale",
    "source_disabled",
    "flight_ended",
    "acknowledged_timeout",
    "landed",
  ],
  RESTRICTION_STATES: ["planned", "active", "ended", "cancelled"],
  SOURCE_STATES: [
    "disabled",
    "healthy",
    "stale",
    "lagging",
    "unreachable",
    "never_heard",
  ],
  DISABLED_BYS: ["type", "instance", "default_deny"],
} as const;

type ArrayName = keyof typeof PLAN;

const GUARDS: Record<ArrayName, (x: unknown) => boolean> = {
  VERTICAL_REFS: model.isVerticalRef,
  ALT_SOURCES: model.isAltSource,
  TRUSTS: model.isTrust,
  SEVERITIES: model.isSeverity,
  ZONE_TYPES: model.isZoneType,
  IDENT_STATUSES: model.isIdentStatus,
  IDENT_REASONS: model.isIdentReason,
  IDENT_BASES: model.isIdentBasis,
  TIME_SOURCES: model.isTimeSource,
  ALERT_KINDS: model.isAlertKind,
  VIOLATION_KINDS: model.isViolationKind,
  ALERT_STATES: model.isAlertState,
  CLEAR_REASONS: model.isClearReason,
  RESTRICTION_STATES: model.isRestrictionState,
  SOURCE_STATES: model.isSourceState,
  DISABLED_BYS: model.isDisabledBy,
};

const NAMES = Object.keys(PLAN) as ArrayName[];

describe("model enumerations", () => {
  it("exports exactly the enumerations of the plan", () => {
    const exported = Object.keys(model).filter((k) => /^[A-Z_]+$/.test(k));
    expect(exported.sort()).toEqual([...NAMES].sort());
  });

  it.each(NAMES)("%s matches docs/PLAN.md §3.1 in order", (name) => {
    expect(model[name]).toEqual(PLAN[name]);
  });

  it.each(NAMES)("%s has no duplicates", (name) => {
    const values: readonly string[] = model[name];
    expect(new Set(values).size).toBe(values.length);
  });

  it.each(NAMES)("%s guard accepts every member", (name) => {
    for (const v of PLAN[name]) expect(GUARDS[name](v)).toBe(true);
  });

  it.each(NAMES)(
    "%s guard refuses a near miss, another type and nothing",
    (name) => {
      const guard = GUARDS[name];
      const first = PLAN[name][0];
      expect(guard(`${first} `)).toBe(false);
      expect(
        guard(
          first.toUpperCase() === first
            ? first.toLowerCase()
            : first.toUpperCase(),
        ),
      ).toBe(false);
      expect(guard(0)).toBe(false);
      expect(guard(null)).toBe(false);
      expect(guard(undefined)).toBe(false);
    },
  );

  it("is frozen at the type level as the plan's unions", () => {
    // Each union equals the plan's union exactly: a member in the plan but
    // not in the array, or the other way round, is a compile error under
    // `tsc --noEmit` (pnpm check).
    expectTypeOf<VerticalRef>().toEqualTypeOf<"AGL" | "AMSL" | "WGS84">();
    expectTypeOf<AltSource>().toEqualTypeOf<
      "geodetic" | "pressure" | "network" | "none"
    >();
    expectTypeOf<Trust>().toEqualTypeOf<
      | "authenticated"
      | "provider"
      | "surveillance"
      | "broadcast"
      | "sensor"
      | "simulated"
    >();
    expectTypeOf<Severity>().toEqualTypeOf<"info" | "warning" | "critical">();
    expectTypeOf<ZoneType>().toEqualTypeOf<
      | "PROHIBITED"
      | "REQ_AUTHORIZATION"
      | "CONDITIONAL"
      | "NO_RESTRICTION"
      | "USPACE"
    >();
    expectTypeOf<IdentStatus>().toEqualTypeOf<
      "registered" | "suspended" | "unknown_operator" | "unidentified"
    >();
    expectTypeOf<IdentReason>().toEqualTypeOf<
      | "matched"
      | "session_binding"
      | "uas_suspended"
      | "uas_revoked"
      | "operator_suspended"
      | "operator_revoked"
      | "serial_unknown"
      | "not_a_serial"
      | "operator_absent"
      | "operator_mismatch"
      | "owner_unknown"
      | "not_in_registry"
      | "serial_conflict"
      | "no_serial"
      | "registry_unavailable"
    >();
    expectTypeOf<IdentBasis>().toEqualTypeOf<
      "authenticated" | "as_broadcast" | "provider"
    >();
    expectTypeOf<TimeSource>().toEqualTypeOf<
      "source_clock" | "broadcast" | "receiver" | "provider" | "system"
    >();
    expectTypeOf<AlertKind>().toEqualTypeOf<
      | "proximity"
      | "nonconformance"
      | "nonconformance_nearby"
      | "height_exceedance"
      | "zone_incursion"
      | "lost_link"
      | "restriction_activated"
      | "emergency_nearby"
    >();
    expectTypeOf<ViolationKind>().toEqualTypeOf<
      | "height_120m"
      | "zone_incursion"
      | "unregistered"
      | "no_authorisation"
      | "identification_mismatch"
      | "rid_absent"
    >();
    expectTypeOf<AlertState>().toEqualTypeOf<
      "raised" | "updated" | "cleared"
    >();
    expectTypeOf<ClearReason>().toEqualTypeOf<
      | "resolved"
      | "stale"
      | "source_disabled"
      | "flight_ended"
      | "acknowledged_timeout"
      | "landed"
    >();
    expectTypeOf<RestrictionState>().toEqualTypeOf<
      "planned" | "active" | "ended" | "cancelled"
    >();
    expectTypeOf<SourceState>().toEqualTypeOf<
      | "disabled"
      | "healthy"
      | "stale"
      | "lagging"
      | "unreachable"
      | "never_heard"
    >();
    expectTypeOf<DisabledBy>().toEqualTypeOf<
      "type" | "instance" | "default_deny"
    >();

    // Every union member is in its array and every array member in its
    // union: the plan's list `satisfies` the union, and the exported array
    // `satisfies` the plan's list.
    PLAN.VERTICAL_REFS satisfies readonly VerticalRef[];
    model.VERTICAL_REFS satisfies readonly (typeof PLAN.VERTICAL_REFS)[number][];
    PLAN.ALT_SOURCES satisfies readonly AltSource[];
    model.ALT_SOURCES satisfies readonly (typeof PLAN.ALT_SOURCES)[number][];
    PLAN.TRUSTS satisfies readonly Trust[];
    model.TRUSTS satisfies readonly (typeof PLAN.TRUSTS)[number][];
    PLAN.SEVERITIES satisfies readonly Severity[];
    model.SEVERITIES satisfies readonly (typeof PLAN.SEVERITIES)[number][];
    PLAN.ZONE_TYPES satisfies readonly ZoneType[];
    model.ZONE_TYPES satisfies readonly (typeof PLAN.ZONE_TYPES)[number][];
    PLAN.IDENT_STATUSES satisfies readonly IdentStatus[];
    model.IDENT_STATUSES satisfies readonly (typeof PLAN.IDENT_STATUSES)[number][];
    PLAN.IDENT_REASONS satisfies readonly IdentReason[];
    model.IDENT_REASONS satisfies readonly (typeof PLAN.IDENT_REASONS)[number][];
    PLAN.IDENT_BASES satisfies readonly IdentBasis[];
    model.IDENT_BASES satisfies readonly (typeof PLAN.IDENT_BASES)[number][];
    PLAN.TIME_SOURCES satisfies readonly TimeSource[];
    model.TIME_SOURCES satisfies readonly (typeof PLAN.TIME_SOURCES)[number][];
    PLAN.ALERT_KINDS satisfies readonly AlertKind[];
    model.ALERT_KINDS satisfies readonly (typeof PLAN.ALERT_KINDS)[number][];
    PLAN.VIOLATION_KINDS satisfies readonly ViolationKind[];
    model.VIOLATION_KINDS satisfies readonly (typeof PLAN.VIOLATION_KINDS)[number][];
    PLAN.ALERT_STATES satisfies readonly AlertState[];
    model.ALERT_STATES satisfies readonly (typeof PLAN.ALERT_STATES)[number][];
    PLAN.CLEAR_REASONS satisfies readonly ClearReason[];
    model.CLEAR_REASONS satisfies readonly (typeof PLAN.CLEAR_REASONS)[number][];
    PLAN.RESTRICTION_STATES satisfies readonly RestrictionState[];
    model.RESTRICTION_STATES satisfies readonly (typeof PLAN.RESTRICTION_STATES)[number][];
    PLAN.SOURCE_STATES satisfies readonly SourceState[];
    model.SOURCE_STATES satisfies readonly (typeof PLAN.SOURCE_STATES)[number][];
    PLAN.DISABLED_BYS satisfies readonly DisabledBy[];
    model.DISABLED_BYS satisfies readonly (typeof PLAN.DISABLED_BYS)[number][];
  });
});
