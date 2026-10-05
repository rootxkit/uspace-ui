// Deterministic, synthetic view models for unit and browser tests (PLAN §3.18).
//
// Generated from the `model` arrays: each enumeration is cycled through the
// records, so a value added to `model` appears in the fixtures without an
// edit here, and test/fixtures.test.ts checks that it did. Registration
// numbers are GEO-TEST-*, serials and callsigns TEST* (spec 06 §4: no real
// data). WP-14 adds the lab-derived set beside it: fixtures({ source:
// "lab" }) (labFixtures.ts).
//
// The coordinates are display-only sample positions; nothing here is a
// threshold or a judgement.
import type * as GeoJSON from "geojson";

import {
  ALERT_KINDS,
  ALERT_STATES,
  ALT_SOURCES,
  CLEAR_REASONS,
  DISABLED_BYS,
  IDENT_BASES,
  IDENT_REASONS,
  IDENT_STATUSES,
  RESTRICTION_STATES,
  SEVERITIES,
  SOURCE_STATES,
  TIME_SOURCES,
  TRUSTS,
  VERTICAL_REFS,
  VIOLATION_KINDS,
  ZONE_TYPES,
} from "../model/enums.js";
import { labFixtures } from "./labFixtures.js";
import type {
  AlertView,
  FeedStatus,
  MannedView,
  SourceView,
  Times,
  TrackView,
  ZoneView,
} from "../model/types.js";

/** @public */
export interface Fixtures {
  tracks: TrackView[];
  zones: ZoneView[];
  alerts: AlertView[];
  manned: MannedView[];
  sources: SourceView[];
  status: FeedStatus;
}

// Fixed clock of the fixtures: 2026-01-01T12:00:00Z.
const BASE_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const iso = (offsetS: number): string =>
  new Date(BASE_MS + offsetS * 1000).toISOString();
const pad = (n: number): string => String(n).padStart(4, "0");

function pick<T>(values: readonly T[], i: number): T {
  const v = values[i % values.length];
  if (v === undefined) throw new Error("fixtures: empty enumeration");
  return v;
}

function times(i: number): Times {
  return {
    ts: i % 4 === 3 ? null : iso(-i - 1),
    rxTs: iso(-i),
    capturedAt: iso(-i),
    timeSource: pick(TIME_SOURCES, i),
    backlog: i % 5 === 4,
  };
}

function tracks(): TrackView[] {
  // One more record than the longest enumeration: the last one has no
  // identification at all (null, not "unidentified").
  const n =
    1 +
    Math.max(
      TRUSTS.length,
      ALT_SOURCES.length,
      TIME_SOURCES.length,
      IDENT_STATUSES.length,
      IDENT_REASONS.length,
      IDENT_BASES.length,
    );
  const out: TrackView[] = [];
  for (let i = 0; i < n; i++) {
    const mismatch = i % 7 === 6;
    out.push({
      trackId: `TEST-TRK-${pad(i + 1)}`,
      trust: pick(TRUSTS, i),
      source: "test_source",
      sourceInstance: `test-${(i % 2) + 1}`,
      lat: 41.7 + i * 0.002,
      lng: 44.8 + i * 0.003,
      altAmslM: i % 6 === 5 ? null : 500 + i * 10,
      altWgs84M: i % 6 === 5 ? null : 520 + i * 10,
      altSource: pick(ALT_SOURCES, i),
      heightM: i % 3 === 2 ? null : 30 + i * 5,
      heightRef:
        i % 3 === 0 ? "TakeoffLocation" : i % 3 === 1 ? "GroundLevel" : null,
      speedMs: i % 4 === 3 ? null : 5 + i,
      trackDeg: i % 4 === 3 ? null : (i * 37) % 360,
      vspeedMs: i % 4 === 3 ? null : (i % 3) - 1,
      status: i % 4 === 3 ? null : "Airborne",
      emergency: i % 8 === 7,
      identification:
        i === n - 1
          ? null
          : {
              status: pick(IDENT_STATUSES, i),
              reason: pick(IDENT_REASONS, i),
              serial: i % 5 === 4 ? null : `TEST-SN-${pad(i + 1)}`,
              operatorReg: i % 5 === 3 ? null : `GEO-TEST-OP-${pad(i + 1)}`,
              registeredOperatorReg: mismatch
                ? `GEO-TEST-OP-${pad(i + 101)}`
                : null,
              mismatch,
              basis: pick(IDENT_BASES, i),
            },
      flightId: i % 2 === 0 ? `TEST-FLT-${pad(i + 1)}` : null,
      intentId: i % 3 === 0 ? `TEST-INT-${pad(i + 1)}` : null,
      times: times(i),
      receivedAtMs: BASE_MS - i * 1000,
    });
  }
  return out;
}

function square(lng: number, lat: number, d: number): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + d, lat],
        [lng + d, lat + d],
        [lng, lat + d],
        [lng, lat],
      ],
    ],
  };
}

function zones(): ZoneView[] {
  const states = [...RESTRICTION_STATES, null] as const;
  const applies = [true, false, null] as const;
  const n = Math.max(
    ZONE_TYPES.length,
    VERTICAL_REFS.length,
    states.length,
    applies.length,
  );
  const out: ZoneView[] = [];
  for (let i = 0; i < n; i++) {
    const restrictionState = pick(states, i);
    out.push({
      identifier: `GEO-TEST-ZONE-${pad(i + 1)}`,
      name: i % 4 === 3 ? null : `Test zone ${i + 1}`,
      type: pick(ZONE_TYPES, i),
      variant: i % 2 === 0 ? "COMMON" : null,
      reason: restrictionState === null ? ["OTHER"] : ["DAR"],
      message: i % 3 === 0 ? `Test message ${i + 1}` : null,
      lowerLimitM: i % 5 === 4 ? null : 0,
      lowerRef: i % 5 === 4 ? null : pick(VERTICAL_REFS, i),
      upperLimitM: i % 5 === 4 ? null : 120 + i * 30,
      upperRef: i % 5 === 4 ? null : pick(VERTICAL_REFS, i + 1),
      geometry: square(44.75 + i * 0.02, 41.68 + i * 0.01, 0.01),
      applies: pick(applies, i),
      restrictionState,
      version: `test-v${i + 1}`,
      updatedAt: i % 4 === 3 ? null : iso(-3600 - i),
    });
  }
  return out;
}

function alerts(trackIds: readonly string[]): AlertView[] {
  const kinds = [...ALERT_KINDS, ...VIOLATION_KINDS];
  const out: AlertView[] = [];
  const add = (
    kind: AlertView["kind"],
    state: AlertView["state"],
    clearReason: AlertView["clearReason"],
  ): void => {
    const i = out.length;
    out.push({
      alertId: `TEST-ALR-${pad(i + 1)}`,
      kind,
      severity: pick(SEVERITIES, i),
      state,
      clearReason,
      aircraft: [pick(trackIds, i)],
      peerTrackId: kind === "proximity" ? pick(trackIds, i + 1) : null,
      detail: {},
      capturedAt: iso(-i),
      raisedAt: iso(-i - 30),
      policyVersion: "test-policy-1",
      acknowledged: i % 4 === 1,
      receivedAtMs: BASE_MS - i * 1000,
    });
  };
  // Every kind open (raised or updated), then one clear per clear reason.
  const open = ALERT_STATES.filter((s) => s !== "cleared");
  kinds.forEach((kind, i) => {
    add(kind, pick(open, i), null);
  });
  CLEAR_REASONS.forEach((reason, i) => {
    add(pick(kinds, i), "cleared", reason);
  });
  return out;
}

function manned(): MannedView[] {
  return [0, 1].map((i) => ({
    trackId: `TEST-MAN-${pad(i + 1)}`,
    icao24: i === 0 ? "TEST01" : null,
    callsign: i === 0 ? "TEST101" : null,
    lat: 41.66 + i * 0.05,
    lng: 44.9 + i * 0.05,
    altPressureM: i === 0 ? 1500 : null,
    altWgs84M: i === 0 ? 1550 : null,
    gsMs: i === 0 ? 70 : null,
    trackDeg: i === 0 ? 270 : null,
    vrateMs: i === 0 ? -2 : null,
    sourceClass: "surveillance",
    emergency: i === 1,
    times: times(i),
    receivedAtMs: BASE_MS - i * 1000,
  }));
}

function sources(): SourceView[] {
  const out: SourceView[] = [];
  const add = (
    state: SourceView["state"],
    disabledBy: SourceView["disabledBy"],
  ): void => {
    const i = out.length;
    out.push({
      sourceType: `test_source_${(i % 3) + 1}`,
      instanceId: i % 2 === 0 ? `test-${i + 1}` : null,
      state,
      disabledBy,
      disabledByWho: disabledBy === null ? null : `TEST-USER-${pad(i + 1)}`,
      lastSeenAt: state === "never_heard" ? null : iso(-i * 10),
      lagS: state === "lagging" ? 12 : null,
      accepted: state === "never_heard" ? 0 : 1000 + i,
      refused: i % 3,
    });
  };
  // One source per state; `disabled` once per way of being disabled.
  for (const state of SOURCE_STATES) {
    if (state === "disabled") for (const by of DISABLED_BYS) add(state, by);
    else add(state, null);
  }
  return out;
}

/**
 * Which set `fixtures` builds (WP-14).
 *
 * @public
 */
export interface FixturesOptions {
  /**
   * `synthetic` (default): generated from the `model` arrays, every
   * enumeration value at least once. `lab`: the lab's schema examples at
   * the pinned commits, decoded through the reference adapters
   * (`labFixtures`, src/test/fixtures/VERSION).
   */
  source?: "synthetic" | "lab";
}

/**
 * The fixtures: synthetic by default, covering every enumeration value at
 * least once; the lab-derived set with `{ source: "lab" }`.
 *
 * @public
 */
export function fixtures(opts: FixturesOptions = {}): Fixtures {
  if (opts.source === "lab") return labFixtures();
  const t = tracks();
  return {
    tracks: t,
    zones: zones(),
    alerts: alerts(t.map((x) => x.trackId)),
    manned: manned(),
    sources: sources(),
    status: {
      connection: "live",
      sinceMs: BASE_MS - 60_000,
      droppedFrames: 0,
      degraded: [],
      policyVersion: "test-policy-1",
      staleAfterS: null,
      liveMaxAgeS: null,
      serverTs: iso(0),
    },
  };
}
