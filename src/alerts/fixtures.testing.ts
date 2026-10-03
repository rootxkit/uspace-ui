// Test alerts and tracks for the alert tests (WP-11). Synthetic: TEST-*
// ids, GEO-TEST registrations (spec 06 §4). Every number in a detail is a
// value the server would send; none is computed here.
import {
  ALERT_KINDS,
  VIOLATION_KINDS,
  type AlertKind,
  type AlertView,
  type TrackView,
  type ViolationKind,
} from "../model/index.js";

/** The tests' clock: 2026-10-02T09:15:06Z. */
export const NOW_MS = Date.UTC(2026, 9, 2, 9, 15, 6);

/**
 * The repeat period the tests pass as the server's policy value (02 F5:
 * "unacknowledged critical alerts repeat every 10 s" is the server's
 * number, not a default of the kit).
 */
export const SERVER_REPEAT_MS = 10_000;

/** Every alert and violation kind once (`zone_incursion` is both). */
export const EVERY_KIND: readonly (AlertKind | ViolationKind)[] = [
  ...new Set([...ALERT_KINDS, ...VIOLATION_KINDS]),
];

/** A detail per kind with every field spec 04 §3.3 names for it. */
export const DETAIL: Readonly<
  Record<AlertKind | ViolationKind, Record<string, unknown>>
> = {
  proximity: {
    t_cpa_s: 42,
    d_cpa_h_m: 120,
    d_alt_m: 15,
    peer: { track_id: "TEST-TRK-0002", trust: "authenticated" },
  },
  nonconformance: {
    reason: "threshold_exceeded",
    distance_outside_m: 64,
    height_over_m: 12,
  },
  nonconformance_nearby: {},
  height_exceedance: { height_over_m: 18 },
  zone_incursion: {
    zone_id: "GEO-TEST-ZONE-0001",
    zone_type: "PROHIBITED",
    vertical_known: true,
    within_band: true,
  },
  lost_link: { silence_s: 17 },
  restriction_activated: {
    restriction_id: "GEO-TEST-DAR-0001",
    authorisation_updated: true,
  },
  emergency_nearby: {},
  height_120m: { height_agl_m: 134, height_over_m: 14 },
  unregistered: {},
  no_authorisation: {},
  identification_mismatch: {},
  rid_absent: {},
};

/** The clear's own numbers (C-14), different from the raise's above. */
export const CLEARING: Readonly<
  Record<AlertKind | ViolationKind, Record<string, unknown>>
> = {
  proximity: {
    clearing_t_cpa_s: 0,
    clearing_d_cpa_h_m: 940,
    clearing_d_alt_m: 70,
  },
  nonconformance: {
    clearing_distance_outside_m: 3,
    clearing_height_over_m: 1,
  },
  nonconformance_nearby: {},
  height_exceedance: { clearing_height_over_m: 2 },
  zone_incursion: {},
  lost_link: { clearing_silence_s: 19 },
  restriction_activated: {},
  emergency_nearby: {},
  height_120m: { clearing_height_agl_m: 118, clearing_height_over_m: 0 },
  unregistered: {},
  no_authorisation: {},
  identification_mismatch: {},
  rid_absent: {},
};

export function alert(over: Partial<AlertView> = {}): AlertView {
  const kind = over.kind ?? "proximity";
  return {
    alertId: "TEST-ALR-0001",
    kind,
    severity: "critical",
    state: "raised",
    clearReason: null,
    aircraft: ["TEST-TRK-0001"],
    peerTrackId: kind === "proximity" ? "TEST-TRK-0002" : null,
    detail: DETAIL[kind],
    capturedAt: "2026-10-02T09:15:03.214Z",
    raisedAt: "2026-10-02T09:15:00.000Z",
    policyVersion: "test-policy-1",
    acknowledged: false,
    receivedAtMs: NOW_MS - 2000,
    ...over,
  };
}

/** The cleared form of a kind's alert, with the clear's own numbers. */
export function cleared(
  kind: AlertKind | ViolationKind,
  over: Partial<AlertView> = {},
): AlertView {
  return alert({
    kind,
    state: "cleared",
    clearReason: "resolved",
    detail: { ...DETAIL[kind], ...CLEARING[kind] },
    ...over,
  });
}

export function track(over: Partial<TrackView> = {}): TrackView {
  return {
    trackId: "TEST-TRK-0001",
    trust: "authenticated",
    source: "operator_ws",
    sourceInstance: "test-1",
    lat: 41.7,
    lng: 44.8,
    altAmslM: 550,
    altWgs84M: 570,
    altSource: "geodetic",
    heightM: 40,
    heightRef: "TakeoffLocation",
    speedMs: 8,
    trackDeg: 90,
    vspeedMs: 0,
    status: "Airborne",
    emergency: false,
    identification: null,
    flightId: null,
    intentId: null,
    times: {
      ts: "2026-10-02T09:15:05.900Z",
      rxTs: "2026-10-02T09:15:06.000Z",
      capturedAt: "2026-10-02T09:15:06.000Z",
      timeSource: "source_clock",
      backlog: false,
    },
    receivedAtMs: NOW_MS,
    ...over,
  };
}
