// The bounded track stores (docs/PLAN.md §3.11, §8; WP-8): one view per
// id, a bounded trail per id, and a short ring of recent removals with
// their reasons. Display hygiene, not judgement: a sample is kept or
// refused by its own fields (LESSONS T-13: an older `capturedAt` never
// replaces a newer one; T-04: a `backlog` sample goes to the trail, never
// to the live position) and every bound is counted (E-09, E-10).
import type {
  ClearReason,
  MannedView,
  Times,
  TrackView,
} from "../model/index.js";
import { Emitter } from "./emitter.js";
import { compareCapturedAt } from "./time.js";

/** Why a track left the store: the server's reason, or the store's bound. */
export type RemovedReason = ClearReason | "evicted";

/** One entry of the "recently removed" ring. */
export interface RemovedTrack {
  trackId: string;
  reason: RemovedReason;
  /** Browser clock of the removal. */
  atMs: number;
}

// A display bound, not a threshold: how many removals the status panel can
// list. Older entries leave the ring and are counted.
export const RECENTLY_REMOVED_LIMIT = 50;

export type TrackStoreCounter =
  /** A track pushed out by `maxTracks`, oldest update first (E-10). */
  | "track_evicted"
  /** A trail point pushed out of its track's ring (E-10). */
  | "trail_point_evicted"
  /** A removal pushed out of the recently removed ring. */
  | "removed_ring_evicted"
  /** A sample older than the one held for its id (T-13): ignored. */
  | "track_out_of_order"
  /** A sample whose time cannot be ordered against the held one: applied. */
  | "track_time_unordered"
  /** A `backlog` sample for a track with a live view: trail only (T-04). */
  | "backlog_to_trail"
  /** A removal for an id the store did not hold. */
  | "remove_unknown";

const ZERO: Readonly<Record<TrackStoreCounter, number>> = {
  track_evicted: 0,
  trail_point_evicted: 0,
  removed_ring_evicted: 0,
  track_out_of_order: 0,
  track_time_unordered: 0,
  backlog_to_trail: 0,
  remove_unknown: 0,
};

export interface TrackStoreOptions {
  /** Trail points kept per track; 0 keeps none. A display bound. */
  trailPoints: number;
  /** Tracks kept; past it the least recently updated is evicted (E-10). */
  maxTracks: number;
  /** The browser clock; `Date.now` by default. */
  now?: () => number;
}

/** A store of positioned views keyed by `trackId`. */
export interface PositionStore<V extends Positioned> {
  /** Adds or replaces a sample; stamps `receivedAtMs` on the browser clock. */
  upsert(t: Omit<V, "receivedAtMs">): void;
  /** Removes a track, with the server's reason (kept in the ring). */
  remove(id: string, reason: ClearReason | "source_disabled"): void;
  /**
   * Replaces the whole store (a snapshot, C-08): a held track absent from
   * `tracks` is removed as `resolved`; a present one is kept, updated.
   */
  replace(tracks: readonly Omit<V, "receivedAtMs">[]): void;
  get(id: string): V | undefined;
  /** A stable map between changes, for `useSyncExternalStore`. */
  snapshot(): ReadonlyMap<string, V>;
  /** The track's trail, oldest first, `[lng, lat]` as the API gave them. */
  trail(id: string): readonly (readonly [number, number])[];
  /** Recent removals, oldest first, at most `RECENTLY_REMOVED_LIMIT`. */
  recentlyRemoved(): readonly RemovedTrack[];
  subscribe(fn: () => void): () => void;
  counters(): Readonly<Record<TrackStoreCounter, number>>;
}

export type TrackStore = PositionStore<TrackView>;
export type MannedStore = PositionStore<MannedView>;

interface Positioned {
  trackId: string;
  lat: number;
  lng: number;
  times: Times;
  receivedAtMs: number;
}

function checkBound(name: string, v: number, min: number): void {
  if (!Number.isInteger(v) || v < min) {
    // A configuration error, not a display state (like an unknown zone).
    throw new RangeError(`${name} must be an integer >= ${min}, got ${v}`);
  }
}

function createPositionStore<V extends Positioned>(
  opts: TrackStoreOptions,
): PositionStore<V> {
  checkBound("maxTracks", opts.maxTracks, 1);
  checkBound("trailPoints", opts.trailPoints, 0);
  const now = opts.now ?? (() => Date.now());
  const views = new Map<string, V>();
  const trails = new Map<string, [number, number][]>();
  const removed: RemovedTrack[] = [];
  const counts: Record<TrackStoreCounter, number> = { ...ZERO };
  const emitter = new Emitter();
  let cache: ReadonlyMap<string, V> | null = null;

  const changed = (): void => {
    cache = null;
    emitter.emit();
  };

  const push = (id: string, t: { lat: number; lng: number }): void => {
    if (opts.trailPoints === 0) return;
    let trail = trails.get(id);
    if (trail === undefined) {
      trail = [];
      trails.set(id, trail);
    }
    trail.push([t.lng, t.lat]);
    const over = trail.length - opts.trailPoints;
    if (over > 0) {
      trail.splice(0, over);
      counts.trail_point_evicted += over;
    }
  };

  const record = (trackId: string, reason: RemovedReason): void => {
    removed.push({ trackId, reason, atMs: now() });
    if (removed.length > RECENTLY_REMOVED_LIMIT) {
      removed.shift();
      counts.removed_ring_evicted += 1;
    }
  };

  const drop = (id: string, reason: RemovedReason): void => {
    views.delete(id);
    trails.delete(id);
    record(id, reason);
  };

  // Applies one sample; true when the store changed.
  const apply = (t: Omit<V, "receivedAtMs">): boolean => {
    const id = t.trackId;
    const held = views.get(id);
    if (held !== undefined && !held.times.backlog) {
      if (t.times.backlog) {
        push(id, t);
        counts.backlog_to_trail += 1;
        return true;
      }
      const order = compareCapturedAt(
        t.times.capturedAt,
        held.times.capturedAt,
      );
      if (order === null) {
        counts.track_time_unordered += 1;
      } else if (order < 0) {
        counts.track_out_of_order += 1;
        return false;
      }
      if (order !== 0) push(id, t);
    } else {
      push(id, t);
    }
    // Delete first, so the map's order is the order of last update and
    // the first key is the one to evict.
    views.delete(id);
    views.set(id, { ...t, receivedAtMs: now() } as V);
    while (views.size > opts.maxTracks) {
      const oldest = views.keys().next().value as string;
      drop(oldest, "evicted");
      counts.track_evicted += 1;
    }
    return true;
  };

  return {
    upsert(t) {
      if (apply(t)) changed();
    },
    remove(id, reason) {
      if (!views.has(id)) {
        counts.remove_unknown += 1;
        return;
      }
      drop(id, reason);
      changed();
    },
    replace(tracks) {
      const keep = new Set(tracks.map((t) => t.trackId));
      for (const id of [...views.keys()]) {
        if (!keep.has(id)) drop(id, "resolved");
      }
      for (const t of tracks) apply(t);
      changed();
    },
    get: (id) => views.get(id),
    snapshot() {
      cache ??= new Map(views);
      return cache;
    },
    trail: (id) => trails.get(id) ?? [],
    recentlyRemoved: () => [...removed],
    subscribe: emitter.subscribe,
    counters: () => ({ ...counts }),
  };
}

/**
 * The track store (PLAN §3.11): bounded at `maxTracks` with the least
 * recently updated evicted and counted, `receivedAtMs` stamped on every
 * applied sample, trails bounded at `trailPoints`.
 */
export function createTrackStore(opts: TrackStoreOptions): TrackStore {
  return createPositionStore<TrackView>(opts);
}

/** The same store for manned traffic (`console/snapshot/v1` `manned[]`). */
export function createMannedStore(opts: TrackStoreOptions): MannedStore {
  return createPositionStore<MannedView>(opts);
}
