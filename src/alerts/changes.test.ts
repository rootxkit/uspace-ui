// The display bookkeeping (WP-11): order (critical first, then most
// recently raised), one entry per id with the duplicate counted (C-06),
// what counts as new (a first raise, a raise after a clear) and what as a
// rise (C-07), each with the twin that is not, and the sounding set.
import { afterEach, describe, expect, it } from "vitest";

import { alert } from "./fixtures.testing.js";
import {
  alertChanges,
  sortAlerts,
  soundingAlerts,
  uniqueById,
  type Seen,
} from "./changes.js";
import { alertCounters, resetAlertCountersForTests } from "./counters.js";

afterEach(() => {
  resetAlertCountersForTests();
});

const ids = (list: { alertId: string }[]): string[] =>
  list.map((a) => a.alertId);

describe("sortAlerts", () => {
  it("critical first, then warning, then info; newest raise first within one", () => {
    const list = [
      alert({
        alertId: "i",
        severity: "info",
        raisedAt: "2026-10-02T09:15:05Z",
      }),
      alert({
        alertId: "w-old",
        severity: "warning",
        raisedAt: "2026-10-02T09:00:00Z",
      }),
      alert({
        alertId: "c-old",
        severity: "critical",
        raisedAt: "2026-10-02T09:00:00Z",
      }),
      alert({
        alertId: "w-new",
        severity: "warning",
        raisedAt: "2026-10-02T09:10:00Z",
      }),
      alert({
        alertId: "c-new",
        severity: "critical",
        raisedAt: "2026-10-02T09:14:00.5Z",
      }),
    ];
    expect(ids(sortAlerts(list))).toEqual([
      "c-new",
      "c-old",
      "w-new",
      "w-old",
      "i",
    ]);
  });

  it("an unreadable raisedAt goes last; ties order by id", () => {
    const list = [
      alert({ alertId: "b", raisedAt: "not a time" }),
      alert({ alertId: "z", raisedAt: "2026-10-02T09:00:00Z" }),
      alert({ alertId: "a", raisedAt: "2026-10-02T09:00:00Z" }),
      alert({ alertId: "c", raisedAt: "2026-10-02T09:00:00" }),
    ];
    expect(ids(sortAlerts(list))).toEqual(["a", "z", "b", "c"]);
  });

  it("does not reorder the input", () => {
    const list = [
      alert({ alertId: "x", severity: "info" }),
      alert({ alertId: "y" }),
    ];
    sortAlerts(list);
    expect(ids(list)).toEqual(["x", "y"]);
  });
});

describe("uniqueById (C-06)", () => {
  it("keeps the later entry of an id and counts the earlier one", () => {
    const out = uniqueById([
      alert({ alertId: "a", severity: "warning" }),
      alert({ alertId: "b" }),
      alert({ alertId: "a", severity: "critical" }),
    ]);
    expect(out.map((a) => [a.alertId, a.severity])).toEqual([
      ["b", "critical"],
      ["a", "critical"],
    ]);
    expect(alertCounters().alert_duplicate_id).toBe(1);
  });

  it("distinct ids pass untouched and count nothing (the twin)", () => {
    expect(
      ids(uniqueById([alert({ alertId: "a" }), alert({ alertId: "b" })])),
    ).toEqual(["a", "b"]);
    expect(alertCounters().alert_duplicate_id).toBe(0);
  });
});

describe("alertChanges", () => {
  const none = new Map<string, Seen>();

  it("a first raise is new", () => {
    const { changes, seen } = alertChanges(none, [alert()]);
    expect(changes.map((c) => c.change)).toEqual(["new"]);
    expect(seen.get("TEST-ALR-0001")).toEqual({
      severity: "critical",
      state: "raised",
    });
  });

  it("an equal re-raise is not new (C-06)", () => {
    const { seen } = alertChanges(none, [alert()]);
    expect(alertChanges(seen, [alert({ state: "raised" })]).changes).toEqual(
      [],
    );
    expect(alertChanges(seen, [alert({ state: "updated" })]).changes).toEqual(
      [],
    );
  });

  it("a severity rise is a change (C-07), a fall is not", () => {
    const { seen } = alertChanges(none, [alert({ severity: "warning" })]);
    expect(
      alertChanges(seen, [alert({ severity: "critical" })]).changes.map(
        (c) => c.change,
      ),
    ).toEqual(["rose"]);
    expect(alertChanges(seen, [alert({ severity: "info" })]).changes).toEqual(
      [],
    );
  });

  it("a clear is never new; a raise after it is", () => {
    const { seen } = alertChanges(none, [alert()]);
    const after = alertChanges(seen, [
      alert({ state: "cleared", clearReason: "resolved" }),
    ]);
    expect(after.changes).toEqual([]);
    expect(
      alertChanges(after.seen, [alert()]).changes.map((c) => c.change),
    ).toEqual(["new"]);
  });

  it("an alert shown first as cleared is not announced", () => {
    expect(
      alertChanges(none, [alert({ state: "cleared", clearReason: "stale" })])
        .changes,
    ).toEqual([]);
  });

  it("an id no longer passed is forgotten, so its next raise is new", () => {
    const { seen } = alertChanges(none, [alert()]);
    const gone = alertChanges(seen, []);
    expect(gone.seen.size).toBe(0);
    expect(alertChanges(gone.seen, [alert()]).changes).toHaveLength(1);
  });
});

describe("soundingAlerts", () => {
  it("critical, not cleared, not acknowledged", () => {
    const list = [
      alert({ alertId: "yes" }),
      alert({ alertId: "acked", acknowledged: true }),
      alert({ alertId: "clear", state: "cleared", clearReason: "resolved" }),
      alert({ alertId: "warn", severity: "warning" }),
      alert({ alertId: "updated", state: "updated" }),
    ];
    expect(ids(soundingAlerts(list))).toEqual(["yes", "updated"]);
  });
});
