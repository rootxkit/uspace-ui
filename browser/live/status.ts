// Test data for the status components (WP-8): feed statuses in each
// connection state and a status frame's sources in every state, run
// through the live source store so the tests show what the store makes
// of the wire. Fixed clock: the tests do not tick (golden snapshots). No
// real data (spec 06 §4): TEST receivers, role ids for people.
import {
  createSourceStore,
  type LiveSourceView,
  type LiveStatus,
  type StatusSource,
} from "../../src/live/index.js";
import { NO_EXTRAS } from "../../src/live/index.js";

/** The tests' clock: 2026-01-01T12:00:00Z. */
export const FIXED_NOW_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const SERVER_TS = "2026-01-01T12:00:00.000Z";

const base: LiveStatus = {
  connection: "live",
  sinceMs: FIXED_NOW_MS - 3_600_000,
  droppedFrames: 0,
  degraded: [],
  policyVersion: "test-1",
  staleAfterS: 30,
  liveMaxAgeS: 10,
  serverTs: SERVER_TS,
  connectionId: "c-test",
  clockOffsetMs: 0,
  lastFrameAtMs: FIXED_NOW_MS - 1000,
  lastStatusAtMs: FIXED_NOW_MS - 1000,
  unauthorized: false,
  attempt: 0,
  nextRetryAtMs: null,
  framesMalformed: 0,
  framesUnhandled: 0,
  zonesVersion: "zones-test-1",
  extras: NO_EXTRAS,
};

/** One status per thing the bar must say, labelled for the test. */
export const FEED_STATUSES: readonly { label: string; status: LiveStatus }[] = [
  {
    label: "connecting, first time",
    status: {
      ...base,
      connection: "connecting",
      sinceMs: FIXED_NOW_MS - 2000,
      lastFrameAtMs: null,
      staleAfterS: null,
      liveMaxAgeS: null,
      policyVersion: null,
    },
  },
  { label: "live", status: base },
  {
    label: "live and quiet for ten minutes",
    status: { ...base, lastFrameAtMs: FIXED_NOW_MS - 600_000 },
  },
  {
    label: "live, frames dropped and ignored, degraded",
    status: {
      ...base,
      droppedFrames: 17,
      framesMalformed: 2,
      degraded: ["manned", "dss"],
    },
  },
  {
    label: "down, retrying",
    status: {
      ...base,
      connection: "down",
      sinceMs: FIXED_NOW_MS - 95_000,
      lastFrameAtMs: FIXED_NOW_MS - 95_000,
      attempt: 4,
      nextRetryAtMs: FIXED_NOW_MS + 8000,
    },
  },
  {
    label: "session ended (4401), retrying",
    status: {
      ...base,
      connection: "down",
      sinceMs: FIXED_NOW_MS - 20_000,
      lastFrameAtMs: FIXED_NOW_MS - 20_000,
      unauthorized: true,
    },
  },
];

const wire = (over: Partial<StatusSource>): StatusSource => ({
  source: "direct_rid",
  sourceInstance: "rx-test-01",
  state: "live",
  since: "2026-01-01T09:00:00.000Z",
  ageS: 0.4,
  disabledBy: null,
  disabledByWho: null,
  counters: { accepted: 182344, refused: 12 },
  lagS: null,
  ...over,
});

/** A status frame's sources in every state, through the source store. */
export function fixtureSources(): readonly LiveSourceView[] {
  const store = createSourceStore();
  store.applyStatus(
    [
      wire({ sourceInstance: null, ageS: 0.4 }),
      wire({}),
      wire({ sourceInstance: "rx-test-02", state: "live", lagS: 42 }),
      wire({ sourceInstance: "rx-test-03", state: "stale", ageS: 75 }),
      wire({ sourceInstance: "rx-test-04", state: "down", ageS: 312 }),
      wire({
        sourceInstance: "rx-test-05",
        state: "disabled",
        ageS: 2054,
        disabledBy: "instance",
        disabledByWho: "admin:test-1",
        counters: { accepted: 5521, refused: 340 },
      }),
      wire({
        sourceInstance: "rx-test-06",
        ageS: null,
        counters: { accepted: 0, refused: 0 },
      }),
      wire({
        source: "network_rid",
        sourceInstance: null,
        state: "disabled",
        ageS: 906,
        disabledBy: "type",
        disabledByWho: "supervisor:test-2",
      }),
      wire({
        source: "network_rid",
        sourceInstance: "dp-test-01",
        state: "disabled",
        ageS: 906,
        disabledBy: "type",
        disabledByWho: "supervisor:test-2",
      }),
      wire({
        source: "network_rid",
        sourceInstance: "dp-test-02",
        state: "disabled",
        ageS: null,
        disabledBy: "default_deny",
        counters: { accepted: 0, refused: 3 },
      }),
    ],
    SERVER_TS,
    FIXED_NOW_MS,
  );
  return store.snapshot();
}
