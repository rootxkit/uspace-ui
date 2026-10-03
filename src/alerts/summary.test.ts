// The one-line summaries (WP-11): one per alert and violation kind in
// both languages (a presence loop over the model's arrays: a kind
// without a summary fails), units in every number (E-13), the broadcast
// caveat with its authenticated twin (R-05), the zone notes of R-09 and
// Z-09 with their absent twins, no loss claim for a silent link (C-12),
// a clear's own numbers and never the raise's (C-14), and dashes for
// what the server did not send.
import { describe, expect, it } from "vitest";

import { DASH } from "../i18n/format.js";
import { createTranslator } from "../i18n/translate.js";
import {
  ALERT_KINDS,
  CLEAR_REASONS,
  VIOLATION_KINDS,
  type AlertView,
} from "../model/index.js";
import { alert, cleared, EVERY_KIND } from "./fixtures.testing.js";
import {
  AlertSummary,
  alertPeer,
  alertSummary,
  detailFlag,
  detailNumber,
  detailString,
  detailStrings,
} from "./summary.js";
import { ALERT_KIND_KEYS, ALERT_SUMMARY_KEYS } from "./words.js";

const LANGS = ["en", "ka"] as const;
const UNVERIFIED = { en: /unverified/, ka: /დაუდასტურებ/ } as const;
const LOST = /lost|დაკარგ/i;

const en = (a: AlertView): string => AlertSummary({ alert: a, lang: "en" });
const ka = (a: AlertView): string => AlertSummary({ alert: a, lang: "ka" });

describe("every kind has a summary (presence)", () => {
  for (const kind of [...ALERT_KINDS, ...VIOLATION_KINDS]) {
    for (const lang of LANGS) {
      it(`${kind} in ${lang}, raised and cleared`, () => {
        expect(Object.hasOwn(ALERT_SUMMARY_KEYS, kind)).toBe(true);
        expect(Object.hasOwn(ALERT_KIND_KEYS, kind)).toBe(true);
        for (const a of [alert({ kind }), cleared(kind)]) {
          const s = AlertSummary({ alert: a, lang });
          expect(s.trim()).not.toBe("");
          // Not a key, not an unfilled placeholder.
          expect(s).not.toMatch(/alert\.|[{}]/);
        }
      });
    }
  }

  it("the loop covers both model arrays", () => {
    expect(EVERY_KIND).toEqual(
      expect.arrayContaining([...ALERT_KINDS, ...VIOLATION_KINDS]),
    );
  });

  it("a kind this kit does not know is shown as sent, never blank or a crash", () => {
    const newer = alert({ kind: "TEST_newer_kind" as AlertView["kind"] });
    expect(en(newer)).toBe("TEST_newer_kind");
    expect(en({ ...newer, state: "cleared", clearReason: "resolved" })).toBe(
      "Cleared: resolved",
    );
  });
});

describe("proximity", () => {
  it("states the server's numbers with their units", () => {
    expect(en(alert())).toBe(
      "Converging with TEST-TRK-0002: closest 120 m horizontally in 42 s, 15 m apart vertically",
    );
    expect(ka(alert())).toContain("120 მ");
    expect(ka(alert())).toContain("42 წმ");
  });

  for (const lang of LANGS) {
    it(`a broadcast peer is said to be unverified (${lang})`, () => {
      const a = alert({
        detail: {
          ...alert().detail,
          peer: { track_id: "TEST-TRK-0002", trust: "broadcast" },
        },
      });
      expect(AlertSummary({ alert: a, lang })).toMatch(UNVERIFIED[lang]);
    });

    it(`an authenticated peer is not (the twin, ${lang})`, () => {
      expect(AlertSummary({ alert: alert(), lang })).not.toMatch(
        UNVERIFIED[lang],
      );
    });
  }

  it("a provider peer is unverified too (R-05)", () => {
    const a = alert({
      detail: { peer: { track_id: "TEST-TRK-0009", trust: "provider" } },
    });
    expect(en(a)).toContain(
      "TEST-TRK-0009 is reported by a provider, unverified",
    );
  });

  it("says converging, never collision (C-12)", () => {
    expect(en(alert())).toMatch(/^Converging/);
    expect(en(alert())).not.toMatch(/collision/i);
  });

  it("missing numbers are dashes, never zeros", () => {
    const a = alert({ detail: {}, peerTrackId: null });
    expect(en(a)).toBe(
      `Converging with ${DASH}: closest ${DASH} m horizontally in ${DASH} s, ${DASH} m apart vertically`,
    );
  });

  it("a vertical the server sent as null stays a dash, not an alias", () => {
    const a = alert({
      detail: { d_cpa_h_m: 80, t_cpa_s: 10, d_alt_m: null, d_alt_at_cpa_m: 5 },
    });
    expect(en(a)).toContain(`${DASH} m apart vertically`);
  });

  it("reads core v1.3.0's names when the spec's are absent", () => {
    const a = alert({
      detail: { t_cpa_s: 30, d_cpa_horizontal_m: 55, d_alt_at_cpa_m: 9 },
    });
    expect(en(a)).toContain("closest 55 m horizontally in 30 s, 9 m apart");
  });

  it("the peer is the alert's peerTrackId when the detail names none", () => {
    const a = alert({ detail: { t_cpa_s: 5 }, peerTrackId: "TEST-TRK-0007" });
    expect(en(a)).toMatch(/^Converging with TEST-TRK-0007/);
    expect(alertPeer(a)).toEqual({ trackId: "TEST-TRK-0007", trust: null });
  });

  it("a malformed peer is ignored, not trusted", () => {
    for (const peer of [null, "TEST", ["TEST"], 4]) {
      const a = alert({ detail: { peer }, peerTrackId: null });
      expect(alertPeer(a)).toEqual({ trackId: null, trust: null });
    }
  });
});

describe("zone_incursion", () => {
  const zone = (detail: Record<string, unknown>): AlertView =>
    alert({ kind: "zone_incursion", detail });

  it("names the zone and its type", () => {
    expect(en(zone({ zone_id: "GEO-TEST-Z1", zone_type: "PROHIBITED" }))).toBe(
      "Inside zone GEO-TEST-Z1 (Prohibited)",
    );
  });

  it("an unknown zone type is shown as sent; a missing one is a dash", () => {
    expect(en(zone({ zone_id: "Z", zone_type: "NEW_TYPE" }))).toBe(
      "Inside zone Z (NEW_TYPE)",
    );
    expect(en(zone({}))).toBe(`Inside zone ${DASH} (${DASH})`);
  });

  it("reads core's `identifier` when `zone_id` is absent", () => {
    expect(en(zone({ identifier: "GEO-TEST-Z2" }))).toContain("GEO-TEST-Z2");
  });

  it("within_band false adds the pressure note (R-09)", () => {
    expect(en(zone({ within_band: false }))).toContain(
      "within the widened band (pressure altitude)",
    );
    expect(ka(zone({ within_band: false }))).toContain("ბარომეტრული სიმაღლე");
  });

  it("within_band true or absent adds nothing (the twin)", () => {
    expect(en(zone({ within_band: true }))).not.toContain("widened");
    expect(en(zone({}))).not.toContain("widened");
  });

  it("limit_not_judged adds the reasons the API gave (Z-09)", () => {
    const s = en(
      zone({
        limit_not_judged: true,
        vertical_known: false,
        not_judged: ["AGL", "WGS84"],
      }),
    );
    expect(s).toContain("limit not judged (AGL, WGS84)");
    expect(s).toContain("vertical position not known");
  });

  it("limit_not_judged without reasons says so without inventing one", () => {
    expect(en(zone({ limit_not_judged: true }))).toMatch(/limit not judged$/);
  });

  it("no flags, no notes (the twin)", () => {
    const s = en(zone({ limit_not_judged: false, vertical_known: true }));
    expect(s).not.toMatch(/not judged|not known/);
  });
});

describe("the other kinds", () => {
  it("lost_link says no telemetry, never lost, in both languages (C-12)", () => {
    const a = alert({ kind: "lost_link" });
    expect(en(a)).toBe("no telemetry for 17 s");
    for (const s of [en(a), ka(a), en(cleared("lost_link"))]) {
      expect(s).not.toMatch(LOST);
    }
  });

  it("nonconformance names the reason, or shows an unknown one as sent", () => {
    expect(en(alert({ kind: "nonconformance" }))).toBe(
      "Outside its authorised intent (deviation threshold exceeded): 64 m outside the authorised volume horizontally, 12 m above it",
    );
    expect(
      en(alert({ kind: "nonconformance", detail: { reason: "before_start" } })),
    ).toContain("(before_start)");
    expect(en(alert({ kind: "nonconformance", detail: {} }))).toContain(
      `(${DASH})`,
    );
  });

  it("height_exceedance and height_120m give metres over, with the datum", () => {
    expect(en(alert({ kind: "height_exceedance" }))).toBe(
      "18 m over the authorised upper limit",
    );
    expect(en(alert({ kind: "height_120m" }))).toBe(
      "134 m AGL, 14 m over the height limit",
    );
  });

  it("height_120m names the terrain source when sent, and not otherwise", () => {
    const d = {
      height_agl_m: 130,
      height_over_m: 10,
      terrain_source: "TEST-DEM",
    };
    expect(en(alert({ kind: "height_120m", detail: d }))).toContain(
      "ground height from TEST-DEM",
    );
    expect(en(alert({ kind: "height_120m" }))).not.toContain("ground height");
  });

  it("restriction_activated says updated, withdrawn, or neither", () => {
    const r = (detail: Record<string, unknown>) =>
      en(alert({ kind: "restriction_activated", detail }));
    expect(r({ restriction_id: "R1", authorisation_updated: true })).toBe(
      "Restriction R1 active; the authorisation was updated",
    );
    expect(r({ restriction_id: "R1", authorisation_withdrawn: true })).toBe(
      "Restriction R1 active; the authorisation was withdrawn",
    );
    expect(r({ restriction_id: "R1", withdrawn: true })).toContain("withdrawn");
    expect(r({ restriction_id: "R1" })).toBe("Restriction R1 active");
  });

  it("emergency_nearby carries a broadcast peer's caveat", () => {
    const a = alert({
      kind: "emergency_nearby",
      detail: { peer: { track_id: "TEST-TRK-0005", trust: "broadcast" } },
    });
    expect(en(a)).toContain("TEST-TRK-0005 is broadcast and unverified");
    expect(en(alert({ kind: "emergency_nearby" }))).not.toMatch(/unverified/);
  });
});

describe("a clear (C-14)", () => {
  it("shows the clear's numbers, not the raise's", () => {
    const s = en(cleared("proximity"));
    expect(s).toBe(
      "Cleared: resolved (closest 940 m horizontally in 0 s, 70 m apart vertically)",
    );
    expect(s).not.toContain("120");
    expect(s).not.toContain("42 s");
  });

  it("a clear without its own numbers shows dashes, never the raise's", () => {
    const a = alert({
      state: "cleared",
      clearReason: "stale",
      detail: { d_cpa_h_m: 120, t_cpa_s: 42, d_alt_m: 15 },
    });
    const s = en(a);
    expect(s).toContain(`closest ${DASH} m`);
    expect(s).not.toMatch(/120|42/);
  });

  it("names every clear reason in both languages", () => {
    for (const reason of CLEAR_REASONS) {
      const a = cleared("unregistered", { clearReason: reason });
      for (const lang of LANGS) {
        const s = AlertSummary({ alert: a, lang });
        expect(s).not.toMatch(/alert\.|[{}]/);
      }
      expect(en(a)).toMatch(/^Cleared: /);
    }
    expect(en(cleared("unregistered", { clearReason: "landed" }))).toBe(
      "Cleared: the aircraft landed",
    );
  });

  it("a clear with no reason shows a dash", () => {
    expect(en(cleared("rid_absent", { clearReason: null }))).toBe(
      `Cleared: ${DASH}`,
    );
  });

  it("a zone clear names its zone", () => {
    expect(en(cleared("zone_incursion"))).toBe(
      "Cleared: resolved (zone GEO-TEST-ZONE-0001)",
    );
  });

  it("other kinds with numbers read their clearing_ values", () => {
    expect(en(cleared("lost_link"))).toBe(
      "Cleared: resolved (no telemetry for 19 s)",
    );
    expect(en(cleared("height_120m"))).toContain("118 m AGL, 0 m over");
  });
});

describe("the translator and the detail readers", () => {
  it("alertSummary uses the translator it is given (an app's catalogue)", () => {
    const t = createTranslator("en", {
      en: { "alert.summary.unregistered": "TEST app wording" },
    });
    expect(alertSummary(alert({ kind: "unregistered" }), t, "en")).toBe(
      "TEST app wording",
    );
    expect(
      AlertSummary({
        alert: alert({ kind: "unregistered" }),
        lang: "en",
        catalogues: { en: { "alert.summary.unregistered": "TEST again" } },
      }),
    ).toBe("TEST again");
  });

  it("numbers: finite only, first key present wins", () => {
    expect(detailNumber({ a: 1 }, "a")).toBe(1);
    expect(detailNumber({ a: Number.NaN }, "a")).toBeNull();
    expect(detailNumber({ a: "1" }, "a")).toBeNull();
    expect(detailNumber({ b: 2 }, "a", "b")).toBe(2);
    expect(detailNumber({}, "a")).toBeNull();
  });

  it("strings, flags and lists ignore what is not their type", () => {
    expect(detailString({ a: " " }, "a")).toBeNull();
    expect(detailString({ a: 1 }, "a")).toBeNull();
    expect(detailString({ b: "x" }, "a", "b")).toBe("x");
    expect(detailString({}, "a")).toBeNull();
    expect(detailFlag({ a: "true" }, "a")).toBeNull();
    expect(detailFlag({ a: false }, "a")).toBe(false);
    expect(detailFlag({}, "a")).toBeNull();
    expect(detailStrings({ a: ["x", 1, "", "y"] }, "a")).toEqual(["x", "y"]);
    expect(detailStrings({ a: "x" }, "a")).toEqual([]);
    expect(detailStrings({}, "a")).toEqual([]);
  });

  it("an inherited key is not read as sent", () => {
    const d = Object.create({ t_cpa_s: 5 }) as Record<string, unknown>;
    expect(detailNumber(d, "t_cpa_s")).toBeNull();
  });
});
