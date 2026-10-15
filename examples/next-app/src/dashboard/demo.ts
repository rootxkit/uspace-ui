// The dashboard's demo data: synthetic (TEST-* and GEO-TEST-* ids, spec
// 06 §4), fixed in time so the page renders the same on the server and in
// the browser and in every screenshot. A system's dashboard shows its
// API's numbers and its feed's frames; every value here stands for one the
// server would send, and none is computed by the page.
import type { AlertView, FeedStatus } from "@rootxkit/uspace-ui/model";
import type { StatusTone } from "@rootxkit/uspace-ui/theme";

/** The demo's clock: 2026-10-15T09:15:06Z. */
export const DEMO_NOW_MS = Date.UTC(2026, 9, 15, 9, 15, 6);
export const DEMO_NOW = new Date(DEMO_NOW_MS).toISOString();

/** Seconds since the demo feed's last frame, as the pill shows it. */
export const DEMO_FEED_AGE_S = 2;

const at = (secondsAgo: number): string =>
  new Date(DEMO_NOW_MS - secondsAgo * 1000).toISOString();

export const DEMO_ALERTS: AlertView[] = [
  {
    alertId: "TEST-ALERT-0001",
    kind: "proximity",
    severity: "critical",
    state: "raised",
    clearReason: null,
    aircraft: ["TEST-TRK-0001"],
    peerTrackId: "TEST-TRK-0002",
    detail: {
      t_cpa_s: 42,
      d_cpa_h_m: 120,
      d_alt_m: 15,
      peer: { track_id: "TEST-TRK-0002", trust: "broadcast" },
    },
    capturedAt: at(4),
    raisedAt: at(4),
    policyVersion: "TEST-POLICY-1",
    acknowledged: false,
    receivedAtMs: DEMO_NOW_MS - 3000,
  },
  {
    alertId: "TEST-ALERT-0002",
    kind: "zone_incursion",
    severity: "warning",
    state: "updated",
    clearReason: null,
    aircraft: ["TEST-TRK-0007"],
    peerTrackId: null,
    detail: {
      zone_id: "GEO-TEST-ZONE-0001",
      zone_type: "PROHIBITED",
      vertical_known: true,
      within_band: true,
    },
    capturedAt: at(65),
    raisedAt: at(95),
    policyVersion: "TEST-POLICY-1",
    acknowledged: true,
    receivedAtMs: DEMO_NOW_MS - 64000,
  },
  {
    alertId: "TEST-ALERT-0003",
    kind: "height_exceedance",
    severity: "warning",
    state: "cleared",
    clearReason: "resolved",
    aircraft: ["TEST-TRK-0004"],
    peerTrackId: null,
    detail: { height_over_m: 18, clearing_height_over_m: 2 },
    capturedAt: at(30),
    raisedAt: at(240),
    policyVersion: "TEST-POLICY-1",
    acknowledged: false,
    receivedAtMs: DEMO_NOW_MS - 29000,
  },
];

export const DEMO_FEED: FeedStatus & { lastFrameAtMs: number } = {
  connection: "live",
  sinceMs: DEMO_NOW_MS - 3_600_000,
  droppedFrames: 0,
  degraded: [],
  policyVersion: "TEST-POLICY-1",
  staleAfterS: 10,
  liveMaxAgeS: 5,
  serverTs: at(DEMO_FEED_AGE_S),
  lastFrameAtMs: DEMO_NOW_MS - DEMO_FEED_AGE_S * 1000,
};

export type RegStatus = "active" | "suspended" | "expired";

export interface RegistryRow {
  id: string;
  regNumber: string;
  serial: string;
  status: RegStatus;
  updatedAt: string;
}

export const REG_TONE: Readonly<Record<RegStatus, StatusTone>> = {
  active: "ok",
  suspended: "warning",
  expired: "neutral",
};

const STATUSES: readonly RegStatus[] = [
  "active",
  "active",
  "suspended",
  "active",
  "expired",
  "active",
  "active",
  "suspended",
];

export const DEMO_REGISTRY: RegistryRow[] = STATUSES.map((status, i) => {
  const n = String(i + 1).padStart(4, "0");
  return {
    id: `GEO-TEST-${n}`,
    regNumber: `GEO-TEST-${n}`,
    serial: `TEST-SN-${String(7300 + i * 17)}`,
    status,
    updatedAt: at(600 + i * 4211),
  };
});

export type SourceKey =
  "rid" | "network" | "adsb" | "relay" | "registry" | "cis";

export type DemoSourceState = "live" | "lagging";

export const SOURCE_TONE: Readonly<Record<DemoSourceState, StatusTone>> = {
  live: "ok",
  lagging: "warning",
};

export const DEMO_SOURCES: readonly {
  key: SourceKey;
  state: DemoSourceState;
  ageS: number;
}[] = [
  { key: "rid", state: "live", ageS: 1 },
  { key: "network", state: "live", ageS: 2 },
  { key: "adsb", state: "lagging", ageS: 14 },
  { key: "relay", state: "live", ageS: 1 },
  { key: "registry", state: "live", ageS: 48 },
  { key: "cis", state: "live", ageS: 31 },
];
