// Display bookkeeping shared by the list, the toaster and the tone
// (docs/PLAN.md §3.13, WP-11). None of it judges an alert: the kind, the
// severity, the state and the acknowledgement are the server's and the
// store's. What is decided here is only what the page shows as new: an
// alert this page has not shown, or one whose severity rose (LESSONS C-07:
// a severity change arrives as a new raise; show it as a change). A
// repeated raise at the same severity replaces the alert in place and is
// not new (C-06).
import type { AlertState, AlertView, Severity } from "../model/index.js";
import { utcMs } from "../live/time.js";
import { countAlert } from "./counters.js";

/**
 * Gravity of a severity for ordering and for "did it rise". A display
 * order, not a policy: the severity itself is the server's (Z-10).
 */
const GRAVITY: Readonly<Record<Severity, number>> = {
  info: 0,
  warning: 1,
  critical: 2,
};

/**
 * The alerts with one entry per `alertId`, the later entry winning.
 *
 * @beta
 */
export function uniqueById(alerts: readonly AlertView[]): AlertView[] {
  const byId = new Map<string, AlertView>();
  for (const a of alerts) {
    if (byId.has(a.alertId)) {
      countAlert("alert_duplicate_id");
      byId.delete(a.alertId);
    }
    byId.set(a.alertId, a);
  }
  return [...byId.values()];
}

/**
 * Critical first, then warning, then info; within one severity the most
 * recently raised first (`raisedAt`, the server's time, so a replayed
 * alert keeps its place, C-08). An unreadable `raisedAt` goes last; ties
 * by id, so the order is stable.
 *
 * @beta
 */
export function sortAlerts(alerts: readonly AlertView[]): AlertView[] {
  const at = new Map(alerts.map((a) => [a.alertId, utcMs(a.raisedAt)]));
  return [...alerts].sort((a, b) => {
    const g = GRAVITY[b.severity] - GRAVITY[a.severity];
    if (g !== 0) return g;
    const ta = at.get(a.alertId) ?? null;
    const tb = at.get(b.alertId) ?? null;
    if (ta !== tb) {
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta;
    }
    return a.alertId < b.alertId ? -1 : a.alertId > b.alertId ? 1 : 0;
  });
}

/**
 * What the page last showed of an alert.
 *
 * @beta
 */
export interface Seen {
  severity: Severity;
  state: AlertState;
}

/**
 * An alert the page shows as new, and why.
 *
 * @beta
 */
export interface AlertChange {
  alert: AlertView;
  /** `new`: not shown before, or raised again after a clear. `rose`: a graver severity. */
  change: "new" | "rose";
}

/**
 * Compares `alerts` with what the page last showed (`seen`) and returns
 * the alerts to announce and the next `seen`. A cleared alert is never
 * announced; an id no longer passed is forgotten, so its next raise is
 * new.
 *
 * @beta
 */
export function alertChanges(
  seen: ReadonlyMap<string, Seen>,
  alerts: readonly AlertView[],
): { seen: Map<string, Seen>; changes: AlertChange[] } {
  const next = new Map<string, Seen>();
  const changes: AlertChange[] = [];
  for (const a of alerts) {
    next.set(a.alertId, { severity: a.severity, state: a.state });
    if (a.state === "cleared") continue;
    const before = seen.get(a.alertId);
    if (before === undefined || before.state === "cleared") {
      changes.push({ alert: a, change: "new" });
    } else if (GRAVITY[a.severity] > GRAVITY[before.severity]) {
      changes.push({ alert: a, change: "rose" });
    }
  }
  return { seen: next, changes };
}

/**
 * The alerts that keep the tone going: critical, not cleared, not
 * acknowledged on this console (PLAN §14 Q15).
 *
 * @beta
 */
export function soundingAlerts(alerts: readonly AlertView[]): AlertView[] {
  return alerts.filter(
    (a) =>
      a.severity === "critical" && a.state !== "cleared" && !a.acknowledged,
  );
}
