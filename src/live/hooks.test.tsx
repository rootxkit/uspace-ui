// The React hooks of `live` (WP-8): useFeed goes live on a status frame
// and back down on a close, sends subscribe frames, closes its socket on
// unmount; useStore re-renders on a store change and not without one;
// useNowMs ticks on its period and stops on unmount (E-11).
import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLiveCountersForTests } from "./counters.js";
import { subscribeFrame } from "./frame.js";
import { useFeed, useNowMs, useStore } from "./hooks.js";
import { createTrackStore } from "./trackStore.js";
import { labExample, MockWsServer } from "./test/mock-server.js";

const T0 = Date.UTC(2026, 9, 2, 9, 15, 6);
let server: MockWsServer;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.stubGlobal("location", { href: "https://console.example.test/" });
  resetLiveCountersForTests();
  server = new MockWsServer().install();
});

afterEach(() => {
  cleanup();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

describe("useFeed", () => {
  it("starts connecting, goes live on a status frame, down on a close", () => {
    const onFrame = vi.fn();
    const { result } = renderHook(() =>
      useFeed({ url: "/ws", onFrame, random: () => 1 }),
    );
    expect(result.current.connection).toBe("connecting");
    act(() => {
      server.accept();
      server.send(
        labExample("console/status/v1/examples/authority-picture.json"),
      );
    });
    expect(result.current.connection).toBe("live");
    expect(result.current.staleAfterS).toBe(5);
    act(() => {
      server.close(1011);
    });
    expect(result.current.connection).toBe("down");
    expect(result.current.nextRetryAtMs).toBe(T0 + 1000);
  });

  it("send() goes out on the open socket; the latest onFrame is the one called", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ onFrame }) => useFeed({ url: "/ws", onFrame }),
      { initialProps: { onFrame: first } },
    );
    act(() => {
      server.accept();
    });
    act(() => {
      result.current.send(subscribeFrame([44, 41, 45, 42], ["tracks"]));
    });
    expect(server.current.sent).toHaveLength(1);
    rerender({ onFrame: second });
    act(() => {
      server.send(labExample("envelope/v1/examples/cis-change-frame.json"));
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("closes its socket on unmount and opens one socket under StrictMode", () => {
    const { unmount } = renderHook(
      () => useFeed({ url: "/ws", onFrame: () => undefined }),
      { wrapper: StrictMode },
    );
    // StrictMode mounts, unmounts and mounts again: the first socket is
    // closed by the client, the second is the live one.
    expect(server.sockets.at(-1)?.closedByClient).toBeNull();
    expect(
      server.sockets.slice(0, -1).every((s) => s.closedByClient === 1000),
    ).toBe(true);
    unmount();
    expect(server.sockets.every((s) => s.closedByClient === 1000)).toBe(true);
  });

  it("a new string url reopens the socket", () => {
    const { rerender } = renderHook(
      ({ url }) => useFeed({ url, onFrame: () => undefined }),
      { initialProps: { url: "/a" } },
    );
    rerender({ url: "/b" });
    expect(server.urls).toEqual([
      "wss://console.example.test/a",
      "wss://console.example.test/b",
    ]);
    expect(server.sockets[0]?.closedByClient).toBe(1000);
  });
});

describe("useStore", () => {
  it("re-renders on a change, with a stable snapshot between", () => {
    const store = createTrackStore({ trailPoints: 0, maxTracks: 5 });
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useStore(store);
    });
    const first = result.current;
    expect(first.size).toBe(0);
    const before = renders;
    act(() => {
      store.remove("none", "stale");
    });
    expect(renders).toBe(before);
    expect(result.current).toBe(first);
    act(() => {
      store.upsert({
        trackId: "TEST-1",
        trust: "simulated",
        source: "sitl",
        sourceInstance: "test-1",
        lat: 41.7,
        lng: 44.8,
        altAmslM: null,
        altWgs84M: null,
        altSource: "none",
        heightM: null,
        heightRef: null,
        speedMs: null,
        trackDeg: null,
        vspeedMs: null,
        status: null,
        emergency: false,
        identification: null,
        flightId: null,
        intentId: null,
        times: {
          ts: null,
          rxTs: "2026-10-02T09:15:06.000Z",
          capturedAt: "2026-10-02T09:15:06.000Z",
          timeSource: "system",
          backlog: false,
        },
      });
    });
    expect(result.current.size).toBe(1);
    expect(result.current.get("TEST-1")?.receivedAtMs).toBe(T0);
  });
});

describe("useNowMs", () => {
  it("ticks every period and stops on unmount", () => {
    const { result, unmount } = renderHook(() => useNowMs(1000));
    expect(result.current).toBe(T0);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(T0 + 3000);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current).toBe(T0 + 3000);
    unmount();
  });
});
