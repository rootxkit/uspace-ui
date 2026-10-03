// The feed client against the in-process mock server (WP-8 tests; PLAN
// §9): the success path read word by word (E-02), backoff on fake timers,
// 4401 once per outage and its normal-close twin, no token in any URL,
// a hundred reconnects, malformed frames counted with the next good one
// applied, subscribe re-sent, snapshot replacement with its pair, ten
// quiet minutes, and the three recorded sequences.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ageS } from "./time.js";
import { createAlertStore } from "./alertStore.js";
import { DEFAULT_BACKOFF } from "./backoff.js";
import { FeedClient, resolveFeedUrl, type FeedOptions } from "./client.js";
import { liveCounters, resetLiveCountersForTests } from "./counters.js";
import { parseFrame, subscribeFrame, type ConsoleFrame } from "./frame.js";
import { createSourceStore, sourceAgeS } from "./sourceStore.js";
import { createTrackStore } from "./trackStore.js";
import { adaptAlert, adaptTrack } from "./test/adapters.js";
import {
  labExample,
  loadSequence,
  MockSocket,
  MockWsServer,
} from "./test/mock-server.js";

const PAGE = "https://console.example.test/map";
const WS_URL = "wss://console.example.test/v1/picture/ws";
const STATUS = "console/status/v1/examples/authority-picture.json";
const SNAPSHOT = "console/snapshot/v1/examples/authority-picture.json";
// The lab examples' `server_ts`; the fake clock starts there.
const SERVER_MS = Date.UTC(2026, 9, 2, 9, 15, 6);

let server: MockWsServer;
let client: FeedClient | null = null;

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SERVER_MS);
  vi.stubGlobal("location", { href: PAGE });
  resetLiveCountersForTests();
  server = new MockWsServer().install();
});

afterEach(() => {
  client?.stop();
  client = null;
  // E-11: no timer left behind by the client.
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

function start(extra: Partial<FeedOptions> = {}): {
  client: FeedClient;
  frames: ConsoleFrame[];
} {
  const frames: ConsoleFrame[] = [];
  const c = new FeedClient({
    url: "/v1/picture/ws",
    onFrame: (f) => frames.push(f),
    random: () => 1,
    ...extra,
  });
  client = c;
  c.start();
  return { client: c, frames };
}

describe("the success path (E-02)", () => {
  it("connect, status frame: live, with every field of the frame", () => {
    const sources = createSourceStore();
    const { client: c } = start({ stores: { sources } });
    expect(c.getStatus().connection).toBe("connecting");
    server.accept();
    // Open is not live: no status frame yet.
    expect(c.getStatus().connection).toBe("connecting");
    vi.advanceTimersByTime(250);
    server.send(labExample(STATUS));
    const s = c.getStatus();
    expect(s.connection).toBe("live");
    expect(s.sinceMs).toBe(SERVER_MS + 250);
    expect(s.policyVersion).toBe("demo-2026-10-01");
    expect(s.staleAfterS).toBe(5);
    expect(s.liveMaxAgeS).toBe(2);
    expect(s.droppedFrames).toBe(0);
    expect(s.degraded).toEqual([]);
    expect(s.serverTs).toBe("2026-10-02T09:15:06.000Z");
    expect(s.connectionId).toBe("c-7f3a91");
    // server_ts is 250 ms behind the browser here.
    expect(s.clockOffsetMs).toBe(-250);
    expect(s.lastStatusAtMs).toBe(SERVER_MS + 250);
    expect(s.unauthorized).toBe(false);
    expect(s.extras).toEqual({
      datasets: null,
      cisVersion: null,
      cisAgeS: 14,
      projectionAgeS: 1.2,
      dpState: "polling",
      nats: "connected",
      resyncSince: null,
    });
    const views = sources.snapshot();
    expect(views.map((v) => [v.sourceType, v.instanceId, v.state])).toEqual([
      ["direct_rid", "rx-tbs-01", "healthy"],
      ["network_rid", "ussp-peer-ge-02", "disabled"],
    ]);
    expect(views[1]?.disabledByWho).toBe("admin:n.beridze");
    expect(server.current.url).toBe(WS_URL);
  });

  it("a status frame is the only way to live: snapshot and others leave it connecting", () => {
    const { client: c } = start();
    server.accept();
    server.send(labExample(SNAPSHOT));
    server.send(labExample("envelope/v1/examples/cis-change-frame.json"));
    expect(c.getStatus().connection).toBe("connecting");
    expect(c.getStatus().lastFrameAtMs).toBe(SERVER_MS);
  });

  it("notifies subscribers on every change and stops when unsubscribed", () => {
    const { client: c } = start();
    const fn = vi.fn();
    const off = c.subscribe(fn);
    server.accept();
    server.send(labExample(STATUS));
    expect(fn).toHaveBeenCalled();
    const calls = fn.mock.calls.length;
    off();
    server.send(labExample(STATUS));
    expect(fn.mock.calls.length).toBe(calls);
  });
});

describe("reconnect with backoff (B-08)", () => {
  it("down on close, then retries at 1, 2, 4, 8, 16, 30, 30 s (jitter at its top)", async () => {
    const { client: c } = start();
    server.refuse();
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      const s = c.getStatus();
      expect(s.connection).toBe("down");
      const delay = (s.nextRetryAtMs ?? 0) - Date.now();
      delays.push(delay);
      const before = server.sockets.length;
      await advance(delay - 1);
      expect(server.sockets.length).toBe(before);
      await advance(1);
      expect(server.sockets.length).toBe(before + 1);
      expect(c.getStatus().connection).toBe("connecting");
      server.refuse();
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect(c.getStatus().attempt).toBe(8);
  });

  it("seeded jitter stays within half to all of each ceiling", async () => {
    // mulberry32, seeded: the same sequence on every run.
    let seed = 42;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const { client: c } = start({ random });
    const delays: number[] = [];
    for (let i = 0; i < 8; i++) {
      server.refuse();
      const delay = (c.getStatus().nextRetryAtMs ?? 0) - Date.now();
      delays.push(delay);
      await advance(delay);
    }
    server.refuse();
    const ceilings = [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000];
    delays.forEach((d, i) => {
      const c0 = ceilings[i] ?? 0;
      expect(d).toBeGreaterThanOrEqual(c0 / 2);
      expect(d).toBeLessThanOrEqual(c0);
    });
    // Jittered: not all at the top.
    expect(delays.some((d, i) => d < (ceilings[i] ?? 0))).toBe(true);
  });

  it("a connection that stayed live 10 s starts again from 1 s; a short one does not", async () => {
    const { client: c } = start();
    server.refuse();
    await advance(1000);
    server.refuse();
    await advance(2000);
    server.accept();
    server.send(labExample(STATUS));
    await advance(3000);
    server.close(1011);
    // Live for 3 s only: the run goes on (attempt 2 -> 4 s).
    expect((c.getStatus().nextRetryAtMs ?? 0) - Date.now()).toBe(4000);
    await advance(4000);
    server.accept();
    server.send(labExample(STATUS));
    await advance(10_000);
    server.close(1011);
    expect((c.getStatus().nextRetryAtMs ?? 0) - Date.now()).toBe(1000);
  });

  it("never gives up: 100 reconnects in a row, each one attempted", async () => {
    const { client: c } = start();
    for (let i = 0; i < 100; i++) {
      server.refuse();
      const delay = (c.getStatus().nextRetryAtMs ?? 0) - Date.now();
      expect(delay).toBeLessThanOrEqual(DEFAULT_BACKOFF.maxMs);
      await advance(delay);
    }
    expect(server.sockets.length).toBe(101);
    expect(c.getStatus().connection).toBe("connecting");
    expect(liveCounters().connect_attempts).toBe(101);
    // And it still goes live when the server comes back.
    server.accept();
    server.send(labExample(STATUS));
    expect(c.getStatus().connection).toBe("live");
  });

  it("stop() ends the retries and leaves no timer", async () => {
    const { client: c } = start();
    server.refuse();
    c.stop();
    await advance(60_000);
    expect(server.sockets.length).toBe(1);
  });

  it("start() after stop() connects again (React's double effect)", () => {
    const { client: c } = start();
    c.stop();
    expect(server.sockets[0]?.closedByClient).toBe(1000);
    c.start();
    expect(server.sockets.length).toBe(2);
    server.accept();
    server.send(labExample(STATUS));
    expect(c.getStatus().connection).toBe("live");
  });
});

describe("4401: the session is gone", () => {
  it("calls onUnauthorized once per outage, goes down, and keeps retrying", async () => {
    const onUnauthorized = vi.fn();
    const { client: c } = start({ onUnauthorized });
    server.accept();
    server.send(labExample(STATUS));
    server.close(4401, "session expired");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(c.getStatus().connection).toBe("down");
    expect(c.getStatus().unauthorized).toBe(true);
    await advance(1000);
    expect(server.sockets.length).toBe(2);
    // The next upgrade is refused with 4401 as well: same outage.
    server.close(4401);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await advance(2000);
    expect(server.sockets.length).toBe(3);
    // The app re-logged in; the cookie is new; no reload.
    server.accept();
    server.send(labExample(STATUS));
    expect(c.getStatus().connection).toBe("live");
    expect(c.getStatus().unauthorized).toBe(false);
    // A later expiry is a new outage.
    server.close(4401);
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
    expect(liveCounters().unauthorized).toBe(3);
  });

  it("a normal close does not call it (the pair)", async () => {
    const onUnauthorized = vi.fn();
    const { client: c } = start({ onUnauthorized });
    server.accept();
    server.send(labExample(STATUS));
    server.close(1000);
    await advance(1000);
    server.close(1011);
    await advance(2000);
    server.refuse(1006);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(c.getStatus().unauthorized).toBe(false);
    expect(c.getStatus().connection).toBe("down");
  });

  it("an onUnauthorized that throws does not stop the retries", async () => {
    start({
      onUnauthorized: () => {
        throw new Error("app bug");
      },
    });
    server.close(4401);
    await advance(1000);
    expect(server.sockets.length).toBe(2);
  });

  it("replays the recorded session expiry to live without a reload", async () => {
    const onUnauthorized = vi.fn();
    const tracks = createTrackStore({ trailPoints: 10, maxTracks: 100 });
    const { client: c } = start({
      onUnauthorized,
      stores: { tracks: { store: tracks, adapt: adaptTrack } },
    });
    await server.replay(loadSequence("session-expiry-4401"), advance);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(c.getStatus().connection).toBe("live");
    expect(server.sockets.length).toBe(3);
    expect(tracks.snapshot().size).toBe(2);
  });
});

describe("the URL: same origin, the cookie, no token (M22)", () => {
  it("every socket the client opens has the same URL, without a query or protocols", async () => {
    const { client: c } = start();
    for (let i = 0; i < 5; i++) {
      server.refuse();
      await advance((c.getStatus().nextRetryAtMs ?? 0) - Date.now());
    }
    server.close(4401);
    await advance((c.getStatus().nextRetryAtMs ?? 0) - Date.now());
    expect(server.sockets.length).toBe(7);
    for (const s of server.sockets) {
      expect(s.url).toBe(WS_URL);
      expect(new URL(s.url).search).toBe("");
      expect(s.protocols).toBeUndefined();
    }
  });

  it("a URL function is read on every attempt", async () => {
    const url = vi.fn(() => Promise.resolve("/v1/picture/ws"));
    start({ url });
    await advance(0);
    expect(server.sockets.length).toBe(1);
    server.refuse();
    await advance(1000);
    expect(url).toHaveBeenCalledTimes(2);
    expect(server.urls).toEqual([WS_URL, WS_URL]);
  });

  it("refuses a URL with a token, credentials or another origin, and retries", async () => {
    for (const bad of [
      "/v1/picture/ws?token=abc",
      "/v1/picture/ws?ticket=abc",
      "wss://user:pw@console.example.test/ws",
      "wss://other.example.test/ws",
      "/ws#jwt",
    ]) {
      resetLiveCountersForTests();
      const { client: c } = start({ url: bad });
      expect(server.sockets.length).toBe(0);
      expect(liveCounters().url_refused).toBe(1);
      expect(c.getStatus().connection).toBe("down");
      await advance(1000);
      expect(liveCounters().url_refused).toBe(2);
      c.stop();
    }
  });

  it("resolveFeedUrl matches the scheme and accepts a plain same-origin path (the pair)", () => {
    expect(resolveFeedUrl("/ws?bbox=1", "http://localhost:3000/")).toEqual({
      url: "ws://localhost:3000/ws?bbox=1",
    });
    expect(resolveFeedUrl("ftp://x/ws", undefined)).toEqual({
      refused: "scheme",
    });
    expect(resolveFeedUrl("/ws", undefined)).toEqual({
      refused: "unresolvable",
    });
    // Without a page there is no origin to hold an absolute URL to: refused
    // rather than accepted unchecked (retro-audit N8).
    expect(resolveFeedUrl("wss://a.example.test/ws", undefined)).toEqual({
      refused: "no_page",
    });
    expect(resolveFeedUrl("ws://console.example.test/ws", PAGE)).toEqual({
      refused: "cross_origin",
    });
  });

  it("refuses an absolute URL when the page URL is unknown, and opens no socket (retro-audit N8)", () => {
    vi.stubGlobal("location", undefined);
    const { client: c } = start({ url: WS_URL });
    expect(server.sockets.length).toBe(0);
    expect(liveCounters().url_refused).toBe(1);
    expect(c.getStatus().connection).toBe("down");
  });

  it("opens the same absolute URL once the page is known (the twin)", () => {
    const { client: c } = start({ url: WS_URL });
    expect(server.sockets.length).toBe(1);
    expect(server.urls).toEqual([WS_URL]);
    expect(liveCounters().url_refused).toBe(0);
    expect(c.getStatus().connection).toBe("connecting");
  });

  it("a URL function that rejects, and a constructor that throws, are retried", async () => {
    const { client: c } = start({ url: () => Promise.reject(new Error("x")) });
    await advance(0);
    expect(liveCounters().connect_failed).toBe(1);
    expect(c.getStatus().connection).toBe("down");
    c.stop();
    vi.stubGlobal("WebSocket", function Throwing() {
      throw new SyntaxError("bad");
    });
    const second = start();
    expect(liveCounters().connect_failed).toBe(2);
    await advance(1000);
    expect(liveCounters().connect_failed).toBe(3);
    second.client.stop();
  });
});

describe("frames", () => {
  it("a malformed frame is counted and dropped; the next good one applies", () => {
    const { client: c, frames } = start();
    server.accept();
    server.send("not json");
    server.send({ ...labExample(STATUS), msg_id: undefined });
    server.send({ ...labExample(STATUS), backlog: "false" });
    server.current.onmessage?.({ data: new ArrayBuffer(4) } as MessageEvent);
    expect(liveCounters().frames_malformed).toBe(4);
    expect(c.getStatus().framesMalformed).toBe(4);
    expect(c.getStatus().connection).toBe("connecting");
    server.send(labExample(STATUS));
    expect(c.getStatus().connection).toBe("live");
    expect(frames).toEqual([]);
  });

  it("a status frame that breaks the schema is not applied, and counted", () => {
    const { client: c } = start();
    server.accept();
    for (const name of [
      "missing-stale-after-s",
      "zero-live-max-age-s",
      "negative-dropped-frames",
      "source-without-state",
      "dataset-without-age",
    ]) {
      server.send(
        labExample(`console/status/v1/examples/invalid/${name}.json`),
      );
    }
    expect(liveCounters().status_malformed).toBe(5);
    expect(c.getStatus().connection).toBe("connecting");
    expect(c.getStatus().staleAfterS).toBeNull();
  });

  it("anything else goes to onFrame untouched and is counted unhandled", () => {
    const { client: c, frames } = start();
    server.accept();
    const raw = labExample("envelope/v1/examples/cis-change-frame.json");
    server.send(raw);
    // The retired schema name is not a status frame (M12).
    server.send(
      labExample(
        "console/status/v1/examples/invalid/feed-status-schema-name.json",
      ),
    );
    expect(frames.map((f) => f.schema)).toEqual([
      "cis/change/v1",
      "feed/status/v1",
    ]);
    expect(frames[0]).toEqual(parseFrame(raw));
    expect(liveCounters().frames_unhandled).toBe(2);
    expect(c.getStatus().framesUnhandled).toBe(2);
  });

  it("an onFrame that throws does not end the feed", () => {
    const { client: c } = start({
      onFrame: () => {
        throw new Error("adapter bug");
      },
    });
    server.accept();
    server.send(labExample("envelope/v1/examples/cis-change-frame.json"));
    server.send(labExample(STATUS));
    expect(c.getStatus().connection).toBe("live");
  });

  it("a status frame with resync_since also goes to onFrame; one without does not (pair)", () => {
    const { client: c, frames } = start();
    server.accept();
    server.send(labExample(STATUS));
    expect(frames).toEqual([]);
    server.send(labExample("console/status/v1/examples/cisp-resync.json"));
    expect(frames.map((f) => f.schema)).toEqual(["console/status/v1"]);
    const s = c.getStatus();
    expect(s.extras.resyncSince).toBe("2026-10-02T09:10:00.000Z");
    expect(s.extras.datasets).toEqual({
      zones: { version: "zones-2026-10-02-0007", ageS: 812.5 },
      uspace_airspace: { version: "uspace-2026-09-30-0002", ageS: 160233 },
    });
    expect(s.droppedFrames).toBe(3);
    expect(s.degraded).toEqual(["publisher_stale"]);
  });
});

describe("subscribe (console/subscribe/v1)", () => {
  it("is sent on open and again on every reconnect", async () => {
    const { client: c } = start();
    const frame = subscribeFrame(
      [44.6, 41.6, 45.0, 41.85],
      ["tracks", "alerts", "zones"],
    );
    c.send(frame);
    server.accept();
    expect(server.current.sent.map((s) => JSON.parse(s) as unknown)).toEqual([
      labExample("console/subscribe/v1/examples/city-viewport.json"),
    ]);
    server.close(1011);
    await advance(1000);
    server.accept();
    expect(server.current.sent).toHaveLength(1);
    expect(server.sockets.map((s) => s.sent.length)).toEqual([1, 1]);
  });

  it("is sent at once on an open socket; a newer one before open supersedes", () => {
    const { client: c } = start();
    c.send(subscribeFrame([40, 41, 46.7, 43.6], ["tracks"]));
    c.send(subscribeFrame([40, 41, 46.7, 43.6], ["tracks", "manned"]));
    expect(liveCounters().subscribe_superseded).toBe(1);
    server.accept();
    expect(server.current.sent).toHaveLength(1);
    c.send(subscribeFrame([44, 41, 45, 42], []));
    expect(server.current.sent).toHaveLength(2);
    expect(JSON.parse(server.current.sent[1] ?? "")).toEqual({
      schema: "console/subscribe/v1",
      body: { bbox: [44, 41, 45, 42], layers: [] },
    });
  });
});

describe("snapshot (console/snapshot/v1, C-08)", () => {
  it("replaces the stores: a track absent is removed as resolved, one present is kept", () => {
    const tracks = createTrackStore({ trailPoints: 10, maxTracks: 100 });
    const alerts = createAlertStore();
    // Held before the snapshot: one the snapshot has, one it does not.
    const present = adaptTrack(
      parseFrame(
        (labExample(SNAPSHOT)["body"] as { tracks: unknown[] }).tracks[0],
      ) as ConsoleFrame,
    );
    if (present === null) throw new Error("fixture");
    tracks.upsert(present);
    tracks.upsert({ ...present, trackId: "TEST-GONE-1" });
    const { client: c } = start({
      stores: {
        tracks: { store: tracks, adapt: adaptTrack },
        alerts: { store: alerts, adapt: adaptAlert },
      },
    });
    server.accept();
    server.send(labExample(SNAPSHOT));
    expect([...tracks.snapshot().keys()].sort()).toEqual([
      "authority-1:rid:4A:7C:91:0E:22:B5",
      "ussp-1:FL-2026-000417",
    ]);
    expect(tracks.recentlyRemoved()).toEqual([
      { trackId: "TEST-GONE-1", reason: "resolved", atMs: SERVER_MS },
    ]);
    // C-08: the replayed alert is shown, not de-duplicated away.
    expect([...alerts.snapshot().keys()]).toEqual(["v-2026-00031"]);
    expect(c.getStatus().zonesVersion).toBe("zones-2026-10-02-0007");
    alerts.dispose();
  });

  it("counts a collection with no store, an item the adapter refuses, and a malformed item", () => {
    const tracks = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    start({
      stores: { tracks: { store: tracks, adapt: () => null } },
    });
    server.accept();
    const snap = labExample(SNAPSHOT);
    const body = snap["body"] as Record<string, unknown[]>;
    server.send({
      ...snap,
      body: { ...body, manned: [...(body["manned"] ?? []), { nope: 1 }] },
    });
    expect(liveCounters().snapshot_item_unadapted).toBe(2);
    // alerts and manned have items and no store.
    expect(liveCounters().snapshot_collection_unstored).toBe(2);
    expect(liveCounters().snapshot_item_malformed).toBe(1);
    expect(tracks.snapshot().size).toBe(0);
  });

  it("a snapshot that breaks the schema is not applied", () => {
    const tracks = createTrackStore({ trailPoints: 0, maxTracks: 10 });
    start({ stores: { tracks: { store: tracks, adapt: adaptTrack } } });
    server.accept();
    server.send(
      labExample(
        "console/snapshot/v1/examples/invalid/missing-zones-version.json",
      ),
    );
    expect(liveCounters().snapshot_malformed).toBe(1);
    expect(tracks.snapshot().size).toBe(0);
  });
});

describe("quiet but healthy (E-02)", () => {
  it("ten minutes live with no frames: still live, and every age climbs", async () => {
    const tracks = createTrackStore({ trailPoints: 10, maxTracks: 100 });
    const sources = createSourceStore();
    const { client: c } = start({
      stores: { sources, tracks: { store: tracks, adapt: adaptTrack } },
    });
    server.accept();
    server.send(labExample(STATUS));
    server.send(labExample(SNAPSHOT));
    const t0 = Date.now();
    await advance(600_000);
    const now = Date.now();
    const s = c.getStatus();
    expect(s.connection).toBe("live");
    expect(s.sinceMs).toBe(t0);
    expect((now - (s.lastFrameAtMs ?? 0)) / 1000).toBe(600);
    for (const t of tracks.snapshot().values()) {
      expect(ageS(t, now)).toBe(600);
      // On the server's clock: captured 09:15:03.214 and 09:15:04.000.
      expect(ageS(t, now, "captured", s.clockOffsetMs)).toBeGreaterThan(600);
    }
    const rx = sources.snapshot().find((v) => v.instanceId === "rx-tbs-01");
    expect(rx === undefined ? null : sourceAgeS(rx, now)).toBeCloseTo(600.4, 6);
    expect(server.sockets.length).toBe(1);
  });

  it("replays the recorded 60 s silence: live throughout, last frame 60 s old", async () => {
    const { client: c } = start();
    const seq = loadSequence("silence-60s");
    // Up to the silence, then through it, then the rest.
    const cut = seq.steps.findIndex((s) => s.op === "wait");
    await server.replay({ ...seq, steps: seq.steps.slice(0, cut) }, advance);
    expect(c.getStatus().connection).toBe("live");
    const seen: string[] = [];
    c.subscribe(() => seen.push(c.getStatus().connection));
    await server.replay({ ...seq, steps: [seq.steps[cut] as never] }, advance);
    const s = c.getStatus();
    expect(s.connection).toBe("live");
    expect(Date.now() - (s.lastFrameAtMs ?? 0)).toBe(60_000);
    await server.replay({ ...seq, steps: seq.steps.slice(cut + 1) }, advance);
    expect(c.getStatus().lastFrameAtMs).toBe(Date.now());
    // Never left live, and the socket was never reopened.
    expect(seen.every((x) => x === "live")).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
    expect(server.current.readyState).toBe(MockSocket.OPEN);
    expect(server.sockets).toHaveLength(1);
  });
});

describe("backlog burst (T-04)", () => {
  it("draws the backlog as history: trail only, never the live position", async () => {
    const tracks = createTrackStore({ trailPoints: 60, maxTracks: 100 });
    start({
      onFrame: (f) => {
        const t = adaptTrack(f);
        if (t !== null) tracks.upsert(t);
      },
    });
    await server.replay(loadSequence("backlog-burst"), advance);
    const id = "authority:rid:1581F5FJD239C00DW1B5";
    const view = tracks.get(id);
    expect(view?.times.backlog).toBe(false);
    expect(view?.times.capturedAt).toBe("2026-10-02T09:16:21.000Z");
    expect(view?.lat).toBe(41.7322);
    expect(tracks.trail(id)).toHaveLength(10);
    expect(tracks.counters().backlog_to_trail).toBe(8);
  });
});
