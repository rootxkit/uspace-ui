// The age a track is drawn with (review 2026-11-12, F1): it counts from
// the observation, never from the last time the same observation was
// delivered again. Each "does not age" below has its twin that ages, and
// each "stays live" its twin that leaves live (E-01, E-02).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "../i18n/translate.js";
import { TrackHold, trackFeatureCollection } from "../layers/trackFeatures.js";
import type { TrackView } from "../model/index.js";
import { freshnessBucket } from "../symbology/age.js";
import { fixtures } from "../test/fixtures.js";
import { omit } from "./test/omit.js";
import { ageS, observedAge, observedAgeS } from "./time.js";
import { createMannedStore, createTrackStore } from "./trackStore.js";

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
// The policy value these tests pass as the feed's `stale_after_s`.
const STALE_AFTER_S = 30;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

type Sample = Omit<TrackView, "receivedAtMs">;

const iso = (ms: number): string => new Date(ms).toISOString();

function sample(capturedAtMs: number, over: Partial<Sample> = {}): Sample {
  const base = fixtures().tracks[0];
  if (base === undefined) throw new Error("fixtures");
  return {
    ...omit(base, "receivedAtMs"),
    trackId: "TEST-A",
    times: {
      ...base.times,
      capturedAt: iso(capturedAtMs),
      backlog: false,
    },
    ...over,
  };
}

const t = createTranslator("en");

/** The bucket the map draws the store's track with, as TrackLayer does. */
function drawn(
  views: Iterable<TrackView>,
  clockOffsetMs: number | null = null,
): string | undefined {
  const hold = new TrackHold();
  hold.apply([...views], 0);
  const fc = trackFeatureCollection(hold, {
    nowMs: Date.now(),
    staleAfterS: STALE_AFTER_S,
    clockOffsetMs,
    selectedId: null,
    t,
  });
  const point = fc.features.find((f) => f.properties.kind === "track");
  return point?.properties.age;
}

describe("the same sample delivered again (F1)", () => {
  it("ages to stale although the server re-sends it every 20 s for 120 s", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    const s = sample(T0);
    store.replace([s]);
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(20_000);
      // The USSP keeps a silent track in its product; the console
      // replaces the store on every product.
      store.replace([s]);
      seen.push(drawn(store.snapshot().values()));
    }
    // 20 s: aging (10 s is a third of 30 s); from 40 s on: stale.
    expect(seen).toEqual([
      "aging",
      "stale",
      "stale",
      "stale",
      "stale",
      "stale",
    ]);
    const v = store.get("TEST-A");
    expect(v === undefined ? null : observedAgeS(v, Date.now())).toBe(120);
    // What `receivedAtMs` is: the last delivery, on the browser clock.
    expect(v?.receivedAtMs).toBe(T0 + 120_000);
    expect(v?.sampleReceivedAtMs).toBe(T0);
  });

  it("upsert of an unchanged sample does not make it younger either", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    const s = sample(T0);
    store.upsert(s);
    vi.advanceTimersByTime(45_000);
    store.upsert({ ...s, emergency: true });
    expect(store.get("TEST-A")?.emergency).toBe(true);
    expect(drawn(store.snapshot().values())).toBe("stale");
  });

  it("a track that is updated stays live (the twin)", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    const seen: (string | undefined)[] = [];
    for (let i = 0; i <= 6; i++) {
      store.replace([sample(Date.now())]);
      seen.push(drawn(store.snapshot().values()));
      vi.advanceTimersByTime(20_000);
    }
    expect(seen.every((b) => b === "live")).toBe(true);
    expect(seen).toHaveLength(7);
  });

  it("a newer sample after a stale one is live again (recovery)", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    store.replace([sample(T0)]);
    vi.advanceTimersByTime(60_000);
    store.replace([sample(T0)]);
    expect(drawn(store.snapshot().values())).toBe("stale");
    store.replace([sample(Date.now())]);
    expect(drawn(store.snapshot().values())).toBe("live");
    expect(store.get("TEST-A")?.sampleReceivedAtMs).toBe(T0 + 60_000);
  });

  it("a capture time that cannot be ordered is the same sample only as the same text", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    const odd = (capturedAt: string): Sample => {
      const s = sample(T0);
      return { ...s, times: { ...s.times, capturedAt } };
    };
    store.replace([odd("not-a-time")]);
    vi.advanceTimersByTime(40_000);
    store.replace([odd("not-a-time")]);
    expect(store.get("TEST-A")?.sampleReceivedAtMs).toBe(T0);
    expect(drawn(store.snapshot().values())).toBe("stale");
    // The twin: another text is another sample, whatever its order.
    store.replace([odd("not-a-time-either")]);
    expect(store.get("TEST-A")?.sampleReceivedAtMs).toBe(T0 + 40_000);
    expect(store.counters().track_time_unordered).toBe(2);
    expect(drawn(store.snapshot().values())).toBe("live");
  });

  it("the manned store keeps the first receipt of a sample as well", () => {
    const store = createMannedStore({ trailPoints: 0, maxTracks: 10 });
    const base = fixtures().manned[0];
    if (base === undefined) throw new Error("fixtures");
    const m = omit(base, "receivedAtMs");
    store.replace([m]);
    vi.advanceTimersByTime(50_000);
    store.replace([m]);
    const v = store.get(m.trackId);
    expect(v?.sampleReceivedAtMs).toBe(T0);
    expect(v?.receivedAtMs).toBe(T0 + 50_000);
  });
});

describe("a sample that arrives already old (F1)", () => {
  it("does not start life as live when the feed gave the clock offset", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    // Captured 45 s ago on the server's clock; the clocks agree.
    store.replace([sample(T0 - 45_000)]);
    expect(drawn(store.snapshot().values(), 0)).toBe("stale");
    const v = store.get("TEST-A") as TrackView;
    expect(observedAge(v, Date.now(), 0)).toEqual({
      ageS: 45,
      basis: "captured",
    });
    // The received age alone would have said 0 s.
    expect(ageS(v, Date.now())).toBe(0);
  });

  it("a fresh sample with the same offset starts live (the twin)", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    store.replace([sample(T0 - 1000)]);
    expect(drawn(store.snapshot().values(), 0)).toBe("live");
  });

  it("does not start life as live when the server sent its age", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    store.replace([sample(T0, { serverAgeS: 45 })]);
    // No offset: the server's own age is enough.
    expect(drawn(store.snapshot().values())).toBe("stale");
    vi.advanceTimersByTime(5000);
    const v = store.get("TEST-A") as TrackView;
    // Counted on from the receipt of the frame that carried it.
    expect(observedAge(v, Date.now())).toEqual({ ageS: 50, basis: "server" });
  });
});

describe("clock skew between the server and the browser", () => {
  // The browser clock is five minutes ahead of the server's.
  const OFFSET_MS = -300_000;

  it("a fresh sample is live although the browser clock is 5 min ahead", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    // Captured 1 s ago on the server's clock.
    store.replace([sample(T0 + OFFSET_MS - 1000)]);
    const v = store.get("TEST-A") as TrackView;
    expect(observedAgeS(v, Date.now(), OFFSET_MS)).toBe(1);
    expect(drawn(store.snapshot().values(), OFFSET_MS)).toBe("live");
    // The browser clock read against `capturedAt` would say 301 s.
    expect((Date.now() - Date.parse(v.times.capturedAt)) / 1000).toBe(301);
  });

  it("an old sample is stale although the browser clock is 5 min behind", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    // Server clock 5 min ahead of the browser; captured 45 s ago there.
    store.replace([sample(T0 + 300_000 - 45_000)]);
    expect(drawn(store.snapshot().values(), 300_000)).toBe("stale");
  });

  it("a capture time ahead of the server's clock never gives a negative age", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    store.replace([sample(T0 + 90_000)]);
    vi.advanceTimersByTime(4000);
    const v = store.get("TEST-A") as TrackView;
    // The received basis is the floor: 4 s since it first arrived.
    expect(observedAge(v, Date.now(), 0)).toEqual({
      ageS: 4,
      basis: "received",
    });
  });

  it("without an offset or a server age the floor is the first receipt", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    store.replace([sample(T0 - 45_000)]);
    vi.advanceTimersByTime(12_000);
    const v = store.get("TEST-A") as TrackView;
    // The bounded error: the 45 s the sample was old on arrival are not
    // known here, so the age is 12 s, never less.
    expect(observedAge(v, Date.now())).toEqual({ ageS: 12, basis: "received" });
    expect(observedAge(v, Date.now(), Number.NaN)).toEqual({
      ageS: 12,
      basis: "received",
    });
  });

  it("no usable time at all is null, never a zero", () => {
    expect(
      observedAgeS({ receivedAtMs: Number.NaN }, Date.now(), null),
    ).toBeNull();
  });
});

describe("the server's own state (F1; CLAUDE.md rule 2)", () => {
  it("is carried on the view by the store", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    store.replace([sample(T0, { serverState: "stale", serverAgeS: 61.5 })]);
    const v = store.get("TEST-A");
    expect(v?.serverState).toBe("stale");
    expect(v?.serverAgeS).toBe(61.5);
  });

  it("wins over a local age that looks fresher", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    // A new capture time, received just now: locally 0 s old.
    store.replace([sample(T0, { serverState: "stale" })]);
    expect(drawn(store.snapshot().values(), 0)).toBe("stale");
    store.replace([sample(T0 + 1, { serverState: "source_disabled" })]);
    expect(drawn(store.snapshot().values(), 0)).toBe("stale");
  });

  it("a server that says live does not hold back a local age past the threshold", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    const s = sample(T0, { serverState: "live", serverAgeS: 0 });
    store.replace([s]);
    expect(drawn(store.snapshot().values(), 0)).toBe("live");
    // The feed stops; nothing says stale; the age does.
    vi.advanceTimersByTime(31_000);
    expect(drawn(store.snapshot().values(), 0)).toBe("stale");
  });

  it("clears when the server says live again with a new sample (recovery)", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    store.replace([sample(T0, { serverState: "stale", serverAgeS: 90 })]);
    expect(drawn(store.snapshot().values(), 0)).toBe("stale");
    vi.advanceTimersByTime(2000);
    store.replace([
      sample(Date.now(), { serverState: "live", serverAgeS: 0.2 }),
    ]);
    expect(drawn(store.snapshot().values(), 0)).toBe("live");
  });

  it("freshnessBucket: stale from the server even without a threshold", () => {
    expect(freshnessBucket(0, Number.NaN, "stale")).toBe("stale");
    expect(freshnessBucket(0, Number.NaN, "source_disabled")).toBe("stale");
    // The pair: nothing from the server, no threshold: not placed.
    expect(freshnessBucket(0, Number.NaN, null)).toBe("unknown");
    expect(freshnessBucket(0, Number.NaN, "live")).toBe("unknown");
    expect(freshnessBucket(0, 30)).toBe("live");
    expect(freshnessBucket(12, 30, "live")).toBe("aging");
    expect(freshnessBucket(30, 30, "live")).toBe("stale");
  });
});
