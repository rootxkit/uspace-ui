// The catalogues are a safety surface (CLAUDE.md rule 5, docs/PLAN.md
// §3.4): parity, well-formed placeholders, every key the source uses, and
// the wording rules pinned word by word, each with its presence twin
// (E-01).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ALERT_KIND_KEYS,
  ALERT_STATE_KEYS,
  ALERT_SUMMARY_KEYS,
  CLEAR_REASON_KEYS,
  NONCONFORMANCE_REASON_KEYS,
} from "../alerts/words.js";
import {
  ALERT_KINDS,
  CLEAR_REASONS,
  DISABLED_BYS,
  SOURCE_STATES,
  VIOLATION_KINDS,
} from "../model/index.js";
import { AGE_BUCKET_KEYS } from "../symbology/age.js";
import {
  IDENT_BASIS_KEYS,
  IDENT_REASON_KEYS,
  IDENT_STATUS_HINT_KEYS,
  IDENT_STATUS_KEYS,
} from "../symbology/ident.js";
import {
  CONNECTION_KEYS,
  DEGRADED_KEYS,
  DISABLED_BY_KEYS,
  SOURCE_STATE_KEYS,
} from "../status/words.js";
import { RESTRICTION_STATE_KEYS } from "../symbology/restriction.js";
import { SEVERITY_HINT_KEYS, SEVERITY_KEYS } from "../symbology/severity.js";
import {
  TRUST_FILL_KEYS,
  TRUST_KEYS,
  TRUST_MEANING_KEYS,
} from "../symbology/track.js";
import { ZONE_PATTERN_KEYS, ZONE_TYPE_KEYS } from "../symbology/zone.js";
import { INTENT_STATE_KEYS } from "../symbology/intent.js";
import { MANNED_SOURCE_CLASS_KEYS } from "../symbology/manned.js";
import { ALT_SOURCE_KEYS, TIME_SOURCE_KEYS } from "../status/TrackDetail.js";
import { en, type Key } from "./en.js";
import { ALTITUDE_KEYS, HEIGHT_KEYS } from "./format.js";
import { ka } from "./ka.js";

const catalogues = { en, ka } as const;
const keys = Object.keys(en) as Key[];

const holes = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();

describe("parity", () => {
  it("every en key is in ka", () => {
    expect(keys.filter((k) => !Object.hasOwn(ka, k))).toEqual([]);
  });

  it("every ka key is in en", () => {
    expect(Object.keys(ka).filter((k) => !Object.hasOwn(en, k))).toEqual([]);
  });

  it("has keys to compare (not two empty catalogues)", () => {
    expect(keys.length).toBeGreaterThan(80);
  });

  it("no en value is its key", () => {
    expect(keys.filter((k) => en[k] === k)).toEqual([]);
  });

  it("no value is empty", () => {
    for (const lang of ["en", "ka"] as const) {
      expect(keys.filter((k) => catalogues[lang][k].trim() === "")).toEqual([]);
    }
  });

  it("the map's ka text is Georgian, not a copy of the English", () => {
    const copies = keys.filter((k) => k.startsWith("map.") && ka[k] === en[k]);
    expect(copies).toEqual([]);
  });

  it("every _one has its _other", () => {
    const ones = keys.filter((k) => k.endsWith("_one"));
    expect(ones.length).toBeGreaterThan(0);
    for (const k of ones) expect(keys).toContain(k.replace(/_one$/, "_other"));
  });
});

describe("placeholders", () => {
  it("no value has a { or } outside a {name}", () => {
    for (const lang of ["en", "ka"] as const) {
      const bad = keys.filter((k) =>
        /[{}]/.test(catalogues[lang][k].replace(/\{\w+\}/g, "")),
      );
      expect(bad, lang).toEqual([]);
    }
  });

  it("the check sees an unmatched brace", () => {
    expect(/[{}]/.test("{v m AMSL".replace(/\{\w+\}/g, ""))).toBe(true);
  });

  it("ka has the same placeholders as en, key by key", () => {
    expect(
      keys.filter((k) => holes(ka[k]).join() !== holes(en[k]).join()),
    ).toEqual([]);
  });
});

// --- every key the source uses exists -------------------------------------

/** Every literal key in `t("…")` and `t('…')` calls. */
function literalKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*["']([^"']+)["']/g)].map(
    (m) => m[1] ?? "",
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.(test|testing|d)\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

// Keys passed to t() as values, not literals, with where they come from.
// Each table is typed `Key`, so the compiler checks them; this list says
// the dynamic calls were looked at.
const DYNAMIC_KEYS: Readonly<Record<string, readonly string[]>> = {
  // fmtAltitude: t(ALTITUDE_KEYS[ref])
  "src/i18n/format.ts ALTITUDE_KEYS": Object.values(ALTITUDE_KEYS).filter(
    (k): k is Key => k !== null,
  ),
  // fmtHeight: t(HEIGHT_KEYS[ref])
  "src/i18n/format.ts HEIGHT_KEYS": Object.values(HEIGHT_KEYS),
  // LayerPanel: t(labelKey), the app's own key, from the app's catalogue
  "src/map/MapControls.tsx LayerToggle.labelKey": [],
  // ZoneCard, ZoneLegend: t(ZONE_TYPE_KEYS[type])
  "src/symbology/zone.ts ZONE_TYPE_KEYS": Object.values(ZONE_TYPE_KEYS),
  // ZoneLegend: t(ZONE_PATTERN_KEYS[pattern])
  "src/symbology/zone.ts ZONE_PATTERN_KEYS": Object.values(ZONE_PATTERN_KEYS),
  // ZoneCard: t(RESTRICTION_STATE_KEYS[state ?? "unstated"])
  "src/symbology/restriction.ts RESTRICTION_STATE_KEYS": Object.values(
    RESTRICTION_STATE_KEYS,
  ),
  // TrackLegend: t(TRUST_KEYS[t]), t(TRUST_MEANING_KEYS[t]),
  // t(TRUST_FILL_KEYS[fill])
  "src/symbology/track.ts TRUST_KEYS": Object.values(TRUST_KEYS),
  "src/symbology/track.ts TRUST_MEANING_KEYS":
    Object.values(TRUST_MEANING_KEYS),
  "src/symbology/track.ts TRUST_FILL_KEYS": Object.values(TRUST_FILL_KEYS),
  // IdentificationLegend, trackLabel: t(IDENT_STATUS_KEYS[s]),
  // t(IDENT_STATUS_HINT_KEYS[s]); identHintKey's keys (WP-12 renders them)
  "src/symbology/ident.ts IDENT_STATUS_KEYS": Object.values(IDENT_STATUS_KEYS),
  "src/symbology/ident.ts IDENT_STATUS_HINT_KEYS": Object.values(
    IDENT_STATUS_HINT_KEYS,
  ),
  "src/symbology/ident.ts IDENT_REASON_KEYS": Object.values(IDENT_REASON_KEYS),
  "src/symbology/ident.ts IDENT_BASIS_KEYS": Object.values(IDENT_BASIS_KEYS),
  "src/symbology/ident.ts identHintKey caveats": [
    "ident.registered_as_broadcast",
    "ident.caveat.as_broadcast",
    "ident.caveat.provider",
    "ident.mismatch",
  ],
  // AgeLegend: t(AGE_BUCKET_KEYS[b])
  "src/symbology/age.ts AGE_BUCKET_KEYS": Object.values(AGE_BUCKET_KEYS),
  // SeverityLegend: t(SEVERITY_KEYS[s]), t(SEVERITY_HINT_KEYS[s])
  "src/symbology/severity.ts SEVERITY_KEYS": Object.values(SEVERITY_KEYS),
  "src/symbology/severity.ts SEVERITY_HINT_KEYS":
    Object.values(SEVERITY_HINT_KEYS),
  // WP-8 status: t(SOURCE_STATE_KEYS[s]), t(DISABLED_BY_KEYS[d]),
  // t(DEGRADED_KEYS[slug]) (degradedLabel), t(CONNECTION_KEYS[c]);
  // FeedStatusBar's plurals t("feed.dropped"|"feed.malformed", {count})
  "src/status/words.ts SOURCE_STATE_KEYS": Object.values(SOURCE_STATE_KEYS),
  "src/status/words.ts DISABLED_BY_KEYS": Object.values(DISABLED_BY_KEYS),
  "src/status/words.ts DEGRADED_KEYS": Object.values(DEGRADED_KEYS),
  "src/status/words.ts CONNECTION_KEYS": Object.values(CONNECTION_KEYS),
  // WP-11 alerts: t(ALERT_KIND_KEYS[k]) (kindName), t(ALERT_STATE_KEYS[s]),
  // t(CLEAR_REASON_KEYS[r]), t(NONCONFORMANCE_REASON_KEYS[r]),
  // t(ALERT_SUMMARY_KEYS[k]) (summary.ts)
  "src/alerts/words.ts ALERT_KIND_KEYS": Object.values(ALERT_KIND_KEYS),
  "src/alerts/words.ts ALERT_STATE_KEYS": Object.values(ALERT_STATE_KEYS),
  "src/alerts/words.ts CLEAR_REASON_KEYS": Object.values(CLEAR_REASON_KEYS),
  "src/alerts/words.ts NONCONFORMANCE_REASON_KEYS": Object.values(
    NONCONFORMANCE_REASON_KEYS,
  ),
  "src/alerts/words.ts ALERT_SUMMARY_KEYS": Object.values(ALERT_SUMMARY_KEYS),
  // WP-12: IntentLayer and IntentCard t(INTENT_STATE_KEYS[s]); TrackDetail
  // t(ALT_SOURCE_KEYS[s]), t(TIME_SOURCE_KEYS[s]),
  // t(MANNED_SOURCE_CLASS_KEYS[c]) (sourceClassLabel); ReceiverLayer
  // t(SOURCE_STATE_KEYS[s]) (listed under WP-8)
  "src/symbology/intent.ts INTENT_STATE_KEYS": Object.values(INTENT_STATE_KEYS),
  "src/status/TrackDetail.tsx ALT_SOURCE_KEYS": Object.values(ALT_SOURCE_KEYS),
  "src/status/TrackDetail.tsx TIME_SOURCE_KEYS":
    Object.values(TIME_SOURCE_KEYS),
  "src/symbology/manned.ts MANNED_SOURCE_CLASS_KEYS": Object.values(
    MANNED_SOURCE_CLASS_KEYS,
  ),
};

describe("keys used in src/", () => {
  const used = new Map<string, string>();
  for (const file of sourceFiles("src")) {
    for (const k of literalKeys(readFileSync(file, "utf8"))) used.set(k, file);
  }

  it("finds the t() calls (the grep is not vacuous)", () => {
    expect([...used.keys()]).toEqual(
      expect.arrayContaining(["map.zoom_in", "map.osm_as_of", "age.seconds"]),
    );
  });

  // A plural is called by its base key (`t("x", { count })`), which the
  // catalogue holds as `x_one` / `x_other` (translate.ts).
  const known = (k: string): boolean =>
    Object.hasOwn(en, k) || Object.hasOwn(en, `${k}_other`);

  it("every literal key exists in en", () => {
    const unknown = [...used].filter(([k]) => !known(k));
    expect(unknown).toEqual([]);
  });

  it("a plural's base key counts as present, a missing one does not", () => {
    expect(known("zone.legend.count")).toBe(true);
    expect(known("zone.legend.nope")).toBe(false);
  });

  it("every allow-listed dynamic key exists in en", () => {
    for (const ks of Object.values(DYNAMIC_KEYS)) {
      for (const k of ks) expect(Object.hasOwn(en, k), k).toBe(true);
    }
  });

  it("the extractor reports a key that is not in the catalogue", () => {
    const found = literalKeys("const x = t(\"map.nope\", { a: 1 }); t('x.y')");
    expect(found).toEqual(["map.nope", "x.y"]);
    expect(found.filter((k) => !Object.hasOwn(en, k))).toEqual([
      "map.nope",
      "x.y",
    ]);
  });
});

// --- wording rules ----------------------------------------------------------

const UNVERIFIED = { en: /unverified/, ka: /დაუდასტურებ/ } as const;
const LOST = /lost|დაკარგ/i;

// The only keys allowed loss wording: a recorded gap (C-12, B-04). A drop
// counter that moved says "dropped".
const LOSS_KEYS: readonly Key[] = ["feed.gap_recorded"];

describe("R-05: broadcast and unverified", () => {
  it("track.broadcast_caveat says unverified in en and დაუდასტურებელი in ka", () => {
    expect(en["track.broadcast_caveat"]).toMatch(UNVERIFIED.en);
    expect(ka["track.broadcast_caveat"]).toMatch(UNVERIFIED.ka);
  });

  it("every broadcast string says unverified in both languages", () => {
    const broadcast: Key[] = [
      "track.broadcast",
      "track.broadcast_caveat",
      "alert.broadcast_caveat",
      "ident.basis.as_broadcast",
      "ident.basis.provider",
      "ident.registered_as_broadcast",
      // WP-7: the trust names and meanings, the map label, the caveats
      "trust.broadcast",
      "trust.broadcast.meaning",
      "trust.provider",
      "trust.provider.meaning",
      "track.provider",
      "ident.caveat.as_broadcast",
      "ident.caveat.provider",
      // WP-11: a proximity or emergency peer that is not authenticated
      "alert.summary.peer_broadcast",
      "alert.summary.peer_provider",
      // WP-12: a manned track with no trust class, a peer's intent
      "manned.trust_unstated",
      "intent.peer",
    ];
    for (const k of broadcast) {
      expect(en[k], k).toMatch(UNVERIFIED.en);
      expect(ka[k], k).toMatch(UNVERIFIED.ka);
    }
  });

  it("a registration on a broadcast basis says 'as broadcast and unverified'", () => {
    expect(en["ident.basis.as_broadcast"]).toBe("as broadcast and unverified");
    expect(en["ident.registered_as_broadcast"]).toContain(
      "as broadcast and unverified",
    );
  });

  it("an authenticated basis does not say unverified (the twin)", () => {
    expect(en["ident.basis.authenticated"]).not.toMatch(UNVERIFIED.en);
    expect(ka["ident.basis.authenticated"]).not.toMatch(UNVERIFIED.ka);
  });
});

describe("C-12, B-04: no loss claim", () => {
  it("no value says lost / დაკარგ but the listed gap keys", () => {
    for (const lang of ["en", "ka"] as const) {
      const lossy = keys.filter(
        (k) => LOST.test(catalogues[lang][k]) && !LOSS_KEYS.includes(k),
      );
      expect(lossy, lang).toEqual([]);
    }
  });

  it("the listed gap keys do say it, in both languages", () => {
    for (const k of LOSS_KEYS) {
      expect(en[k]).toMatch(LOST);
      expect(ka[k]).toMatch(LOST);
    }
  });

  it("unreachable and lagging name their own state", () => {
    expect(en["source.state.unreachable"]).toMatch(/^unreachable/);
    expect(en["source.state.lagging"]).toMatch(/^lagging/);
    expect(ka["source.state.unreachable"]).toMatch(/^მიუწვდომელია/);
    expect(ka["source.state.lagging"]).toMatch(/^ჩამორჩება/);
  });

  it("every source state and disabled-by value has a key", () => {
    for (const s of SOURCE_STATES) expect(keys).toContain(`source.state.${s}`);
    for (const d of DISABLED_BYS)
      expect(keys).toContain(`source.disabled_by.${d}`);
  });
});

describe("B-11: disabled is not silent", () => {
  for (const lang of ["en", "ka"] as const) {
    it(`'disabled by' and 'silent since' differ in ${lang}`, () => {
      const c = catalogues[lang];
      const disabled = c["source.disabled_by"];
      const silent = c["source.silent_since"];
      expect(disabled).not.toBe(silent);
      const word = { en: [/disabled/, /silent/], ka: [/გამორთ/, /დუმს/] }[lang];
      expect(disabled).toMatch(word[0] as RegExp);
      expect(disabled).not.toMatch(word[1] as RegExp);
      expect(silent).toMatch(word[1] as RegExp);
      expect(silent).not.toMatch(word[0] as RegExp);
    });
  }
});

describe("D-01, E-13, R-09, R-12: datums", () => {
  const datum: Record<string, { en: RegExp; ka: RegExp }> = {
    "alt.amsl": { en: /m AMSL$/, ka: /ზღვის დონიდან$/ },
    "alt.agl": { en: /m AGL$/, ka: /მიწიდან$/ },
    "alt.wgs84": { en: /WGS84 ellipsoid/, ka: /WGS84 ელიფსოიდიდან/ },
    "alt.pressure": { en: /pressure altitude/, ka: /ბარომეტრული სიმაღლე/ },
    "alt.network": { en: /AMSL/, ka: /ზღვის დონიდან/ },
    "height.takeoff": { en: /above take-off/, ka: /აფრენის წერტილიდან/ },
    "height.ground": { en: /above ground/, ka: /მიწიდან/ },
  };

  it("every altitude and height key names its datum", () => {
    const altKeys = keys.filter(
      (k) =>
        /^(alt|height)\./.test(k) &&
        k.includes(".") &&
        holes(en[k]).includes("{v}"),
    );
    expect(altKeys.sort()).toEqual(Object.keys(datum).sort());
    for (const k of altKeys) {
      expect(en[k], k).toMatch((datum[k] as { en: RegExp }).en);
      expect(ka[k], k).toMatch((datum[k] as { ka: RegExp }).ka);
    }
  });

  it("a pressure altitude never says AMSL, height over take-off never says ground", () => {
    expect(en["alt.pressure"]).not.toMatch(/AMSL|sea level/);
    expect(ka["alt.pressure"]).not.toMatch(/ზღვის/);
    expect(en["height.takeoff"]).not.toMatch(/ground|AGL/);
    expect(ka["height.takeoff"]).not.toMatch(/მიწ/);
  });
});

describe("G-10: no registry personal data in track strings", () => {
  const PII = /\{(name|legal_name|email|phone|address|contact|owner)\}/i;

  it("no track, alert or identification value has a personal-data placeholder", () => {
    const bad = keys.filter(
      (k) =>
        /^(track|alert|ident)\./.test(k) &&
        (PII.test(en[k]) || PII.test(ka[k])),
    );
    expect(bad).toEqual([]);
  });

  it("the check sees one", () => {
    expect(PII.test("operator {legal_name}")).toBe(true);
  });
});

describe("WP-11: alert wording", () => {
  const alertKeys = keys.filter((k) => k.startsWith("alert."));

  it("every alert and violation kind, and every clear reason, has a name", () => {
    for (const k of [...ALERT_KINDS, ...VIOLATION_KINDS]) {
      expect(keys).toContain(`alert.kind.${k}`);
      expect(keys).toContain(`alert.summary.${k}`);
    }
    for (const r of CLEAR_REASONS) {
      expect(keys).toContain(`alert.clear_reason.${r}`);
    }
  });

  it("no alert text claims a collision or advises a manoeuvre (C-11, C-12)", () => {
    const advice =
      /collision|collide|descend|climb|hold position|turn (left|right)|land now/i;
    expect(alertKeys.filter((k) => advice.test(en[k]))).toEqual([]);
  });

  it("the advice check sees one", () => {
    expect(/collision|descend/i.test("Descend now")).toBe(true);
  });

  it("lost_link is worded as no telemetry, in both languages (C-12)", () => {
    for (const k of [
      "alert.kind.lost_link",
      "alert.numbers.lost_link",
    ] as const) {
      expect(en[k]).toMatch(/no telemetry/i);
      expect(ka[k]).toMatch(/ტელემეტრია არ მოდის/);
      expect(en[k]).not.toMatch(LOST);
      expect(ka[k]).not.toMatch(LOST);
    }
  });

  it("every number in an alert sentence carries its unit", () => {
    const numbered = alertKeys.filter((k) => k.startsWith("alert.numbers."));
    for (const k of numbered) {
      for (const hole of holes(en[k]).filter((h) => h !== "{zone}")) {
        // The hole is followed by " m" or " s" and then a non-letter.
        const after = `${en[k]}.`.split(hole).slice(1);
        expect(
          after.every((rest) => /^ (m|s)[^a-z]/.test(rest)),
          `${k} ${hole}`,
        ).toBe(true);
      }
    }
  });

  it("the AGL height says AGL, in both languages (E-13)", () => {
    expect(en["alert.numbers.height_120m"]).toContain("m AGL");
    expect(ka["alert.numbers.height_120m"]).toContain("მიწიდან");
  });
});

describe("WP-12: traffic wording", () => {
  it("the pressure rows never say AMSL or sea level (R-09)", () => {
    for (const k of [
      "detail.alt_pressure",
      "detail.alt_source.pressure",
    ] as const) {
      expect(en[k], k).toMatch(/pressure altitude|Pressure altitude/);
      expect(en[k], k).not.toMatch(/AMSL|sea level/);
      expect(ka[k], k).toMatch(/ბარომეტრული სიმაღლე/);
      expect(ka[k], k).not.toMatch(/ზღვის/);
    }
  });

  it("the geodetic source line does not claim to be a pressure altitude (the twin)", () => {
    expect(en["detail.alt_source.geodetic"]).not.toMatch(/pressure/);
    expect(ka["detail.alt_source.geodetic"]).not.toMatch(/ბარომეტრ/);
  });

  it("'current' is the server's word, never the kit's", () => {
    expect(en["intent.active"]).toMatch(/as the server reports/);
    expect(ka["intent.active"]).toMatch(/სერვერის/);
  });

  it("vertical speed says which way is positive (R-10)", () => {
    expect(en["detail.vspeed"]).toMatch(/positive up/);
    expect(ka["detail.vspeed"]).toMatch(/დადებითი ზემოთ/);
  });
});
