// Test data for the track layer (WP-7): a fixture sky over the committed
// Tbilisi extract (browser/public/basemap/, bounds 44.77..44.83 E, 41.68..41.73
// N) with every trust class against every identification status (and no
// identification at all), ages spread across the live, aging and stale
// buckets, one emergency, one mismatch, arrows and no arrows, and every
// identification basis. The positions are display-only sample points on
// a grid; none is a real aircraft (spec 06 §4: GEO-TEST-* registrations,
// TEST* serials).
import {
  IDENT_BASES,
  IDENT_REASONS,
  IDENT_STATUSES,
  TRUSTS,
  type IdentStatus,
  type TrackView,
} from "../../src/model/index.js";

/** The tests' clock: 2026-01-01T12:00:00Z. The tests do not tick. */
export const FIXED_NOW_MS = Date.UTC(2026, 0, 1, 12, 0, 0);

/** The policy value the tests pass as the feed's `stale_after_s`. */
export const STALE_AFTER_S = 30;

/** Ages in seconds that land in live, aging and stale under 30 s. */
const AGES_S = [2, 15, 45] as const;

const pad = (n: number): string => String(n).padStart(4, "0");
const iso = (ms: number): string => new Date(ms).toISOString();

const STATUSES: readonly (IdentStatus | null)[] = [...IDENT_STATUSES, null];

/** The track that reports an emergency, and the one with a mismatch. */
export const EMERGENCY_TRACK = "TEST-TRK-0008";
export const MISMATCH_TRACK = "TEST-TRK-0003";

export function fixtureTracks(): TrackView[] {
  const out: TrackView[] = [];
  TRUSTS.forEach((trust, col) => {
    STATUSES.forEach((status, row) => {
      const i = col * STATUSES.length + row;
      const trackId = `TEST-TRK-${pad(i + 1)}`;
      const ageS = AGES_S[i % AGES_S.length] ?? 0;
      const receivedAtMs = FIXED_NOW_MS - ageS * 1000;
      const capturedAt = iso(receivedAtMs - 200);
      const mismatch = trackId === MISMATCH_TRACK;
      out.push({
        trackId,
        trust,
        source: trust === "broadcast" ? "direct_rid" : "operator_ws",
        sourceInstance: `test-${(i % 3) + 1}`,
        lat: 41.687 + row * 0.0085,
        lng: 44.777 + col * 0.0088,
        altAmslM: 520 + i * 3,
        altWgs84M: 540 + i * 3,
        altSource: "geodetic",
        heightM: 40 + i,
        heightRef: "TakeoffLocation",
        speedMs: 6 + (i % 7),
        trackDeg: i % 4 === 3 ? null : (i * 47) % 360,
        vspeedMs: 0,
        status: "Airborne",
        emergency: trackId === EMERGENCY_TRACK,
        identification:
          status === null
            ? null
            : {
                status,
                reason:
                  IDENT_REASONS[i % IDENT_REASONS.length] ??
                  "registry_unavailable",
                serial:
                  status === "unidentified" ? null : `TEST-SN-${pad(i + 1)}`,
                operatorReg:
                  status === "unidentified"
                    ? null
                    : `GEO-TEST-OP-${pad(i + 1)}`,
                registeredOperatorReg: mismatch
                  ? `GEO-TEST-OP-${pad(i + 101)}`
                  : null,
                mismatch,
                basis: IDENT_BASES[i % IDENT_BASES.length] ?? "as_broadcast",
              },
        flightId: null,
        intentId: null,
        times: {
          ts: capturedAt,
          rxTs: iso(receivedAtMs),
          capturedAt,
          timeSource: "source_clock",
          backlog: false,
        },
        receivedAtMs,
      });
    });
  });
  return out;
}

/**
 * Two backlog samples and one newer live sample of the first track, so a
 * trail shows: the backlog extends the trail and leaves the symbol where
 * the newest live sample put it (T-04).
 */
export function fixtureHistory(first: TrackView): TrackView[] {
  const sample = (
    dLng: number,
    offsetS: number,
    backlog: boolean,
  ): TrackView => {
    const capturedAt = iso(FIXED_NOW_MS + offsetS * 1000);
    return {
      ...first,
      lng: first.lng + dLng,
      times: { ...first.times, capturedAt, backlog },
      receivedAtMs: FIXED_NOW_MS,
    };
  };
  return [
    sample(-0.003, -60, true),
    sample(-0.0015, -40, true),
    sample(0.001, 0, false),
  ];
}
