"use client";
// The React side of `live` (docs/PLAN.md §3.11): `useFeed` around the
// FeedClient, `useStore` over any store, and `useNowMs`, the clock tick
// the ages, the age chips and the track layer are drawn against.
import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { FeedClient, type FeedOptions, type LiveStatus } from "./client.js";
import type { SubscribeFrame } from "./frame.js";

/**
 * What `useFeed` returns: the status, and the subscribe sender.
 *
 * @public
 */
export interface LiveFeed extends LiveStatus {
  /** Sends a `console/subscribe/v1`, and again on every reconnect. */
  send(frame: SubscribeFrame): void;
}

// useLayoutEffect warns during server rendering; the options only need
// to be current before the next socket event, so an effect is enough
// there.
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The live feed (PLAN §3.11): reconnects forever (B-08); status frames
 * update the status and the source store; snapshots replace the stores in
 * `opts.stores`; everything else goes to `opts.onFrame`. It starts
 * `connecting` and never throws. The socket is reopened when a string
 * `url` changes; a function `url` is read on every attempt, so its
 * identity may change between renders.
 *
 * @public
 */
export function useFeed(opts: FeedOptions): LiveFeed {
  const [client] = useState(() => new FeedClient(opts));
  useIsoLayoutEffect(() => {
    client.setOptions(opts);
  });
  const urlKey = typeof opts.url === "string" ? opts.url : null;
  useEffect(() => {
    client.start();
    return () => {
      client.stop();
    };
  }, [client, urlKey]);
  const status = useSyncExternalStore(
    client.subscribe,
    client.getStatus,
    client.getStatus,
  );
  const [cache] = useState(() => new WeakMap<LiveStatus, LiveFeed>());
  let feed = cache.get(status);
  if (feed === undefined) {
    feed = { ...status, send: client.send };
    cache.set(status, feed);
  }
  return feed;
}

/**
 * Any store with `subscribe` and a `snapshot` stable between changes.
 *
 * @public
 */
export interface ExternalStore<T> {
  subscribe(fn: () => void): () => void;
  snapshot(): T;
}

/**
 * The store's snapshot, re-rendering on change (`useSyncExternalStore`).
 *
 * @public
 */
export function useStore<T>(store: ExternalStore<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    () => store.snapshot(),
    () => store.snapshot(),
  );
}

/**
 * The browser clock, re-read every `periodMs` (a display period, not a
 * threshold: how often ages are redrawn; PLAN §3.9 suggests 1 s). The
 * value an app passes as `nowMs` to the status components and the track
 * layer, so every age on the page counts on the same tick.
 *
 * @public
 */
export function useNowMs(
  periodMs: number,
  now: () => number = Date.now,
): number {
  const [nowMs, setNowMs] = useState(now);
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(now());
    }, periodMs);
    return () => {
      clearInterval(id);
    };
  }, [periodMs, now]);
  return nowMs;
}
