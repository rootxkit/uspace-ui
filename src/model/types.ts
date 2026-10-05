// The view-model interfaces of docs/PLAN.md §3.1, frozen in WP-0.
//
// The lines below the imports are docs/PLAN.md §3.1 verbatim (from
// `export interface Times` to `export interface SessionDisplay`), so a
// reviewer can diff the two; this file is excluded from prettier for that
// reason. The enumerations are in ./enums.ts. `null` means "unknown / not
// provided by the API", never a zero.

import type * as GeoJSON from "geojson";
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
} from "./enums.js";

export interface Times { ts: string | null; rxTs: string; capturedAt: string; timeSource: TimeSource; backlog: boolean }   // 04 §2
export interface Identification { status: IdentStatus; reason: IdentReason; serial: string | null; operatorReg: string | null; registeredOperatorReg: string | null; mismatch: boolean; basis: IdentBasis }

export interface TrackView {
  trackId: string; trust: Trust; source: string; sourceInstance: string;
  lat: number; lng: number;                           // WGS84 degrees; the only numbers the map needs
  altAmslM: number | null; altWgs84M: number | null; altSource: AltSource;
  heightM: number | null; heightRef: "TakeoffLocation" | "GroundLevel" | null;
  speedMs: number | null; trackDeg: number | null; vspeedMs: number | null;
  status: string | null; emergency: boolean;          // F3411 operational status as the API spells it
  identification: Identification | null;
  flightId: string | null; intentId: string | null;
  times: Times;
  receivedAtMs: number;                               // browser clock; set by the live store, never by the API
}
export interface MannedView { trackId: string; icao24: string | null; callsign: string | null; lat: number; lng: number; altPressureM: number | null; altWgs84M: number | null; gsMs: number | null; trackDeg: number | null; vrateMs: number | null; sourceClass: string; emergency: boolean; times: Times; receivedAtMs: number }
export interface ZoneView {                           // one ED-318 feature as the API serves it, untouched geometry
  identifier: string; name: string | null; type: ZoneType; variant: string | null; reason: string[]; message: string | null;
  lowerLimitM: number | null; lowerRef: VerticalRef | null; upperLimitM: number | null; upperRef: VerticalRef | null;   // metres as the API converted them, with their reference; shown with the reference, never compared here
  geometry: GeoJSON.Geometry; applies: boolean | null; restrictionState: RestrictionState | null; version: string | null; updatedAt: string | null;
}
export interface AlertView { alertId: string; kind: AlertKind | ViolationKind; severity: Severity; state: AlertState; clearReason: ClearReason | null; aircraft: string[]; peerTrackId: string | null; detail: Record<string, unknown>; capturedAt: string; raisedAt: string; policyVersion: string; acknowledged: boolean; receivedAtMs: number }
export interface IntentView { intentId: string; authorisationNumber: string | null; dssState: string | null; localState: string | null; volumes: GeoJSON.Polygon[]; timeStart: string; timeEnd: string; priority: number | null }
export interface SourceView { sourceType: string; instanceId: string | null; state: SourceState; disabledBy: DisabledBy | null; disabledByWho: string | null; lastSeenAt: string | null; lagS: number | null; accepted: number; refused: number }
export interface FeedStatus { connection: "connecting" | "live" | "down"; sinceMs: number; droppedFrames: number; degraded: string[]; policyVersion: string | null; staleAfterS: number | null; liveMaxAgeS: number | null; serverTs: string | null }
export interface FieldError { field: string; reason: string }      // uspace-core core.FieldError (its CLAUDE.md rule 5: an error names the field and the reason)
export interface Problem { type: string; title: string; status: number; detail: string | null; instance: string | null; errors: FieldError[]; truncated?: boolean }   // §14 Q2 (decided, M28): `type` = https://schemas.uspace.ge/problems/<slug>; `errors` capped at 100 by the server, `truncated: true` when it was cut; the form kit says "and more" on it
export interface SessionDisplay { sub: string; roles: string[]; realm: string; exp: number }   // the session JWT claims the BFF decodes for display (M20): `roles` is always an array (one element where a system has single-role users); `realm` is `console` (default), `police` (authority) or `portal` (USSP operators)

// 1.0.0 (additive): an outline a person is drawing or typing (layers/DrawLayer, form/OutlineFields), passed to the app as entered. The kit never closes, simplifies, buffers or measures it, and never turns a circle into a polygon: the API judges the outline and, where a circle must be drawn, draws its outline in Go (uspace-core geodesy) and returns it.
export interface DrawPoint { lat: number; lng: number }   // WGS84 degrees, as clicked (MapLibre's lngLat) or typed
export type DrawOutline =
  | { kind: "polygon"; vertices: readonly DrawPoint[] }   // in the order given; the first is not repeated
  | { kind: "circle"; center: DrawPoint | null; radiusM: number | null };   // radius in metres as typed; null: not yet given
