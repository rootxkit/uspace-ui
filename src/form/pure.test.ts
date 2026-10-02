// The form kit's pure parts: field paths both ways, numbers in each
// language (a decimal comma in ka, a point in en, a misplaced group sign
// refused), UTC text in and out without the browser's zone, the shape
// helpers, and the error map that turns every zod issue into a kit key.
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { en } from "../i18n/en.js";
import { kitErrorMap } from "./messages.js";
import { formatLocaleNumber, parseLocaleNumber } from "./number.js";
import { toFieldName, toJsonPath } from "./paths.js";
import * as shapes from "./shapes.js";
import { inputToUtc, isRfc3339, isRfc3339Utc, utcToInput } from "./utc.js";

describe("paths", () => {
  it.each([
    ["features[0].properties.name", "features.0.properties.name"],
    [
      "features[3].geometry[0].coordinates",
      "features.3.geometry.0.coordinates",
    ],
    ["$.features[1].id", "features.1.id"],
    ['features[0]["odd key"]', "features.0.odd key"],
    ["/features/2/properties/a~1b", "features.2.properties.a/b"],
    ["bbox", "bbox"],
    ["", ""],
  ])("%s -> %s", (path, name) => {
    expect(toFieldName(path)).toBe(name);
  });

  it("writes a field name back as the API's JSON path", () => {
    expect(toJsonPath("features.0.properties.name")).toBe(
      "features[0].properties.name",
    );
    expect(toJsonPath("bbox.2")).toBe("bbox[2]");
    expect(toJsonPath("0.a")).toBe("[0].a");
  });
});

describe("numbers", () => {
  it.each([
    ["ka", "1,5", 1.5],
    ["en", "1.5", 1.5],
    ["ka", "1.5", 1.5],
    ["ka", "1 234,5", 1234.5],
    ["ka", "1 234,5", 1234.5],
    ["en", "1,234.5", 1234.5],
    ["en", "-12", -12],
    ["en", "−12", -12],
    ["en", " 7 ", 7],
    ["en", "0", 0],
  ] as const)("%s %j -> %s", (lang, text, v) => {
    expect(parseLocaleNumber(text, lang)).toBe(v);
  });

  it("is null for an empty box, never 0", () => {
    expect(parseLocaleNumber("", "en")).toBeNull();
    expect(parseLocaleNumber("   ", "ka")).toBeNull();
  });

  it.each([
    ["en", "1,5"],
    ["en", "12,34"],
    ["en", "abc"],
    ["ka", "1,2,3"],
    ["en", "1e3"],
    ["en", "--1"],
  ] as const)("refuses %s %j as not a number", (lang, text) => {
    expect(parseLocaleNumber(text, lang)).toBeNaN();
  });

  it("formats a stored number in the box's language, without grouping", () => {
    expect(formatLocaleNumber(1234.5, "ka")).toBe("1234,5");
    expect(formatLocaleNumber(1234.5, "en")).toBe("1234.5");
    expect(formatLocaleNumber(null, "en")).toBe("");
    expect(formatLocaleNumber(Number.NaN, "en")).toBe("");
  });
});

describe("UTC text", () => {
  const TZ = process.env["TZ"];
  afterEach(() => {
    if (TZ === undefined) delete process.env["TZ"];
    else process.env["TZ"] = TZ;
  });

  it("reads the box as UTC and writes RFC 3339 with Z", () => {
    expect(inputToUtc("2026-03-29T00:30")).toBe("2026-03-29T00:30:00Z");
    expect(inputToUtc("2026-03-29T00:30:15")).toBe("2026-03-29T00:30:15Z");
    expect(inputToUtc("2026-03-29T00:30:15.250")).toBe("2026-03-29T00:30:15Z");
    expect(inputToUtc("")).toBeNull();
    expect(inputToUtc("2026-03-29")).toBeNull();
  });

  it("shows a time in UTC, an offset time converted, seconds only when set", () => {
    expect(utcToInput("2026-03-29T00:30:00Z")).toBe("2026-03-29T00:30");
    expect(utcToInput("2026-03-29T04:30:00+04:00")).toBe("2026-03-29T00:30");
    expect(utcToInput("2026-03-29T00:30:07.000Z")).toBe("2026-03-29T00:30:07");
    expect(utcToInput(null)).toBe("");
    expect(utcToInput("2026-03-29T00:30:00")).toBe("");
    expect(utcToInput("2026-13-45T99:99:00Z")).toBe("");
  });

  // The brief says "Europe/Tbilisi"; the IANA name is Asia/Tbilisi, and an
  // unknown zone silently runs as UTC, which the presence check catches.
  it.each(["Asia/Tbilisi", "Europe/London", "America/New_York"])(
    "round-trips 00:30Z and 01:30Z on the London DST night in %s",
    (tz) => {
      process.env["TZ"] = tz;
      // The fake zone took effect (presence): the local hour differs.
      const local = new Date("2026-03-29T01:30:00Z").getHours();
      expect(local).toBe(
        { "Asia/Tbilisi": 5, "Europe/London": 2, "America/New_York": 21 }[tz],
      );
      for (const iso of ["2026-03-29T00:30:00Z", "2026-03-29T01:30:00Z"])
        expect(inputToUtc(utcToInput(iso))).toBe(iso);
    },
  );

  it("tells RFC 3339 from a time without a zone", () => {
    expect(isRfc3339("2026-10-02T09:15:06.123+04:00")).toBe(true);
    expect(isRfc3339Utc("2026-10-02T09:15:06.123+04:00")).toBe(false);
    expect(isRfc3339Utc("2026-10-02T09:15:06Z")).toBe(true);
    expect(isRfc3339("2026-10-02 09:15:06")).toBe(false);
  });
});

describe("shapes", () => {
  const issues = (r: { success: boolean; error?: z.ZodError }) =>
    r.error?.issues.map((i) => i.message) ?? [];

  it("bbox: refuses west of east and south of north, naming the pair; accepts the twin", () => {
    const s = shapes.bbox();
    expect(issues(s.safeParse([45, 41, 44, 42]))).toEqual([
      "form.error.bbox_lng_order",
    ]);
    expect(issues(s.safeParse([44, 42, 45, 41]))).toEqual([
      "form.error.bbox_lat_order",
    ]);
    expect(s.safeParse([44.7, 41.6, 44.9, 41.8]).success).toBe(true);
  });

  it("reason: required, then at least the caller's length, trimmed", () => {
    const s = shapes.reason(10);
    expect(issues(s.safeParse("   "))).toEqual(["form.error.required"]);
    expect(issues(s.safeParse(" short "))).toEqual([
      "form.error.reason_too_short",
    ]);
    expect(s.parse("  receiver maintenance  ")).toBe("receiver maintenance");
  });

  it("utcTime: only RFC 3339 with Z", () => {
    const s = shapes.utcTime();
    expect(s.safeParse("2026-03-29T00:30:00Z").success).toBe(true);
    expect(issues(s.safeParse("2026-03-29T04:30:00+04:00"))).toEqual([
      "form.error.not_utc",
    ]);
  });
});

describe("kitErrorMap", () => {
  const message = (schema: z.ZodType, v: unknown): string | undefined =>
    schema.safeParse(v, { error: kitErrorMap }).error?.issues[0]?.message;

  it.each([
    [z.number(), undefined, "form.error.required"],
    [z.number(), null, "form.error.required"],
    [z.number(), Number.NaN, "form.error.not_a_number"],
    [z.number(), "x", "form.error.not_a_number"],
    [z.string(), 5, "form.error.invalid_type"],
    [z.string(), "", null],
    [z.string().min(1), "", "form.error.required"],
    [z.string().min(3), "ab", "form.error.too_small"],
    [z.number().max(3), 4, "form.error.too_big"],
    [z.enum(["a", "b"]), "c", "form.error.not_in_list"],
    [z.email(), "nope", "form.error.invalid_format"],
    [
      z.object({ a: z.string() }).strict(),
      { a: "x", b: 1 },
      "form.error.invalid",
    ],
  ] as const)("%#: maps to %s", (schema, v, key) => {
    expect(message(schema as z.ZodType, v) ?? null).toBe(key);
  });

  it("only ever answers with keys the catalogue has", () => {
    for (const k of [
      "form.error.required",
      "form.error.not_a_number",
      "form.error.invalid_type",
      "form.error.too_small",
      "form.error.too_big",
      "form.error.not_in_list",
      "form.error.invalid_format",
      "form.error.invalid",
      "form.error.not_utc",
      "form.error.bbox_lng_order",
      "form.error.bbox_lat_order",
      "form.error.reason_too_short",
    ])
      expect(Object.hasOwn(en, k), k).toBe(true);
  });

  it("keeps a message the app wrote itself (the twin)", () => {
    const s = z.string().refine((v) => v === "ok", { message: "app.custom" });
    expect(message(s, "no")).toBe("app.custom");
  });
});
