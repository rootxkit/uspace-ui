// Test alerts over the WP-7 fixture sky (WP-11): every alert and
// violation kind raised, and cleared with its own numbers, each on a
// track of the sky; a proximity alert between an authenticated and a
// broadcast track (dashed, unverified), one between two authenticated
// tracks (solid), and one whose peer is not in the sky (a ring and a
// counter). Synthetic numbers a server would send (spec 06 §4).
import {
  CLEARING,
  DETAIL,
  EVERY_KIND,
} from "../../src/alerts/fixtures.testing.js";
import type { AlertView, Severity } from "../../src/model/index.js";
import { FIXED_NOW_MS } from "../tracks/tracks.js";

export { EVERY_KIND, FIXED_NOW_MS };

/** The server's repeat period for unacknowledged critical alerts (02 F5). */
export const SERVER_REPEAT_MS = 10_000;

// Tracks of the fixture sky (browser/tracks/tracks.ts): the first column
// is authenticated, the fourth is broadcast.
export const AUTH_A = "TEST-TRK-0001";
export const AUTH_B = "TEST-TRK-0002";
export const BROADCAST = "TEST-TRK-0016";
export const NOT_IN_SKY = "TEST-TRK-9999";

const SEVERITY: readonly Severity[] = ["critical", "warning", "info"];
const pad = (n: number): string => String(n).padStart(4, "0");
const iso = (ms: number): string => new Date(ms).toISOString();

function base(i: number, over: Partial<AlertView>): AlertView {
  const kind = over.kind ?? "proximity";
  return {
    alertId: `TEST-ALR-${pad(i + 1)}`,
    kind,
    severity: SEVERITY[i % SEVERITY.length] ?? "info",
    state: "raised",
    clearReason: null,
    aircraft: [`TEST-TRK-${pad((i % 20) + 3)}`],
    peerTrackId: null,
    detail: DETAIL[kind],
    capturedAt: iso(FIXED_NOW_MS - i * 1000),
    raisedAt: iso(FIXED_NOW_MS - 60_000 - i * 7000),
    policyVersion: "test-policy-1",
    acknowledged: false,
    receivedAtMs: FIXED_NOW_MS - (i % 5) * 1000,
    ...over,
  };
}

/** Every kind raised, then every kind cleared with the clear's numbers. */
export function everyKind(): AlertView[] {
  const raised = EVERY_KIND.map((kind, i) => base(i, { kind }));
  const cleared = EVERY_KIND.map((kind, i) =>
    base(i + EVERY_KIND.length, {
      kind,
      state: "cleared",
      clearReason: "resolved",
      detail: { ...DETAIL[kind], ...CLEARING[kind] },
    }),
  );
  return [...raised, ...cleared];
}

/** The alerts drawn over the sky. */
export function skyAlerts(): AlertView[] {
  return [
    base(0, {
      kind: "proximity",
      severity: "critical",
      aircraft: [AUTH_A],
      peerTrackId: BROADCAST,
      detail: {
        ...DETAIL.proximity,
        peer: { track_id: BROADCAST, trust: "broadcast" },
      },
    }),
    base(1, {
      kind: "proximity",
      severity: "warning",
      aircraft: [AUTH_A, AUTH_B],
      peerTrackId: AUTH_B,
    }),
    base(2, {
      kind: "proximity",
      severity: "info",
      aircraft: ["TEST-TRK-0007"],
      peerTrackId: NOT_IN_SKY,
      detail: {
        ...DETAIL.proximity,
        peer: { track_id: NOT_IN_SKY, trust: "authenticated" },
      },
    }),
    base(3, { kind: "zone_incursion", aircraft: ["TEST-TRK-0011"] }),
    base(4, { kind: "height_exceedance", aircraft: ["TEST-TRK-0012"] }),
    base(5, {
      kind: "zone_incursion",
      aircraft: ["TEST-TRK-0013"],
      state: "cleared",
      clearReason: "landed",
    }),
  ];
}
