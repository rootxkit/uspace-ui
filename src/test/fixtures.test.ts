import { describe, expect, it } from "vitest";

import * as model from "../model/index.js";
import { fixtures } from "./fixtures.js";

const f = fixtures();
const idents = f.tracks.flatMap((t) =>
  t.identification ? [t.identification] : [],
);
const times = [...f.tracks, ...f.manned].map((t) => t.times);

// Every enumeration and where its values must appear in the fixtures.
const COVERAGE: [string, readonly string[], readonly unknown[]][] = [
  ["TRUSTS", model.TRUSTS, f.tracks.map((t) => t.trust)],
  ["ALT_SOURCES", model.ALT_SOURCES, f.tracks.map((t) => t.altSource)],
  ["TIME_SOURCES", model.TIME_SOURCES, times.map((t) => t.timeSource)],
  ["IDENT_STATUSES", model.IDENT_STATUSES, idents.map((i) => i.status)],
  ["IDENT_REASONS", model.IDENT_REASONS, idents.map((i) => i.reason)],
  ["IDENT_BASES", model.IDENT_BASES, idents.map((i) => i.basis)],
  ["ZONE_TYPES", model.ZONE_TYPES, f.zones.map((z) => z.type)],
  [
    "VERTICAL_REFS",
    model.VERTICAL_REFS,
    f.zones.flatMap((z) => [z.lowerRef, z.upperRef]),
  ],
  [
    "RESTRICTION_STATES",
    model.RESTRICTION_STATES,
    f.zones.map((z) => z.restrictionState),
  ],
  ["SEVERITIES", model.SEVERITIES, f.alerts.map((a) => a.severity)],
  ["ALERT_KINDS", model.ALERT_KINDS, f.alerts.map((a) => a.kind)],
  ["VIOLATION_KINDS", model.VIOLATION_KINDS, f.alerts.map((a) => a.kind)],
  ["ALERT_STATES", model.ALERT_STATES, f.alerts.map((a) => a.state)],
  ["CLEAR_REASONS", model.CLEAR_REASONS, f.alerts.map((a) => a.clearReason)],
  ["SOURCE_STATES", model.SOURCE_STATES, f.sources.map((s) => s.state)],
  ["DISABLED_BYS", model.DISABLED_BYS, f.sources.map((s) => s.disabledBy)],
];

describe("fixtures", () => {
  it("covers every enumeration of the model", () => {
    const covered = COVERAGE.map(([name]) => name).sort();
    const exported = Object.keys(model)
      .filter((k) => /^[A-Z_]+$/.test(k))
      .sort();
    expect(covered).toEqual(exported);
  });

  it.each(COVERAGE)(
    "every %s value appears at least once",
    (_name, values, seen) => {
      const present = new Set(seen);
      expect(values.filter((v) => !present.has(v))).toEqual([]);
    },
  );

  it("carries unknowns as null, never as zero (presence of each null)", () => {
    expect(f.tracks.some((t) => t.identification === null)).toBe(true);
    expect(f.tracks.some((t) => t.altAmslM === null)).toBe(true);
    expect(f.tracks.some((t) => t.trackDeg === null)).toBe(true);
    expect(f.tracks.some((t) => t.heightRef === null)).toBe(true);
    expect(f.zones.some((z) => z.applies === null)).toBe(true);
    expect(f.zones.some((z) => z.restrictionState === null)).toBe(true);
    expect(times.some((t) => t.ts === null)).toBe(true);
    expect(times.some((t) => t.backlog)).toBe(true);
    expect(f.tracks.some((t) => t.identification?.mismatch === true)).toBe(
      true,
    );
  });

  it("gives no threshold a default: the status frame has not sent one", () => {
    expect(f.status.staleAfterS).toBeNull();
    expect(f.status.liveMaxAgeS).toBeNull();
  });

  it("keeps a clear reason only on cleared alerts and a disabler only on disabled sources", () => {
    for (const a of f.alerts)
      expect(a.clearReason === null).toBe(a.state !== "cleared");
    for (const s of f.sources)
      expect(s.disabledBy === null).toBe(s.state !== "disabled");
  });

  it("is deterministic", () => {
    expect(fixtures()).toEqual(f);
  });

  it("uses GEO-TEST-* registrations and TEST* serials, callsigns and ids", () => {
    const json = JSON.stringify(f);
    const fields = (key: string): string[] =>
      [...json.matchAll(new RegExp(`"${key}":"([^"]*)"`, "g"))].map(
        (m) => m[1] ?? "",
      );

    const registrations = [
      ...fields("operatorReg"),
      ...fields("registeredOperatorReg"),
      ...fields("identifier"),
    ];
    const tested = [
      ...fields("serial"),
      ...fields("callsign"),
      ...fields("icao24"),
      ...fields("trackId"),
      ...fields("alertId"),
      ...fields("flightId"),
      ...fields("intentId"),
      ...fields("disabledByWho"),
    ];
    // Presence: each pattern is exercised on real values, not on nothing.
    expect(registrations.length).toBeGreaterThan(10);
    expect(tested.length).toBeGreaterThan(10);
    expect(registrations.filter((v) => !/^GEO-TEST-/.test(v))).toEqual([]);
    expect(tested.filter((v) => !/^TEST/.test(v))).toEqual([]);
  });

  it("fails the number check on a real-looking value (the check can fail)", () => {
    const json = JSON.stringify({
      operatorReg: "GEO-OP-0001",
      serial: "1581F5FKD",
    });
    expect(/"operatorReg":"GEO-TEST-/.test(json)).toBe(false);
    expect(/"serial":"TEST/.test(json)).toBe(false);
  });
});
