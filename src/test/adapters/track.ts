// Reference adapters for track messages (WP-14): `track/telemetry/v1`
// (lab schemas/common, 04 §3.1) to TrackView and `track/manned/v1` (the
// ANSP's schema, 02 F4) to the layers' MannedTrack. Field names are the
// schemas', read as written there (CLAUDE.md E-03).
import type { ConsoleFrame } from "../../live/frame.js";
import {
  isAltSource,
  isIdentBasis,
  isIdentReason,
  isIdentStatus,
  isTrust,
  type Identification,
  type Times,
  type TrackView,
} from "../../model/index.js";
import type { MannedTrack } from "../../symbology/manned.js";
import {
  adapted,
  num,
  obj,
  refused,
  str,
  type Adapted,
  type Obj,
} from "./result.js";

/** The three times of a frame's envelope (04 §2), as TrackView holds them. */
export function timesOf(f: ConsoleFrame): Times {
  return {
    ts: f.ts,
    rxTs: f.rxTs,
    capturedAt: f.capturedAt ?? f.rxTs,
    timeSource: f.timeSource,
    backlog: f.backlog,
  };
}

function identification(raw: unknown): Adapted<Identification | null> {
  if (raw === null || raw === undefined) return adapted(null);
  const b = obj(raw);
  if (!isIdentStatus(b["status"]))
    return refused(
      "identification.status",
      b["status"],
      "not a core.IdentStatus",
    );
  if (!isIdentReason(b["reason"]))
    return refused(
      "identification.reason",
      b["reason"],
      "not a core.IdentReason",
    );
  if (!isIdentBasis(b["basis"]))
    return refused("identification.basis", b["basis"], "not a core.IdentBasis");
  return adapted({
    status: b["status"],
    reason: b["reason"],
    serial: str(b["serial"]),
    operatorReg: str(b["operator_reg"]),
    registeredOperatorReg: str(b["registered_operator_reg"]),
    mismatch: b["mismatch"] === true,
    basis: b["basis"],
  });
}

function position(b: Obj): { lat: number; lng: number } | null {
  const p = obj(b["position"]);
  const lat = num(p["lat"]);
  const lng = num(p["lng"]);
  return lat === null || lng === null ? null : { lat, lng };
}

/** `track/telemetry/v1` to a TrackView (the store stamps receivedAtMs). */
export function adaptTelemetry(
  f: ConsoleFrame,
): Adapted<Omit<TrackView, "receivedAtMs">> {
  if (f.schema !== "track/telemetry/v1")
    return refused("schema", f.schema, "not track/telemetry/v1");
  const b = obj(f.body);
  const trackId = str(b["track_id"]);
  if (trackId === null) return refused("track_id", b["track_id"], "missing");
  const pos = position(b);
  if (pos === null) return refused("position", b["position"], "no lat and lng");
  if (!isTrust(b["trust"]))
    return refused("trust", b["trust"], "not a core.Trust");
  if (!isAltSource(b["alt_source"]))
    return refused("alt_source", b["alt_source"], "not a core.AltSource");
  const ref = b["height_ref"];
  if (ref !== null && ref !== "TakeoffLocation" && ref !== "GroundLevel")
    return refused(
      "height_ref",
      ref,
      "not TakeoffLocation, GroundLevel or null",
    );
  const ident = identification(b["identification"]);
  if (!ident.ok) return ident;
  return adapted({
    trackId,
    trust: b["trust"],
    source: str(b["source"]) ?? "",
    sourceInstance: str(b["source_instance"]) ?? "",
    lat: pos.lat,
    lng: pos.lng,
    altAmslM: num(b["alt_amsl_m"]),
    altWgs84M: num(b["alt_wgs84_m"]),
    altSource: b["alt_source"],
    heightM: num(b["height_m"]),
    heightRef: ref,
    speedMs: num(b["speed_ms"]),
    trackDeg: num(b["track_deg"]),
    vspeedMs: num(b["vspeed_ms"]),
    status: str(b["status"]),
    emergency: b["emergency"] === true,
    identification: ident.value,
    flightId: str(b["flight_id"]),
    intentId: str(b["intent_id"]),
    times: timesOf(f),
  });
}

/**
 * `track/manned/v1` to a MannedTrack. Its id is the message's `track_id`
 * when it has one, else the ICAO 24-bit address (the ANSP's key).
 * `trust` and `anomaly` are optional (PLAN §14 Q20): absent, MannedLayer
 * draws the aircraft as broadcast, never as surveillance.
 */
export function adaptManned(
  f: ConsoleFrame,
): Adapted<Omit<MannedTrack, "receivedAtMs">> {
  if (f.schema !== "track/manned/v1")
    return refused("schema", f.schema, "not track/manned/v1");
  const b = obj(f.body);
  const icao24 = str(b["icao24"]);
  const trackId = str(b["track_id"]) ?? icao24;
  if (trackId === null)
    return refused("track_id", b["track_id"], "neither track_id nor icao24");
  const pos = position(b);
  if (pos === null) return refused("position", b["position"], "no lat and lng");
  const trust = b["trust"];
  if (trust !== undefined && trust !== null && !isTrust(trust))
    return refused("trust", trust, "not a core.Trust");
  const sourceClass = str(b["source_class"]);
  if (sourceClass === null)
    return refused("source_class", b["source_class"], "missing");
  return adapted({
    trackId,
    icao24,
    callsign: str(b["callsign"]),
    lat: pos.lat,
    lng: pos.lng,
    altPressureM: num(b["alt_pressure_m"]),
    altWgs84M: num(b["alt_wgs84_m"]),
    gsMs: num(b["gs_ms"]),
    trackDeg: num(b["track_deg"]),
    vrateMs: num(b["vrate_ms"]),
    sourceClass,
    emergency: b["emergency"] === true,
    times: timesOf(f),
    ...(isTrust(trust) ? { trust } : {}),
  });
}
