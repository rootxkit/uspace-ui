import { beforeEach, describe, expect, it } from "vitest";

import { ALT_SOURCES, VERTICAL_REFS } from "../model/index.js";
import { i18nCounters, resetI18nCounters } from "./counters.js";
import {
  DASH,
  fmtAge,
  fmtAltitude,
  fmtDistance,
  fmtHeading,
  fmtHeight,
  fmtNum,
  fmtRegistrationNumber,
  fmtSpeed,
  fmtTimeLocal,
  fmtTimeUTC,
} from "./format.js";

// ka-GE groups thousands with a no-break space from five digits on
// (CLDR minimumGroupingDigits 2); en-GB with a comma.
const NBSP = /[  ]/;

beforeEach(() => {
  resetI18nCounters();
});

describe("fmtNum", () => {
  it("is a dash for null, undefined, NaN and Infinity, never a zero", () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(fmtNum(v)).toBe(DASH);
    }
  });

  it("prints digits and the unit; zero is a value", () => {
    expect(fmtNum(0)).toBe("0");
    expect(fmtNum(12.345, 1, "m")).toBe("12.3 m");
    expect(fmtNum(12, 0, "")).toBe("12");
  });

  it("formats per locale with a language", () => {
    expect(fmtNum(12345.5, 1, undefined, "en")).toBe("12,345.5");
    const ka = fmtNum(12345.5, 1, undefined, "ka");
    expect(ka.replace(NBSP, " ")).toBe("12 345,5");
    // CLDR ka: no grouping below five digits
    expect(fmtNum(1234.5, 1, undefined, "ka")).toBe("1234,5");
  });
});

describe("fmtAltitude", () => {
  it("(550, AMSL) says AMSL", () => {
    expect(fmtAltitude(550, "AMSL", "en")).toBe("550 m AMSL");
    expect(fmtAltitude(550, "AMSL", "ka")).toBe("550 მ ზღვის დონიდან");
  });

  it("(120, AGL) says AGL", () => {
    expect(fmtAltitude(120, "AGL", "en")).toBe("120 m AGL");
    expect(fmtAltitude(120, "AGL", "ka")).toBe("120 მ მიწიდან");
  });

  it("(600, pressure) says pressure altitude and not AMSL", () => {
    const en = fmtAltitude(600, "pressure", "en");
    expect(en).toBe("600 m pressure altitude");
    expect(en).not.toMatch(/AMSL/);
    const ka = fmtAltitude(600, "pressure", "ka");
    expect(ka).toBe("600 მ ბარომეტრული სიმაღლე");
    expect(ka).not.toMatch(/ზღვის/);
  });

  it("a geodetic source is AMSL, a network one says it is the provider's", () => {
    expect(fmtAltitude(550, "geodetic", "en")).toBe("550 m AMSL");
    expect(fmtAltitude(550, "network", "en")).toBe(
      "550 m AMSL, as the network provider reported",
    );
    expect(fmtAltitude(550, "WGS84", "en")).toBe(
      "550 m above the WGS84 ellipsoid",
    );
  });

  it("is a dash for a null value, for source none and for no datum", () => {
    expect(fmtAltitude(null, "AMSL", "en")).toBe(DASH);
    expect(fmtAltitude(550, "none", "en")).toBe(DASH);
    expect(fmtAltitude(550, null, "en")).toBe(DASH);
  });

  it("names a datum for every reference and source but none", () => {
    for (const ref of [...VERTICAL_REFS, ...ALT_SOURCES]) {
      for (const lang of ["en", "ka"] as const) {
        const s = fmtAltitude(100, ref, lang);
        if (ref === "none") expect(s).toBe(DASH);
        else expect(s).not.toMatch(/^100 (m|მ)$/);
      }
    }
  });

  it("groups thousands per locale", () => {
    expect(fmtAltitude(1250, "AMSL", "en")).toBe("1,250 m AMSL");
  });
});

describe("fmtHeight", () => {
  it("says above take-off for TakeoffLocation, never AGL (R-12)", () => {
    expect(fmtHeight(40, "TakeoffLocation", "en")).toBe("40 m above take-off");
    expect(fmtHeight(40, "TakeoffLocation", "ka")).toBe(
      "40 მ აფრენის წერტილიდან",
    );
  });

  it("says above ground for GroundLevel", () => {
    expect(fmtHeight(40, "GroundLevel", "en")).toBe("40 m above ground");
    expect(fmtHeight(40, "GroundLevel", "ka")).toBe("40 მ მიწიდან");
  });

  it("is a dash without a value or a reference", () => {
    expect(fmtHeight(null, "GroundLevel", "en")).toBe(DASH);
    expect(fmtHeight(40, null, "en")).toBe(DASH);
  });
});

describe("fmtAge", () => {
  it("prints seconds, minutes, hours and days, truncated", () => {
    expect(fmtAge(3, "en")).toBe("3 s");
    expect(fmtAge(0, "en")).toBe("0 s");
    expect(fmtAge(59.4, "en")).toBe("59 s");
    expect(fmtAge(150, "en")).toBe("2 min");
    expect(fmtAge(3 * 3600 + 59 * 60, "en")).toBe("3 h");
    expect(fmtAge(50 * 3600, "en")).toBe("2 d");
  });

  it("speaks Georgian", () => {
    expect(fmtAge(3, "ka")).toBe("3 წმ");
    expect(fmtAge(150, "ka")).toBe("2 წთ");
    expect(fmtAge(7200, "ka")).toBe("2 სთ");
    expect(fmtAge(86400, "ka")).toBe("1 დღე");
  });

  it("shows a negative age (clock skew) as it is", () => {
    expect(fmtAge(-4, "en")).toBe("-4 s");
  });

  it("is a dash when unknown", () => {
    expect(fmtAge(null, "en")).toBe(DASH);
    expect(fmtAge(NaN, "ka")).toBe(DASH);
  });
});

describe("fmtTimeUTC", () => {
  const iso = "2026-10-02T14:03:27.512Z";

  it("ends with UTC in both languages", () => {
    expect(fmtTimeUTC(iso, "en")).toBe("2026-10-02 14:03 UTC");
    expect(fmtTimeUTC(iso, "ka")).toBe("2026-10-02 14:03 UTC");
    expect(fmtTimeUTC(iso, "ka")).toMatch(/UTC$/);
  });

  it("adds seconds on request", () => {
    expect(fmtTimeUTC(iso, "en", { seconds: true })).toBe(
      "2026-10-02 14:03:27 UTC",
    );
  });

  it("converts an offset to UTC", () => {
    expect(fmtTimeUTC("2026-10-02T18:03:00+04:00", "en")).toBe(
      "2026-10-02 14:03 UTC",
    );
  });

  it("refuses a time without a zone, and nonsense, as a counted dash", () => {
    expect(fmtTimeUTC("2026-10-02T14:03:00", "en")).toBe(DASH);
    expect(fmtTimeUTC("not a time Z", "en")).toBe(DASH);
    expect(i18nCounters().time_refused).toBe(2);
  });

  it("is a dash for null, uncounted", () => {
    expect(fmtTimeUTC(null, "en")).toBe(DASH);
    expect(i18nCounters().time_refused).toBe(0);
  });
});

describe("fmtTimeLocal", () => {
  it("shows the time in the given zone and names the zone", () => {
    expect(fmtTimeLocal("2026-10-02T14:03:00Z", "en", "Asia/Tbilisi")).toBe(
      "2026-10-02 18:03 Asia/Tbilisi",
    );
    expect(fmtTimeLocal("2026-10-02T14:03:00Z", "ka", "Asia/Tbilisi")).toBe(
      "2026-10-02 18:03 Asia/Tbilisi",
    );
  });

  it("is a dash for null and for a time without a zone", () => {
    expect(fmtTimeLocal(null, "en", "Asia/Tbilisi")).toBe(DASH);
    expect(fmtTimeLocal("2026-10-02T14:03", "en", "UTC")).toBe(DASH);
  });

  it("throws on an unknown zone: the zone is configuration", () => {
    expect(() =>
      fmtTimeLocal("2026-10-02T14:03:00Z", "en", "Mars/Olympus"),
    ).toThrow(RangeError);
  });
});

describe("fmtSpeed, fmtDistance, fmtHeading", () => {
  it("prints m/s with one decimal", () => {
    expect(fmtSpeed(12.34, "en")).toBe("12.3 m/s");
    expect(fmtSpeed(12.34, "ka")).toBe("12,3 მ/წმ");
    expect(fmtSpeed(null, "en")).toBe(DASH);
  });

  it("prints metres and never converts to km", () => {
    expect(fmtDistance(1250, "en")).toBe("1,250 m");
    expect(fmtDistance(12500, "ka").replace(NBSP, " ")).toBe("12 500 მ");
    expect(fmtDistance(null, "en")).toBe(DASH);
  });

  it("prints three-digit whole degrees, 360 as 000", () => {
    expect(fmtHeading(45)).toBe("045°");
    expect(fmtHeading(0)).toBe("000°");
    expect(fmtHeading(359.6)).toBe("000°");
    expect(fmtHeading(-90)).toBe("270°");
    expect(fmtHeading(null)).toBe(DASH);
  });
});

describe("fmtRegistrationNumber (06 §5, G-04 display side)", () => {
  it("returns the public part of GEO12345678abcd-XYZ and counts one refusal", () => {
    expect(fmtRegistrationNumber("GEO12345678abcd-XYZ")).toBe(
      "GEO12345678abcd",
    );
    expect(i18nCounters().registration_secret_refused).toBe(1);
  });

  it("passes GEO-OP-ABC through: a hyphenated public form has no secret", () => {
    expect(fmtRegistrationNumber("GEO-OP-ABC")).toBe("GEO-OP-ABC");
    expect(i18nCounters().registration_secret_refused).toBe(0);
  });

  it("passes a plain number through, trimmed", () => {
    expect(fmtRegistrationNumber(" GEO12345678abcd ")).toBe("GEO12345678abcd");
    expect(fmtRegistrationNumber("FIN87astrdge12k8-x!z")).toBe(
      "FIN87astrdge12k8-x!z",
    );
    expect(fmtRegistrationNumber("GEO12345678abcd-XY")).toBe(
      "GEO12345678abcd-XY",
    );
    expect(i18nCounters().registration_secret_refused).toBe(0);
  });

  it("is a dash for null and blank", () => {
    expect(fmtRegistrationNumber(null)).toBe(DASH);
    expect(fmtRegistrationNumber("  ")).toBe(DASH);
  });
});
