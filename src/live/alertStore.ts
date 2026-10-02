// The alert store (docs/PLAN.md §3.11, WP-8). A raise or an update
// replaces the alert held under its id (C-06); a clear keeps the alert,
// with the numbers and reason of the clear, for `clearedHoldMs` and then
// drops it (C-14: a clear shows its own numbers). `acknowledged` is this
// console's flag only; recording an acknowledgement is the app's POST
// (PLAN §14 Q15). A console that connects late gets the server's replay
// (C-08) and shows it: a snapshot is applied, never de-duplicated away.
import type { AlertView } from "../model/index.js";
import { Emitter } from "./emitter.js";

/** An alert as the app's adapter makes it; the store adds the rest. */
export type AlertInput = Omit<AlertView, "receivedAtMs" | "acknowledged">;

// Display constants, not thresholds (CLAUDE.md rule 3): how long a cleared
// alert stays on screen with its clear numbers, and how many alerts are
// held (PLAN §8: alert hold <= 500).
export const DEFAULT_CLEARED_HOLD_MS = 30_000;
export const ALERT_STORE_LIMIT = 500;

export type AlertStoreCounter =
  /** An alert pushed out by `maxAlerts`, cleared ones first (E-10). */
  | "alert_evicted"
  /** A cleared alert dropped at the end of its hold. */
  | "cleared_dropped"
  /** An active alert absent from a snapshot: the server no longer has it. */
  | "alert_absent_from_snapshot"
  /** An acknowledgement for an id the store did not hold. */
  | "acknowledge_unknown";

const ZERO: Readonly<Record<AlertStoreCounter, number>> = {
  alert_evicted: 0,
  cleared_dropped: 0,
  alert_absent_from_snapshot: 0,
  acknowledge_unknown: 0,
};

export interface AlertStoreOptions {
  /** How long a cleared alert is held; `DEFAULT_CLEARED_HOLD_MS`. */
  clearedHoldMs?: number;
  /** How many alerts are held; `ALERT_STORE_LIMIT`. */
  maxAlerts?: number;
  /** The browser clock; `Date.now` by default. */
  now?: () => number;
}

export interface AlertStore {
  /** Applies a raise, an update or a clear (by `state`). */
  apply(a: AlertInput): void;
  /** Replaces the active alerts with a snapshot's (C-08 replay). */
  replace(alerts: readonly AlertInput[]): void;
  /** Marks the alert acknowledged on this console. */
  acknowledge(id: string): void;
  get(id: string): AlertView | undefined;
  /** A stable map between changes, for `useSyncExternalStore`. */
  snapshot(): ReadonlyMap<string, AlertView>;
  subscribe(fn: () => void): () => void;
  counters(): Readonly<Record<AlertStoreCounter, number>>;
  /** Stops the hold timer (an app unmounting its console). */
  dispose(): void;
}

export function createAlertStore(opts: AlertStoreOptions = {}): AlertStore {
  const holdMs = opts.clearedHoldMs ?? DEFAULT_CLEARED_HOLD_MS;
  const maxAlerts = opts.maxAlerts ?? ALERT_STORE_LIMIT;
  if (!Number.isFinite(holdMs) || holdMs < 0)
    throw new RangeError(`clearedHoldMs must be >= 0, got ${holdMs}`);
  if (!Number.isInteger(maxAlerts) || maxAlerts < 1)
    throw new RangeError(`maxAlerts must be an integer >= 1, got ${maxAlerts}`);
  const now = opts.now ?? (() => Date.now());
  const alerts = new Map<string, AlertView>();
  // Browser clock at which each held clear is dropped.
  const dropAt = new Map<string, number>();
  const counts: Record<AlertStoreCounter, number> = { ...ZERO };
  const emitter = new Emitter();
  let cache: ReadonlyMap<string, AlertView> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const changed = (): void => {
    cache = null;
    emitter.emit();
  };

  const schedule = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (dropAt.size === 0) return;
    const next = Math.min(...dropAt.values());
    timer = setTimeout(sweep, Math.max(0, next - now()));
  };

  function sweep(): void {
    timer = null;
    const t = now();
    let any = false;
    for (const [id, at] of [...dropAt]) {
      if (at > t) continue;
      dropAt.delete(id);
      alerts.delete(id);
      counts.cleared_dropped += 1;
      any = true;
    }
    schedule();
    if (any) changed();
  }

  const evict = (): void => {
    while (alerts.size > maxAlerts) {
      // Map order is the order of last change: a held clear goes first.
      let victim: string | undefined;
      for (const id of alerts.keys()) {
        if (dropAt.has(id)) {
          victim = id;
          break;
        }
      }
      victim ??= alerts.keys().next().value as string;
      alerts.delete(victim);
      dropAt.delete(victim);
      counts.alert_evicted += 1;
    }
  };

  const put = (a: AlertInput): void => {
    const held = alerts.get(a.alertId);
    // A raise is a new raise (a new severity, or after a clear): it wants
    // a new acknowledgement. An update and a clear keep the flag.
    const acknowledged =
      held !== undefined &&
      held.acknowledged &&
      !(
        a.state === "raised" &&
        (held.state === "cleared" || held.severity !== a.severity)
      );
    alerts.delete(a.alertId);
    alerts.set(a.alertId, { ...a, acknowledged, receivedAtMs: now() });
    if (a.state === "cleared") dropAt.set(a.alertId, now() + holdMs);
    else dropAt.delete(a.alertId);
  };

  return {
    apply(a) {
      put(a);
      evict();
      schedule();
      changed();
    },
    replace(list) {
      const keep = new Set(list.map((a) => a.alertId));
      for (const [id, a] of [...alerts]) {
        if (keep.has(id) || a.state === "cleared") continue;
        alerts.delete(id);
        counts.alert_absent_from_snapshot += 1;
      }
      for (const a of list) put(a);
      evict();
      schedule();
      changed();
    },
    acknowledge(id) {
      const held = alerts.get(id);
      if (held === undefined) {
        counts.acknowledge_unknown += 1;
        return;
      }
      if (held.acknowledged) return;
      alerts.set(id, { ...held, acknowledged: true });
      changed();
    },
    get: (id) => alerts.get(id),
    snapshot() {
      cache ??= new Map(alerts);
      return cache;
    },
    subscribe: emitter.subscribe,
    counters: () => ({ ...counts }),
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
