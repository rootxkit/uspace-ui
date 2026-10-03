// Test data for the WP-12 traffic layers and the detail (not part of the
// package): manned tracks, intents with their volumes as the API derived
// them, receivers and unmanned tracks. Every identity is a test value
// (spec 06 §4: GEO-TEST-* registrations, TEST* serials and addresses);
// positions are display-only sample points over the committed Tbilisi
// extract (44.77..44.83 E, 41.68..41.73 N).
import type * as GeoJSON from "geojson";

import type { TrackView } from "../model/index.js";
import type { MannedTrack } from "../symbology/manned.js";
import type { IntentInput } from "./IntentLayer.js";
import type { ReceiverInput } from "./ReceiverLayer.js";

/** The tests' clock: 2026-01-01T12:00:00Z. */
export const TRAFFIC_NOW_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
/** The policy value the tests pass as the feed's `stale_after_s`. */
export const TRAFFIC_STALE_AFTER_S = 30;

const iso = (ms: number): string => new Date(ms).toISOString();

export function mannedTrack(over: Partial<MannedTrack> = {}): MannedTrack {
  const receivedAtMs = over.receivedAtMs ?? TRAFFIC_NOW_MS - 1000;
  return {
    trackId: "TEST-MAN-0001",
    icao24: "4c0001",
    callsign: "TEST001",
    lat: 41.705,
    lng: 44.79,
    altPressureM: 914,
    altWgs84M: 962,
    gsMs: 61.7,
    trackDeg: 135,
    vrateMs: -2.5,
    sourceClass: "atm_feed",
    emergency: false,
    trust: "surveillance",
    times: {
      ts: iso(receivedAtMs - 300),
      rxTs: iso(receivedAtMs),
      capturedAt: iso(receivedAtMs - 300),
      timeSource: "source_clock",
      backlog: false,
    },
    receivedAtMs,
    ...over,
  };
}

export function uasTrack(over: Partial<TrackView> = {}): TrackView {
  const receivedAtMs = over.receivedAtMs ?? TRAFFIC_NOW_MS - 2000;
  return {
    trackId: "TEST-TRK-0101",
    trust: "authenticated",
    source: "operator_ws",
    sourceInstance: "TEST-CLIENT-1",
    lat: 41.7,
    lng: 44.8,
    altAmslM: 552,
    altWgs84M: 571,
    altSource: "geodetic",
    heightM: 42,
    heightRef: "TakeoffLocation",
    speedMs: 8.4,
    trackDeg: 90,
    vspeedMs: 1.5,
    status: "Airborne",
    emergency: false,
    identification: {
      status: "registered",
      reason: "session_binding",
      serial: "TEST-SN-0101",
      operatorReg: "GEO-TEST-OP-0101",
      registeredOperatorReg: null,
      mismatch: false,
      basis: "authenticated",
    },
    flightId: "TEST-FLT-0101",
    intentId: "TEST-INT-0001",
    times: {
      ts: iso(receivedAtMs - 400),
      rxTs: iso(receivedAtMs),
      capturedAt: iso(receivedAtMs - 200),
      timeSource: "source_clock",
      backlog: false,
    },
    receivedAtMs,
    ...over,
  };
}

/** A direct Remote ID track, registered on a broadcast basis (R-05). */
export function broadcastTrack(over: Partial<TrackView> = {}): TrackView {
  return uasTrack({
    trackId: "TEST-TRK-0102",
    trust: "broadcast",
    source: "direct_rid",
    sourceInstance: "TEST-RX-0001",
    lat: 41.712,
    lng: 44.815,
    altAmslM: 598,
    altSource: "pressure",
    altWgs84M: null,
    heightM: 35,
    heightRef: "GroundLevel",
    identification: {
      status: "registered",
      reason: "matched",
      serial: "TEST-SN-0102",
      operatorReg: "GEO-TEST-OP-0102",
      registeredOperatorReg: null,
      mismatch: false,
      basis: "as_broadcast",
    },
    flightId: null,
    intentId: null,
    times: {
      ts: iso(TRAFFIC_NOW_MS - 1300),
      rxTs: iso(TRAFFIC_NOW_MS - 1000),
      capturedAt: iso(TRAFFIC_NOW_MS - 1100),
      timeSource: "broadcast",
      backlog: false,
    },
    receivedAtMs: TRAFFIC_NOW_MS - 1000,
    ...over,
  });
}

/** A square ring around (lng, lat), `d` degrees across; closed. */
function ring(lng: number, lat: number, d: number): GeoJSON.Position[] {
  return [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ];
}

export function polygon(lng: number, lat: number, d = 0.004): GeoJSON.Polygon {
  return { type: "Polygon", coordinates: [ring(lng, lat, d)] };
}

/** A polygon with a hole, as the API may derive one around a zone. */
export function polygonWithHole(lng: number, lat: number): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [ring(lng, lat, 0.006), ring(lng, lat, 0.002).reverse()],
  };
}

export function multiPolygon(lng: number, lat: number): GeoJSON.MultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: [
      [ring(lng - 0.006, lat, 0.002)],
      [ring(lng + 0.006, lat, 0.002)],
    ],
  };
}

export function intent(over: Partial<IntentInput> = {}): IntentInput {
  return {
    intentId: "TEST-INT-0001",
    authorisationNumber: "GEO-TEST-AUTH-0001",
    dssState: "Activated",
    localState: "in_flight",
    volumes: [polygon(44.8, 41.7)],
    timeStart: "2026-01-01T11:30:00Z",
    timeEnd: "2026-01-01T12:30:00Z",
    priority: 0,
    ...over,
  };
}

export function receiver(over: Partial<ReceiverInput> = {}): ReceiverInput {
  return {
    id: "TEST-RX-0001",
    lat: 41.69,
    lng: 44.78,
    state: "healthy",
    disabledBy: null,
    disabledByWho: null,
    lastSeenAt: "2026-01-01T11:59:58Z",
    lagS: null,
    ...over,
  };
}
