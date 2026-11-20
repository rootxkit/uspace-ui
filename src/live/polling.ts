"use client";
// A REST read repeated on a period (the consoles' summaries, lists and
// queues that no console frame carries). One read at a time, the next one
// timed from the moment the last one settled; nothing is read while the
// page is hidden or the caller says the session is gone; a failure keeps
// the last answer, is shown beside it, and slows the reads down.
//
// Why a hidden page stops: a read is a request on the session cookie, so a
// forgotten background tab that keeps reading keeps its server session
// "active" and the idle sign-out never fires.
//
// The period, the jitter and the backoff are transport constants: they
// decide how often a console asks, never what it shows (CLAUDE.md rule 3).
// The age of what is shown is the caller's to draw, from `lastOkAtMs`.
import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { ApiError } from "../api/error.js";

import { pageVisible, subscribePageVisible } from "./visibility.js";

/**
 * How a run of failed reads slows down.
 *
 * @public
 */
export interface PollingBackoff {
  /** The cap of the wait after a failure, in ms; never below the period. */
  maxMs: number;
  /** Each consecutive failure multiplies the wait by this. */
  factor: number;
}

/**
 * The default slow-down of failed reads: twice the wait per consecutive
 * failure, up to one minute (or the period, when that is longer).
 *
 * @public
 */
export const DEFAULT_POLLING_BACKOFF: Readonly<PollingBackoff> = Object.freeze({
  maxMs: 60_000,
  factor: 2,
});

/**
 * The default spread of every wait: up to this fraction is added, so the
 * tabs of a room do not ask in step.
 *
 * @public
 */
export const DEFAULT_POLLING_JITTER: number = 0.1;

/**
 * The options of `usePolling`.
 *
 * @public
 */
export interface PollingOptions {
  /**
   * False stops everything: no read is started, the pending wait is
   * dropped and a read in flight is aborted; the last answer stays. A
   * console passes "signed in". Back to true reads at once. Default true.
   */
  enabled?: boolean;
  /**
   * What a hidden page does. `"pause"` (the default): no read is started
   * and no timer runs; when the page is shown again it reads at once if
   * its wait has run out, else it waits the rest. `"poll"`: keeps reading.
   * Only for a display that must stay current unseen: every read is a
   * request on the session, so a hidden tab that polls keeps its server
   * session active and an idle sign-out never fires for it.
   */
  whileHidden?: "pause" | "poll";
  /**
   * A change of this string starts over: the read in flight is aborted,
   * its answer is dropped, and a read starts at once (`loading` is true
   * until it settles; `data` is still the previous key's until then). Put
   * in it whatever the reader closes over: an id, a filter, a page.
   */
  key?: string;
  /** How failures slow the reads down; `DEFAULT_POLLING_BACKOFF`. */
  backoff?: PollingBackoff;
  /** The fraction added at random to every wait, 0 to 1; `DEFAULT_POLLING_JITTER`. */
  jitter?: number;
  /** The browser clock; for tests. */
  now?: () => number;
  /** A number in [0, 1); for tests. */
  random?: () => number;
}

/**
 * What `usePolling` returns.
 *
 * @public
 */
export interface Polling<T> {
  /** The last answer; null before the first. A failure does not clear it. */
  data: T | null;
  /** What the last read rejected with; null when it answered. */
  error: unknown;
  /**
   * True until the first read settles, and again from a `reload()` or a
   * change of `key` until the read it asked for settles. A periodic read
   * in the background does not set it. False while not enabled.
   */
  loading: boolean;
  /** Browser clock at the last answer; null before the first. */
  lastOkAtMs: number | null;
  /** Browser clock at the first failure since the last answer; null while reads answer. */
  failingSinceMs: number | null;
  /**
   * Reads now, whatever the wait (after the caller changed something). A
   * read in flight is not stacked on: one more read follows it, however
   * many times this was called meanwhile. On a hidden, pausing page the
   * read happens when the page is shown; while not enabled it does nothing.
   */
  reload(): void;
}

/**
 * The wait before the next read, in ms. After an answer (`failures` 0):
 * the period. After consecutive failure number `failures`: the period
 * times `factor^(failures - 1)`, capped at `maxMs` (never below the
 * period), and never less than the `Retry-After` the API sent. A fraction
 * `jitter * random` is added to all of it, so the result is never below
 * the period nor below `Retry-After`. Never below 1 ms and never NaN.
 */
export function pollingDelayMs(
  periodMs: number,
  failures: number,
  retryAfterS: number | null,
  backoff: PollingBackoff,
  jitter: number,
  random: number,
): number {
  const period = Number.isFinite(periodMs) && periodMs >= 1 ? periodMs : 1;
  const cap = Number.isFinite(backoff.maxMs)
    ? Math.max(backoff.maxMs, period)
    : period;
  let waitMs = period;
  if (failures > 0) {
    const factor =
      Number.isFinite(backoff.factor) && backoff.factor >= 1
        ? backoff.factor
        : 1;
    const raw = period * factor ** Math.min(failures - 1, 64);
    waitMs = Math.min(cap, Number.isFinite(raw) ? raw : cap);
    if (
      retryAfterS !== null &&
      Number.isFinite(retryAfterS) &&
      retryAfterS * 1000 > waitMs
    )
      waitMs = retryAfterS * 1000;
  }
  const j = Number.isFinite(jitter) ? Math.min(Math.max(jitter, 0), 1) : 0;
  const r = Number.isFinite(random) ? Math.min(Math.max(random, 0), 1) : 0;
  return Math.max(1, Math.round(waitMs * (1 + j * r)));
}

type Reader<T> = (signal: AbortSignal) => Promise<T>;

interface Settings {
  periodMs: number;
  whileHidden: "pause" | "poll";
  backoff: PollingBackoff;
  jitter: number;
}

interface Flight {
  abort: AbortController;
}

/**
 * The scheduler under `usePolling`: one per hook instance. Its state
 * outlives a stop and a start, so a change of key or period keeps the
 * last answer on the page.
 */
class Poller<T> {
  private reader: Reader<T>;
  private now: () => number = Date.now;
  private random: () => number = Math.random;
  private settings: Settings | null = null;
  private flight: Flight | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** When the next read is due; null when none is waited for. */
  private dueAtMs: number | null = null;
  /** A `reload()` arrived during a read: one more read follows it. */
  private again = false;
  private failures = 0;
  private unsubscribe: (() => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private state: Polling<T>;

  constructor(reader: Reader<T>, loading: boolean) {
    this.reader = reader;
    this.state = {
      data: null,
      error: null,
      loading,
      lastOkAtMs: null,
      failingSinceMs: null,
      reload: this.reload,
    };
  }

  readonly subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  readonly snapshot = (): Polling<T> => this.state;

  /** The latest reader and clocks: read at the next use, never a restart. */
  setLatest(reader: Reader<T>, now: () => number, random: () => number): void {
    this.reader = reader;
    this.now = now;
    this.random = random;
  }

  start(settings: Settings): void {
    this.settings = settings;
    this.failures = 0;
    this.unsubscribe = subscribePageVisible(this.onVisibility);
    this.set({ loading: true });
    this.dueAtMs = this.now();
    this.resume();
  }

  stop(): void {
    this.settings = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.clearTimer();
    this.dueAtMs = null;
    this.again = false;
    const flight = this.flight;
    this.flight = null;
    flight?.abort.abort();
    this.set({ loading: false });
  }

  readonly reload = (): void => {
    if (this.settings === null) return;
    this.set({ loading: true });
    if (this.flight !== null) {
      this.again = true;
      return;
    }
    this.dueAtMs = this.now();
    this.resume();
  };

  private paused(s: Settings): boolean {
    return s.whileHidden === "pause" && !pageVisible();
  }

  private readonly onVisibility = (): void => {
    this.resume();
  };

  /**
   * Reads now when the wait has run out, else waits the rest of it; on a
   * hidden, pausing page neither, and the timer is not running.
   */
  private resume(): void {
    const s = this.settings;
    if (s === null) return;
    this.clearTimer();
    if (this.flight !== null || this.dueAtMs === null || this.paused(s)) return;
    const restMs = this.dueAtMs - this.now();
    if (restMs <= 0) {
      this.read();
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.read();
    }, restMs);
  }

  private read(): void {
    const flight: Flight = { abort: new AbortController() };
    this.flight = flight;
    this.dueAtMs = null;
    let answer: Promise<T>;
    try {
      answer = this.reader(flight.abort.signal);
    } catch (err) {
      // A reader that throws before it returns its promise failed too.
      answer = Promise.reject(
        err instanceof Error ? err : new Error(String(err)),
      );
    }
    answer.then(
      (data) => {
        this.settle(flight, { ok: true, data });
      },
      (error: unknown) => {
        this.settle(flight, { ok: false, error });
      },
    );
  }

  private settle(
    flight: Flight,
    result: { ok: true; data: T } | { ok: false; error: unknown },
  ): void {
    // An answer to a read that was aborted or replaced is dropped.
    const s = this.settings;
    if (this.flight !== flight || s === null) return;
    this.flight = null;
    const nowMs = this.now();
    const again = this.again;
    this.again = false;
    let retryAfterS: number | null = null;
    if (result.ok) {
      this.failures = 0;
      this.set({
        data: result.data,
        error: null,
        loading: again,
        lastOkAtMs: nowMs,
        failingSinceMs: null,
      });
    } else {
      this.failures += 1;
      if (result.error instanceof ApiError)
        retryAfterS = result.error.retryAfterS;
      this.set({
        // A rejection with nothing is still a failure the page can show.
        error: result.error ?? new Error("the read failed"),
        loading: again,
        failingSinceMs: this.state.failingSinceMs ?? nowMs,
      });
    }
    this.dueAtMs = again
      ? nowMs
      : nowMs +
        pollingDelayMs(
          s.periodMs,
          this.failures,
          retryAfterS,
          s.backoff,
          s.jitter,
          this.random(),
        );
    this.resume();
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private set(patch: Partial<Polling<T>>): void {
    const next = { ...this.state, ...patch };
    const keys = Object.keys(next) as (keyof Polling<T>)[];
    if (keys.every((k) => Object.is(this.state[k], next[k]))) return;
    this.state = next;
    for (const fn of [...this.listeners]) fn();
  }
}

// useLayoutEffect warns during server rendering; the reader only needs to
// be current before the next read starts, so an effect is enough there.
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A read repeated every `periodMs` (a display period, not a threshold).
 *
 * - It reads once on mount and times each next read from the moment the
 *   last one settled, so reads never overlap, however slow the API is.
 * - `read` is given an `AbortSignal`; pass it to the request. It is
 *   aborted on unmount, when `enabled` goes false and when `key` or
 *   `periodMs` changes, and an answer that arrives after that is dropped.
 *   The latest `read` is the one called; its identity may change between
 *   renders without starting over (that is what `key` is for).
 * - A hidden page does not read (`whileHidden`), and a caller without a
 *   session does not either (`enabled`).
 * - A failure keeps `data`, sets `error`, and slows the reads down:
 *   never sooner than the period nor than the `Retry-After` of an
 *   `ApiError` (`retryAfterS`), longer on every consecutive failure up to
 *   the cap (`backoff`), back to the period on the first answer.
 * - Every wait is lengthened by a random fraction (`jitter`), never
 *   shortened.
 *
 * It only reads: never give it a request with a side effect.
 *
 * @public
 */
export function usePolling<T>(
  read: (signal: AbortSignal) => Promise<T>,
  periodMs: number,
  options: PollingOptions = {},
): Polling<T> {
  const enabled = options.enabled ?? true;
  const whileHidden = options.whileHidden ?? "pause";
  const maxMs = options.backoff?.maxMs ?? DEFAULT_POLLING_BACKOFF.maxMs;
  const factor = options.backoff?.factor ?? DEFAULT_POLLING_BACKOFF.factor;
  const jitter = options.jitter ?? DEFAULT_POLLING_JITTER;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const key = options.key ?? "";
  const [poller] = useState(() => new Poller<T>(read, enabled));
  useIsoLayoutEffect(() => {
    poller.setLatest(read, now, random);
  });
  useEffect(() => {
    if (!enabled) return undefined;
    poller.start({
      periodMs,
      whileHidden,
      backoff: { maxMs, factor },
      jitter,
    });
    return () => {
      poller.stop();
    };
  }, [poller, enabled, key, periodMs, whileHidden, maxMs, factor, jitter]);
  return useSyncExternalStore(
    poller.subscribe,
    poller.snapshot,
    poller.snapshot,
  );
}
