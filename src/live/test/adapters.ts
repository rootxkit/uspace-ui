// The app-side adapters the tests stand in for (PLAN §6.3: "app adapter to
// TrackView / AlertView"). An app writes these against its generated
// types; here they read the lab examples' bodies just far enough to drive
// the stores. Not part of the package.
import type { AlertInput } from "../alertStore.js";
import type { ConsoleFrame } from "../frame.js";
import {
  isAlertKind,
  isAlertState,
  isSeverity,
  isTrust,
  isViolationKind,
  type TrackView,
} from "../../model/index.js";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  typeof v === "object" && v !== null ? (v as Obj) : {};
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function adaptTrack(
  f: ConsoleFrame,
): Omit<TrackView, "receivedAtMs"> | null {
  if (f.schema !== "track/telemetry/v1") return null;
  const b = obj(f.body);
  const pos = obj(b["position"]);
  const lat = num(pos["lat"]);
  const lng = num(pos["lng"]);
  const trackId = str(b["track_id"]);
  if (trackId === null || lat === null || lng === null || !isTrust(b["trust"]))
    return null;
  return {
    trackId,
    trust: b["trust"],
    source: str(b["source"]) ?? "",
    sourceInstance: str(b["source_instance"]) ?? "",
    lat,
    lng,
    altAmslM: num(b["alt_amsl_m"]),
    altWgs84M: num(b["alt_wgs84_m"]),
    altSource: "geodetic",
    heightM: num(b["height_m"]),
    heightRef: null,
    speedMs: num(b["speed_ms"]),
    trackDeg: num(b["track_deg"]),
    vspeedMs: num(b["vspeed_ms"]),
    status: str(b["status"]),
    emergency: b["emergency"] === true,
    identification: null,
    flightId: str(b["flight_id"]),
    intentId: str(b["intent_id"]),
    times: {
      ts: f.ts,
      rxTs: f.rxTs,
      capturedAt: f.capturedAt ?? f.rxTs,
      timeSource: f.timeSource,
      backlog: f.backlog,
    },
  };
}

export function adaptAlert(f: ConsoleFrame): AlertInput | null {
  const b = obj(f.body);
  const id = str(b["alert_id"]) ?? str(b["violation_id"]);
  const kind = b["kind"];
  if (id === null || !(isAlertKind(kind) || isViolationKind(kind))) return null;
  return {
    alertId: id,
    kind,
    severity: isSeverity(b["severity"]) ? b["severity"] : "warning",
    state: isAlertState(b["state"]) ? b["state"] : "raised",
    clearReason: null,
    aircraft: [],
    peerTrackId: null,
    detail: b,
    capturedAt: f.capturedAt ?? f.rxTs,
    raisedAt: f.capturedAt ?? f.rxTs,
    policyVersion: "test",
  };
}
