// usePolling and usePageVisible on fake timers (E-01, E-02, E-11): every
// "does not read" has the twin that reads. A hidden page starts no read
// over several periods and reads when it is shown; a slow reader is not
// called again while it is pending and is called after it settles;
// Retry-After is waited out; the backoff grows, stops at its cap and
// resets on an answer; enabled=false and unmount abort the read in flight
// and a late answer changes nothing; reload() coalesces.
import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/error.js";

import {
  DEFAULT_POLLING_BACKOFF,
  DEFAULT_POLLING_JITTER,
  pollingDelayMs,
  usePolling,
  type PollingOptions,
} from "./polling.js";
import { usePageVisible } from "./visibility.js";

const T0 = Date.UTC(2026, 9, 2, 9, 15, 6);
const PERIOD_MS = 5000;
// No jitter unless a test asks for it: the waits below are exact.
const EXACT: PollingOptions = { random: () => 0 };

interface Call {
  signal: AbortSignal;
  resolve(value: string): void;
  reject(error: unknown): void;
}

/** A reader whose every call stays pending until the test settles it. */
function manualReader() {
  const calls: Call[] = [];
  const read = vi.fn(
    (signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        calls.push({ signal, resolve, reject });
      }),
  );
  const call = (i: number): Call => {
    const c = calls[i];
    if (c === undefined) throw new Error(`the reader was not called ${i + 1}x`);
    return c;
  };
  return { read, call };
}

function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** Settles a pending read and lets the hook see it. */
const settle = (fn: () => void) =>
  act(async () => {
    fn();
    await vi.advanceTimersByTimeAsync(0);
  });

function refusal(retryAfterS: number | null): ApiError {
  return new ApiError({
    status: 503,
    problem: null,
    retryAfterS,
    requestId: null,
    sunset: null,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  cleanup();
  // Nothing may keep ticking after the page left (E-11).
  expect(vi.getTimerCount()).toBe(0);
  // The own property set by setVisibility; jsdom's is on the prototype.
  Reflect.deleteProperty(document, "visibilityState");
  expect(document.visibilityState).toBe("visible");
  vi.useRealTimers();
});

describe("usePolling: the period", () => {
  it("reads once on mount and says what it read, and when", async () => {
    const { read, call } = manualReader();
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({
      data: null,
      error: null,
      loading: true,
      lastOkAtMs: null,
      failingSinceMs: null,
    });
    await advance(120);
    await settle(() => {
      call(0).resolve("first");
    });
    expect(result.current).toMatchObject({
      data: "first",
      error: null,
      loading: false,
      lastOkAtMs: T0 + 120,
      failingSinceMs: null,
    });
  });

  it("times the next read from the moment the last one settled", async () => {
    const { read, call } = manualReader();
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(2000);
    await settle(() => {
      call(0).resolve("first");
    });
    // One period after the mount is not one period after the answer.
    await advance(PERIOD_MS - 1);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(2);
    // A periodic read in the background is not "loading".
    expect(result.current.loading).toBe(false);
    await settle(() => {
      call(1).resolve("second");
    });
    expect(result.current.data).toBe("second");
    expect(result.current.lastOkAtMs).toBe(T0 + 2000 + PERIOD_MS);
  });

  it("does not call a slow reader again while it is pending, and does after it settles", async () => {
    const { read, call } = manualReader();
    renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(PERIOD_MS * 6);
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await settle(() => {
      call(0).resolve("slow");
    });
    expect(read).toHaveBeenCalledTimes(1);
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("calls the latest reader without starting over", async () => {
    const first = vi.fn(() => Promise.resolve("first"));
    const second = vi.fn(() => Promise.resolve("second"));
    const { result, rerender } = renderHook(
      ({ read }) => usePolling(read, PERIOD_MS, EXACT),
      { initialProps: { read: first } },
    );
    await advance(0);
    expect(result.current.data).toBe("first");
    rerender({ read: second });
    // A new reader identity is not a reason to read.
    await advance(PERIOD_MS - 1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(0);
    await advance(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe("second");
  });

  it("lengthens a wait by the jitter, never shortens it", async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    renderHook(() =>
      usePolling(read, PERIOD_MS, { random: () => 1, jitter: 0.2 }),
    );
    await advance(0);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(PERIOD_MS * 1.2 - 1);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("starts over when the period changes", async () => {
    const { read, call } = manualReader();
    const { rerender } = renderHook(
      ({ periodMs }) => usePolling(read, periodMs, EXACT),
      { initialProps: { periodMs: PERIOD_MS } },
    );
    rerender({ periodMs: 1000 });
    expect(call(0).signal.aborted).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    await settle(() => {
      call(1).resolve("fast");
    });
    await advance(1000);
    expect(read).toHaveBeenCalledTimes(3);
  });
});

describe("usePolling: a hidden page", () => {
  it("starts no read over several periods, and reads at once when shown", async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(0);
    expect(read).toHaveBeenCalledTimes(1);
    act(() => {
      setVisibility("hidden");
    });
    // The timer is not running, so nothing can fire unseen.
    expect(vi.getTimerCount()).toBe(0);
    await advance(PERIOD_MS * 8);
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current.lastOkAtMs).toBe(T0);
    act(() => {
      setVisibility("visible");
    });
    expect(read).toHaveBeenCalledTimes(2);
    await advance(0);
    expect(result.current.lastOkAtMs).toBe(T0 + PERIOD_MS * 8);
    // And the period goes on from there.
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("waits the rest of the period when shown before it ran out", async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(0);
    await advance(1000);
    act(() => {
      setVisibility("hidden");
    });
    await advance(1000);
    act(() => {
      setVisibility("visible");
    });
    // 2 s of the 5 s have passed: no read yet, 3 s to go.
    expect(read).toHaveBeenCalledTimes(1);
    await advance(2999);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not read on mount while hidden, and does when shown", async () => {
    setVisibility("hidden");
    const read = vi.fn(() => Promise.resolve("ok"));
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(PERIOD_MS * 3);
    expect(read).toHaveBeenCalledTimes(0);
    expect(result.current.loading).toBe(true);
    act(() => {
      setVisibility("visible");
    });
    expect(read).toHaveBeenCalledTimes(1);
    await advance(0);
    expect(result.current).toMatchObject({ data: "ok", loading: false });
  });

  it("lets a read in flight finish, and schedules nothing until shown", async () => {
    const { read, call } = manualReader();
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    act(() => {
      setVisibility("hidden");
    });
    expect(call(0).signal.aborted).toBe(false);
    await settle(() => {
      call(0).resolve("landed");
    });
    expect(result.current.data).toBe("landed");
    expect(vi.getTimerCount()).toBe(0);
    await advance(PERIOD_MS * 4);
    expect(read).toHaveBeenCalledTimes(1);
    act(() => {
      setVisibility("visible");
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps reading with whileHidden: "poll"', async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    renderHook(() =>
      usePolling(read, PERIOD_MS, { ...EXACT, whileHidden: "poll" }),
    );
    await advance(0);
    act(() => {
      setVisibility("hidden");
    });
    await advance(PERIOD_MS * 3);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("keeps a reload() for the moment the page is shown", async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(0);
    act(() => {
      setVisibility("hidden");
    });
    act(() => {
      result.current.reload();
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(true);
    act(() => {
      setVisibility("visible");
    });
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("usePolling: failures", () => {
  it("keeps the last answer, shows the error, and says since when", async () => {
    const { read, call } = manualReader();
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await settle(() => {
      call(0).resolve("good");
    });
    await advance(PERIOD_MS);
    const failure = new Error("unreachable");
    await settle(() => {
      call(1).reject(failure);
    });
    expect(result.current).toMatchObject({
      data: "good",
      error: failure,
      loading: false,
      lastOkAtMs: T0,
      failingSinceMs: T0 + PERIOD_MS,
    });
    // A second failure does not move "since".
    await advance(PERIOD_MS);
    await settle(() => {
      call(2).reject(new Error("still unreachable"));
    });
    expect(result.current.failingSinceMs).toBe(T0 + PERIOD_MS);
    expect(result.current.data).toBe("good");
  });

  it("clears the error on the next answer (the branch that says nothing is wrong)", async () => {
    const { read, call } = manualReader();
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await settle(() => {
      call(0).reject(new Error("unreachable"));
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeNull();
    await advance(PERIOD_MS);
    await settle(() => {
      call(1).resolve("back");
    });
    expect(result.current).toMatchObject({
      data: "back",
      error: null,
      failingSinceMs: null,
    });
  });

  it("waits out Retry-After when it is longer than the period", async () => {
    const { read, call } = manualReader();
    renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await settle(() => {
      call(0).reject(refusal(30));
    });
    await advance(29_999);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("retries after one period when the refusal names no Retry-After, or a shorter one", async () => {
    const { read, call } = manualReader();
    renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await settle(() => {
      call(0).reject(refusal(null));
    });
    await advance(PERIOD_MS - 1);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(2);
    // Retry-After: 1 does not make the console ask sooner than it would.
    await settle(() => {
      call(1).reject(refusal(1));
    });
    await advance(PERIOD_MS * 2 - 1);
    expect(read).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("backs off on consecutive failures up to the cap, and resets on an answer", async () => {
    const { read, call } = manualReader();
    renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    // 5 s, 10 s, 20 s, 40 s, then the 60 s cap twice.
    const waits = [5000, 10_000, 20_000, 40_000, 60_000, 60_000];
    for (const [i, waitMs] of waits.entries()) {
      await settle(() => {
        call(i).reject(new Error("unreachable"));
      });
      await advance(waitMs - 1);
      expect(read, `before wait ${i}`).toHaveBeenCalledTimes(i + 1);
      await advance(1);
      expect(read, `after wait ${i}`).toHaveBeenCalledTimes(i + 2);
    }
    // The first answer brings the period back, and so does the failure
    // after it: the run starts again from one period.
    await settle(() => {
      call(6).resolve("back");
    });
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(8);
    await settle(() => {
      call(7).reject(new Error("unreachable again"));
    });
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(9);
  });

  it("takes the caller's backoff", async () => {
    const { read, call } = manualReader();
    renderHook(() =>
      usePolling(read, PERIOD_MS, {
        ...EXACT,
        backoff: { maxMs: 12_000, factor: 3 },
      }),
    );
    await settle(() => {
      call(0).reject(new Error("one"));
    });
    await advance(5000);
    await settle(() => {
      call(1).reject(new Error("two"));
    });
    // 15 s by the factor, 12 s by the cap.
    await advance(11_999);
    expect(read).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("treats a reader that throws, or rejects with nothing, as a failure", async () => {
    let n = 0;
    const read = vi.fn((): Promise<string> => {
      n += 1;
      if (n === 1) throw new TypeError("no client");
      return Promise.reject(undefined);
    });
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(0);
    expect(result.current.error).toBeInstanceOf(TypeError);
    expect(result.current.loading).toBe(false);
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("the read failed");
  });
});

describe("usePolling: enabled, key and unmount", () => {
  it("enabled=false aborts the read in flight and stops; true reads again", async () => {
    const { read, call } = manualReader();
    const { result, rerender } = renderHook(
      ({ enabled }) => usePolling(read, PERIOD_MS, { ...EXACT, enabled }),
      { initialProps: { enabled: true } },
    );
    await settle(() => {
      call(0).resolve("signed in");
    });
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(2);
    expect(call(1).signal.aborted).toBe(false);
    rerender({ enabled: false });
    expect(call(1).signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.loading).toBe(false);
    // The answer of the aborted read changes nothing.
    await settle(() => {
      call(1).resolve("late");
    });
    expect(result.current.data).toBe("signed in");
    await advance(PERIOD_MS * 5);
    expect(read).toHaveBeenCalledTimes(2);
    // reload() does nothing without a session.
    act(() => {
      result.current.reload();
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    rerender({ enabled: true });
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.loading).toBe(true);
  });

  it("does not read at all when it starts disabled", async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    const { result } = renderHook(() =>
      usePolling(read, PERIOD_MS, { ...EXACT, enabled: false }),
    );
    await advance(PERIOD_MS * 3);
    expect(read).toHaveBeenCalledTimes(0);
    expect(result.current).toMatchObject({ data: null, loading: false });
  });

  it("unmount aborts the read in flight and leaves no timer", async () => {
    const { read, call } = manualReader();
    const { unmount } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    expect(call(0).signal.aborted).toBe(false);
    unmount();
    expect(call(0).signal.aborted).toBe(true);
    await settle(() => {
      call(0).resolve("late");
    });
    await advance(PERIOD_MS * 3);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("unmount during a wait clears it", async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    const { unmount } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(0);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a late answer for an old key never overwrites the new key's", async () => {
    const { read, call } = manualReader();
    const { result, rerender } = renderHook(
      ({ id }) => usePolling(read, PERIOD_MS, { ...EXACT, key: id }),
      { initialProps: { id: "TEST-1" } },
    );
    await settle(() => {
      call(0).resolve("one");
    });
    expect(result.current).toMatchObject({ data: "one", loading: false });
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(2);
    rerender({ id: "TEST-2" });
    expect(call(1).signal.aborted).toBe(true);
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.loading).toBe(true);
    await settle(() => {
      call(2).resolve("two");
    });
    await settle(() => {
      call(1).resolve("one, late");
    });
    expect(result.current).toMatchObject({ data: "two", loading: false });
  });

  it("survives StrictMode's double effect with one live read", async () => {
    const { read, call } = manualReader();
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT), {
      wrapper: StrictMode,
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(call(0).signal.aborted).toBe(true);
    expect(call(1).signal.aborted).toBe(false);
    await settle(() => {
      call(1).resolve("ok");
    });
    expect(result.current.data).toBe("ok");
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(3);
  });
});

describe("usePolling: reload()", () => {
  it("reads now and drops the pending wait", async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await advance(0);
    await advance(1000);
    act(() => {
      result.current.reload();
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(true);
    await advance(0);
    expect(result.current.loading).toBe(false);
    // The period counts from the reload's answer, not from the old wait.
    await advance(PERIOD_MS - 1);
    expect(read).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("coalesces with a read in flight: one more read, however often it is called", async () => {
    const { read, call } = manualReader();
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await settle(() => {
      call(0).resolve("before");
    });
    await advance(PERIOD_MS);
    expect(read).toHaveBeenCalledTimes(2);
    act(() => {
      result.current.reload();
      result.current.reload();
      result.current.reload();
    });
    // Nothing is stacked on the read in flight.
    expect(read).toHaveBeenCalledTimes(2);
    expect(call(1).signal.aborted).toBe(false);
    expect(result.current.loading).toBe(true);
    // It may have left before the caller's change: one read follows it.
    await settle(() => {
      call(1).resolve("maybe before the change");
    });
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.loading).toBe(true);
    await settle(() => {
      call(2).resolve("after the change");
    });
    expect(result.current).toMatchObject({
      data: "after the change",
      loading: false,
    });
    // Exactly one: the next read is a period away.
    await advance(PERIOD_MS - 1);
    expect(read).toHaveBeenCalledTimes(3);
    await advance(1);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("reads now through a backoff", async () => {
    const { read, call } = manualReader();
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    await settle(() => {
      call(0).reject(refusal(120));
    });
    await advance(1000);
    expect(read).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.reload();
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("is the same function on every render", async () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    const { result } = renderHook(() => usePolling(read, PERIOD_MS, EXACT));
    const first = result.current.reload;
    await advance(PERIOD_MS * 2);
    expect(result.current.reload).toBe(first);
  });
});

describe("pollingDelayMs", () => {
  const B = DEFAULT_POLLING_BACKOFF;

  it("is the period after an answer, with the jitter added", () => {
    expect(pollingDelayMs(5000, 0, null, B, 0.1, 0)).toBe(5000);
    expect(pollingDelayMs(5000, 0, null, B, 0.1, 1)).toBe(5500);
    expect(pollingDelayMs(5000, 0, null, B, DEFAULT_POLLING_JITTER, 0.5)).toBe(
      5250,
    );
    // Retry-After belongs to a failure; an answer has none to honour.
    expect(pollingDelayMs(5000, 0, 30, B, 0, 0)).toBe(5000);
  });

  it("grows by the factor to the cap, and the cap is never below the period", () => {
    expect(pollingDelayMs(5000, 1, null, B, 0, 0)).toBe(5000);
    expect(pollingDelayMs(5000, 2, null, B, 0, 0)).toBe(10_000);
    expect(pollingDelayMs(5000, 5, null, B, 0, 0)).toBe(60_000);
    expect(pollingDelayMs(5000, 5000, null, B, 0, 0)).toBe(60_000);
    expect(pollingDelayMs(120_000, 3, null, B, 0, 0)).toBe(120_000);
  });

  it("is never below Retry-After, even past the cap", () => {
    expect(pollingDelayMs(5000, 1, 30, B, 0, 0)).toBe(30_000);
    expect(pollingDelayMs(5000, 1, 300, B, 0, 0)).toBe(300_000);
    expect(pollingDelayMs(5000, 1, 30, B, 0.1, 1)).toBe(33_000);
    expect(pollingDelayMs(5000, 4, 30, B, 0, 0)).toBe(40_000);
    expect(pollingDelayMs(5000, 1, 0, B, 0, 0)).toBe(5000);
  });

  it("is a finite wait of at least 1 ms whatever it is given", () => {
    const bad = { maxMs: Number.NaN, factor: Number.NaN };
    expect(pollingDelayMs(Number.NaN, 0, null, B, 0, 0)).toBe(1);
    expect(pollingDelayMs(0, 3, null, B, 0, 0)).toBe(4);
    expect(pollingDelayMs(-5, 0, null, bad, Number.NaN, Number.NaN)).toBe(1);
    expect(pollingDelayMs(5000, 3, Number.NaN, bad, 7, 7)).toBe(10_000);
    expect(
      pollingDelayMs(5000, 3, null, { maxMs: 1e9, factor: 0.5 }, 0, 0),
    ).toBe(5000);
    expect(
      pollingDelayMs(5000, 400, null, { maxMs: 1e9, factor: 1e300 }, -1, -1),
    ).toBe(1e9);
  });
});

describe("usePageVisible", () => {
  it("follows the document: hidden, then visible again", () => {
    const { result } = renderHook(() => usePageVisible());
    expect(result.current).toBe(true);
    act(() => {
      setVisibility("hidden");
    });
    expect(result.current).toBe(false);
    act(() => {
      setVisibility("visible");
    });
    expect(result.current).toBe(true);
  });

  it("stops listening on unmount", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => usePageVisible());
    unmount();
    expect(remove).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });

  it("renders visible on the server, whatever the document says", () => {
    setVisibility("hidden");
    function Probe() {
      return <output>{usePageVisible() ? "visible" : "hidden"}</output>;
    }
    expect(renderToString(<Probe />)).toContain("visible");
    expect(renderToString(<Probe />)).not.toContain("hidden");
  });

  it("usePolling renders on the server without reading", () => {
    const read = vi.fn(() => Promise.resolve("ok"));
    function Probe() {
      const polled = usePolling(read, PERIOD_MS);
      return <output>{polled.loading ? "loading" : "idle"}</output>;
    }
    expect(renderToString(<Probe />)).toContain("loading");
    expect(read).toHaveBeenCalledTimes(0);
  });
});
