// The bounded stores (WP-8): each bound exceeded and counted (E-10),
// forward-only samples (T-13), backlog to the trail (T-04), a cleared
// alert held and then dropped (C-14), acknowledgement per console, and
// the source states in the server's words with `disabled` winning (B-11).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fixtures } from "../test/fixtures.js";
import type { TrackView } from "../model/index.js";
import {
  ALERT_STORE_LIMIT,
  DEFAULT_CLEARED_HOLD_MS,
  createAlertStore,
  type AlertInput,
} from "./alertStore.js";
import type { StatusSource } from "./frame.js";
import {
  SOURCE_STORE_LIMIT,
  createSourceStore,
  sourceAgeS,
  sourceStateOf,
} from "./sourceStore.js";
import {
  RECENTLY_REMOVED_LIMIT,
  createMannedStore,
  createTrackStore,
} from "./trackStore.js";
import { omit } from "./test/omit.js";

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

function track(
  id: string,
  capturedAt: string,
  extra: Partial<TrackView["times"]> = {},
  lat = 41.7,
): Omit<TrackView, "receivedAtMs"> {
  const base = fixtures().tracks[0];
  if (base === undefined) throw new Error("fixtures");
  const rest = omit(base, "receivedAtMs");
  return {
    ...rest,
    trackId: id,
    lat,
    times: {
      ...base.times,
      capturedAt,
      backlog: false,
      ...extra,
    },
  };
}

const at = (s: number) =>
  new Date(T0 + s * 1000).toISOString().replace(/\.\d{3}Z$/, ".000Z");

describe("createTrackStore", () => {
  it("stamps receivedAtMs on the browser clock", () => {
    const store = createTrackStore({ trailPoints: 5, maxTracks: 10 });
    vi.advanceTimersByTime(1234);
    store.upsert(track("A", at(0)));
    expect(store.get("A")?.receivedAtMs).toBe(T0 + 1234);
  });

  it("evicts the least recently updated past maxTracks and counts it (E-10)", () => {
    const store = createTrackStore({ trailPoints: 2, maxTracks: 3 });
    for (const id of ["A", "B", "C"]) store.upsert(track(id, at(0)));
    // A is updated, so B is now the oldest.
    store.upsert(track("A", at(1)));
    store.upsert(track("D", at(1)));
    expect([...store.snapshot().keys()]).toEqual(["C", "A", "D"]);
    expect(store.counters().track_evicted).toBe(1);
    expect(store.recentlyRemoved().map((r) => [r.trackId, r.reason])).toEqual([
      ["B", "evicted"],
    ]);
    // At the bound and not past it: nothing more is evicted.
    store.upsert(track("C", at(2)));
    expect(store.counters().track_evicted).toBe(1);
  });

  it("bounds every trail and counts what it drops (E-10)", () => {
    const store = createTrackStore({ trailPoints: 3, maxTracks: 10 });
    for (let s = 0; s < 5; s++) store.upsert(track("A", at(s), {}, 41 + s));
    expect(store.trail("A")).toHaveLength(3);
    expect(store.trail("A").map((p) => p[1])).toEqual([43, 44, 45]);
    expect(store.counters().trail_point_evicted).toBe(2);
    const none = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    none.upsert(track("A", at(0)));
    expect(none.trail("A")).toEqual([]);
  });

  it("ignores an older sample and counts it; applies a newer one (T-13)", () => {
    const store = createTrackStore({ trailPoints: 5, maxTracks: 10 });
    store.upsert(track("A", at(5), {}, 41.5));
    store.upsert(track("A", at(4), {}, 41.4));
    expect(store.get("A")?.lat).toBe(41.5);
    expect(store.counters().track_out_of_order).toBe(1);
    store.upsert(track("A", at(6), {}, 41.6));
    expect(store.get("A")?.lat).toBe(41.6);
    // A time that cannot be ordered is applied, never hidden, and counted.
    store.upsert(track("A", "yesterday", {}, 41.7));
    expect(store.get("A")?.lat).toBe(41.7);
    expect(store.counters().track_time_unordered).toBe(1);
  });

  it("sends a backlog sample to the trail, never to the live position (T-04)", () => {
    const store = createTrackStore({ trailPoints: 10, maxTracks: 10 });
    store.upsert(track("A", at(10), {}, 41.1));
    store.upsert(track("A", at(5), { backlog: true }, 40.5));
    expect(store.get("A")?.lat).toBe(41.1);
    expect(store.get("A")?.times.backlog).toBe(false);
    expect(store.trail("A")).toHaveLength(2);
    expect(store.counters().backlog_to_trail).toBe(1);
    // A track known only from its backlog is held as history: the layer
    // draws it as a trail without a live point.
    store.upsert(track("B", at(5), { backlog: true }));
    expect(store.get("B")?.times.backlog).toBe(true);
    // ...until its first live sample.
    store.upsert(track("B", at(6)));
    expect(store.get("B")?.times.backlog).toBe(false);
  });

  it("remove records the server's reason; an unknown id is counted", () => {
    const store = createTrackStore({ trailPoints: 2, maxTracks: 10 });
    store.upsert(track("A", at(0)));
    store.remove("A", "source_disabled");
    expect(store.get("A")).toBeUndefined();
    expect(store.trail("A")).toEqual([]);
    expect(store.recentlyRemoved()).toEqual([
      { trackId: "A", reason: "source_disabled", atMs: T0 },
    ]);
    store.remove("nope", "stale");
    expect(store.counters().remove_unknown).toBe(1);
  });

  it("the recently removed ring is bounded and counted (E-10)", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 1000 });
    const n = RECENTLY_REMOVED_LIMIT + 7;
    for (let i = 0; i < n; i++) {
      store.upsert(track(`T${i}`, at(0)));
      store.remove(`T${i}`, "flight_ended");
    }
    expect(store.recentlyRemoved()).toHaveLength(RECENTLY_REMOVED_LIMIT);
    expect(store.recentlyRemoved()[0]?.trackId).toBe("T7");
    expect(store.counters().removed_ring_evicted).toBe(7);
  });

  it("snapshot is stable between changes and new after one; subscribers hear changes", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    const fn = vi.fn();
    const off = store.subscribe(fn);
    const a = store.snapshot();
    expect(store.snapshot()).toBe(a);
    store.upsert(track("A", at(0)));
    expect(fn).toHaveBeenCalledTimes(1);
    const b = store.snapshot();
    expect(b).not.toBe(a);
    expect(store.snapshot()).toBe(b);
    // An ignored sample changes nothing and tells no one.
    store.upsert(track("A", at(-1)));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.snapshot()).toBe(b);
    off();
    store.upsert(track("A", at(1)));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("refuses a bound that is not a positive integer (configuration)", () => {
    expect(() => createTrackStore({ trailPoints: 0, maxTracks: 0 })).toThrow(
      RangeError,
    );
    expect(() => createTrackStore({ trailPoints: -1, maxTracks: 1 })).toThrow(
      RangeError,
    );
  });

  it("the manned store is the same bounded store", () => {
    const base = fixtures().manned[0];
    if (base === undefined) throw new Error("fixtures");
    const m = omit(base, "receivedAtMs");
    const store = createMannedStore({ trailPoints: 1, maxTracks: 1 });
    store.upsert({ ...m, trackId: "M1" });
    store.upsert({ ...m, trackId: "M2" });
    expect([...store.snapshot().keys()]).toEqual(["M2"]);
    expect(store.counters().track_evicted).toBe(1);
  });
});

function alert(
  id: string,
  state: AlertInput["state"],
  extra: Partial<AlertInput> = {},
): AlertInput {
  return {
    alertId: id,
    kind: "proximity",
    severity: "warning",
    state,
    clearReason: state === "cleared" ? "resolved" : null,
    aircraft: ["TEST-TRK-0001", "TEST-TRK-0002"],
    peerTrackId: null,
    detail: state === "cleared" ? { min_sep_m: 41.5, cleared_sep_m: 210 } : {},
    capturedAt: "2026-01-01T12:00:00.000Z",
    raisedAt: "2026-01-01T12:00:00.000Z",
    policyVersion: "test",
    ...extra,
  };
}

describe("createAlertStore", () => {
  it("a raise and an update replace by id (C-06)", () => {
    const store = createAlertStore();
    store.apply(alert("X", "raised"));
    store.apply(alert("X", "updated", { detail: { sep_m: 30 } }));
    expect(store.snapshot().size).toBe(1);
    expect(store.get("X")?.state).toBe("updated");
    expect(store.get("X")?.detail).toEqual({ sep_m: 30 });
    store.dispose();
  });

  it("holds a cleared alert with its numbers and reason, then drops it at clearedHoldMs (C-14)", () => {
    const store = createAlertStore({ clearedHoldMs: 5000 });
    const fn = vi.fn();
    store.subscribe(fn);
    store.apply(alert("X", "raised"));
    store.apply(alert("X", "cleared"));
    const held = store.get("X");
    expect(held?.state).toBe("cleared");
    expect(held?.clearReason).toBe("resolved");
    expect(held?.detail).toEqual({ min_sep_m: 41.5, cleared_sep_m: 210 });
    vi.advanceTimersByTime(4999);
    expect(store.get("X")).toBeDefined();
    const calls = fn.mock.calls.length;
    vi.advanceTimersByTime(1);
    expect(store.get("X")).toBeUndefined();
    expect(store.counters().cleared_dropped).toBe(1);
    expect(fn.mock.calls.length).toBe(calls + 1);
    expect(vi.getTimerCount()).toBe(0);
    store.dispose();
  });

  it("the default hold is the named display constant", () => {
    const store = createAlertStore();
    store.apply(alert("X", "cleared"));
    vi.advanceTimersByTime(DEFAULT_CLEARED_HOLD_MS - 1);
    expect(store.get("X")).toBeDefined();
    vi.advanceTimersByTime(1);
    expect(store.get("X")).toBeUndefined();
    store.dispose();
  });

  it("a raise after a clear cancels the drop", () => {
    const store = createAlertStore({ clearedHoldMs: 1000 });
    store.apply(alert("X", "cleared"));
    store.apply(alert("X", "raised"));
    vi.advanceTimersByTime(5000);
    expect(store.get("X")?.state).toBe("raised");
    store.dispose();
  });

  it("acknowledged is per console; an update keeps it, a new raise asks again", () => {
    const store = createAlertStore();
    store.apply(alert("X", "raised"));
    expect(store.get("X")?.acknowledged).toBe(false);
    store.acknowledge("X");
    expect(store.get("X")?.acknowledged).toBe(true);
    store.apply(alert("X", "updated"));
    expect(store.get("X")?.acknowledged).toBe(true);
    // C-07: a severity change shows as a new raise.
    store.apply(alert("X", "raised", { severity: "critical" }));
    expect(store.get("X")?.acknowledged).toBe(false);
    store.acknowledge("nope");
    expect(store.counters().acknowledge_unknown).toBe(1);
    store.dispose();
  });

  it("is bounded: past maxAlerts a held clear goes first, then the oldest (E-10)", () => {
    const store = createAlertStore({ maxAlerts: 3 });
    store.apply(alert("A", "raised"));
    store.apply(alert("B", "cleared"));
    store.apply(alert("C", "raised"));
    store.apply(alert("D", "raised"));
    expect([...store.snapshot().keys()]).toEqual(["A", "C", "D"]);
    store.apply(alert("E", "raised"));
    expect([...store.snapshot().keys()]).toEqual(["C", "D", "E"]);
    expect(store.counters().alert_evicted).toBe(2);
    expect(ALERT_STORE_LIMIT).toBe(500);
    store.dispose();
  });

  it("replace (C-08): the replay is applied; an active alert absent is gone, a held clear stays", () => {
    const store = createAlertStore();
    store.apply(alert("OLD", "raised"));
    store.apply(alert("CLR", "cleared"));
    store.apply(alert("KEEP", "raised"));
    store.acknowledge("KEEP");
    store.replace([alert("KEEP", "raised"), alert("NEW", "raised")]);
    expect([...store.snapshot().keys()].sort()).toEqual(["CLR", "KEEP", "NEW"]);
    expect(store.counters().alert_absent_from_snapshot).toBe(1);
    // The same raise replayed keeps this console's acknowledgement.
    expect(store.get("KEEP")?.acknowledged).toBe(true);
    store.dispose();
  });

  it("refuses an unusable hold or bound (configuration)", () => {
    expect(() => createAlertStore({ clearedHoldMs: -1 })).toThrow(RangeError);
    expect(() => createAlertStore({ maxAlerts: 0 })).toThrow(RangeError);
  });
});

function src(over: Partial<StatusSource> = {}): StatusSource {
  return {
    source: "direct_rid",
    sourceInstance: "rx-1",
    state: "live",
    since: "2026-01-01T11:00:00.000Z",
    ageS: 0.5,
    disabledBy: null,
    disabledByWho: null,
    counters: { accepted: 10, refused: 2 },
    lagS: null,
    ...over,
  };
}

describe("sourceStateOf", () => {
  it("disabled beats every other state (B-11)", () => {
    for (const state of ["live", "stale", "down", "unknown"] as const) {
      expect(sourceStateOf(src({ state, disabledBy: "instance" }))).toBe(
        "disabled",
      );
    }
    expect(
      sourceStateOf(src({ state: "disabled", disabledBy: "type", ageS: null })),
    ).toBe("disabled");
  });

  it("maps every wire state, each to a distinct kit state", () => {
    expect(sourceStateOf(src({ state: "live" }))).toBe("healthy");
    expect(sourceStateOf(src({ state: "live", lagS: 12 }))).toBe("lagging");
    expect(sourceStateOf(src({ state: "live", lagS: 0 }))).toBe("healthy");
    expect(sourceStateOf(src({ state: "down" }))).toBe("unreachable");
    expect(sourceStateOf(src({ state: "stale" }))).toBe("stale");
    // B-09: unknown is never shown healthy.
    expect(sourceStateOf(src({ state: "unknown" }))).toBe("stale");
    expect(sourceStateOf(src({ state: "live", ageS: null }))).toBe(
      "never_heard",
    );
    expect(sourceStateOf(src({ state: "down", ageS: null }))).toBe(
      "never_heard",
    );
  });
});

describe("createSourceStore", () => {
  it("builds SourceViews from a status frame, with lastSeenAt on the server's clock", () => {
    const store = createSourceStore();
    store.applyStatus(
      [
        src({ sourceInstance: "rx-2", ageS: 4 }),
        src({ source: "adsb_rx", sourceInstance: null, ageS: null }),
        src({
          sourceInstance: "rx-1",
          state: "disabled",
          disabledBy: "instance",
          disabledByWho: "admin:test-1",
        }),
        src({ sourceInstance: null }),
      ],
      "2026-01-01T12:00:10.000Z",
      T0,
    );
    const v = store.snapshot();
    expect(v.map((x) => [x.sourceType, x.instanceId, x.state])).toEqual([
      ["adsb_rx", null, "never_heard"],
      ["direct_rid", null, "healthy"],
      ["direct_rid", "rx-1", "disabled"],
      ["direct_rid", "rx-2", "healthy"],
    ]);
    expect(v[0]?.lastSeenAt).toBeNull();
    expect(v[3]?.lastSeenAt).toBe("2026-01-01T12:00:06.000Z");
    expect(v[2]?.disabledByWho).toBe("admin:test-1");
    expect(v[3]?.accepted).toBe(10);
    expect(v[3]?.refused).toBe(2);
  });

  it("the age climbs between frames: the server's age plus the browser's leg", () => {
    const store = createSourceStore();
    store.applyStatus([src({ ageS: 3 })], "2026-01-01T12:00:00.000Z", T0);
    const v = store.snapshot()[0];
    if (v === undefined) throw new Error("no source");
    expect(sourceAgeS(v, T0)).toBe(3);
    expect(sourceAgeS(v, T0 + 57_000)).toBe(60);
    // A browser clock that stepped back does not make it younger.
    expect(sourceAgeS(v, T0 - 5000)).toBe(3);
    expect(sourceAgeS({ ageS: null, ageAtMs: T0 }, T0)).toBeNull();
  });

  it("counts a source that left the status, an unknown state, and the bound (E-10)", () => {
    const store = createSourceStore({ maxSources: 2 });
    store.applyStatus(
      [src({ sourceInstance: "a" }), src({ sourceInstance: "b" })],
      "2026-01-01T12:00:00.000Z",
      T0,
    );
    store.applyStatus(
      [
        src({ sourceInstance: "a", state: "unknown" }),
        src({ sourceInstance: "c" }),
        src({ sourceInstance: "d" }),
      ],
      "2026-01-01T12:00:02.000Z",
      T0 + 2000,
    );
    expect(store.snapshot().map((v) => v.instanceId)).toEqual(["a", "c"]);
    expect(store.counters()).toEqual({
      source_dropped_over_limit: 1,
      source_left_status: 1,
      source_state_unknown: 1,
    });
    expect(SOURCE_STORE_LIMIT).toBe(1000);
  });

  it("a server_ts that is not RFC 3339 UTC leaves lastSeenAt unknown, not guessed", () => {
    const store = createSourceStore();
    store.applyStatus([src({ ageS: 1 })], "2026-01-01 12:00:00", T0);
    expect(store.snapshot()[0]?.lastSeenAt).toBeNull();
  });
});

describe("the stores take the lab-derived views (WP-14)", () => {
  // The same stores, fed what the lab's schema examples decode to through
  // the reference adapters (src/test/fixtures.lab.test.ts lists them).
  const lab = fixtures({ source: "lab" });

  it("hold every lab track and manned aircraft, dropping none", () => {
    const tracks = createTrackStore({ trailPoints: 5, maxTracks: 100 });
    for (const t of lab.tracks) tracks.upsert(omit(t, "receivedAtMs"));
    expect([...tracks.snapshot().keys()].sort()).toEqual(
      lab.tracks.map((t) => t.trackId).sort(),
    );
    expect(tracks.counters().track_evicted).toBe(0);
    const manned = createMannedStore({ trailPoints: 1, maxTracks: 100 });
    for (const m of lab.manned) manned.upsert(omit(m, "receivedAtMs"));
    expect(manned.snapshot().size).toBe(lab.manned.length);
  });

  it("hold every lab alert with its state and clear reason", () => {
    const store = createAlertStore();
    for (const a of lab.alerts)
      store.apply(omit(a, "receivedAtMs", "acknowledged"));
    for (const a of lab.alerts) {
      const held = store.get(a.alertId);
      expect(held?.state, a.alertId).toBe(a.state);
      expect(held?.clearReason, a.alertId).toBe(a.clearReason);
    }
  });
});
