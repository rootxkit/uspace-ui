import { beforeEach, describe, expect, it } from "vitest";

import { i18nCounters, missingKeys, resetI18nCounters } from "./counters.js";
import { createTranslator, interpolate } from "./translate.js";

beforeEach(() => {
  resetI18nCounters();
});

describe("interpolate", () => {
  it("fills {name} placeholders with strings and numbers", () => {
    expect(interpolate("{a} and {b}", { a: "x", b: 2 })).toBe("x and 2");
  });

  it("leaves an unknown placeholder visible rather than empty", () => {
    expect(interpolate("as of {date}", {})).toBe("as of {date}");
    expect(interpolate("as of {date}")).toBe("as of {date}");
  });

  it("does not take a placeholder from the object prototype", () => {
    expect(interpolate("{constructor}", {})).toBe("{constructor}");
  });
});

describe("createTranslator", () => {
  it("translates a kit key in each language and counts nothing", () => {
    expect(createTranslator("en")("map.layers")).toBe("Layers");
    expect(createTranslator("ka")("map.layers")).toBe("ფენები");
    expect(missingKeys()).toBe(0);
  });

  it("interpolates", () => {
    expect(
      createTranslator("en")("map.osm_as_of", { date: "2026-10-01" }),
    ).toBe("OSM data as of 2026-10-01 (UTC)");
  });

  it("puts the app's catalogue ahead of the kit's", () => {
    const t = createTranslator("ka", {
      ka: { "map.layers": "APP", "app.only": "აპი" },
    });
    expect(t("map.layers")).toBe("APP");
    expect(t("app.only")).toBe("აპი");
    expect(missingKeys()).toBe(0);
  });

  it("falls back from ka to en, never to the key, and counts it", () => {
    const t = createTranslator("ka", { en: { "app.en_only": "English only" } });
    expect(t("app.en_only")).toBe("English only");
    expect(missingKeys()).toBe(1);
    expect(i18nCounters().missing_ka).toBe(1);
  });

  it("shows the key only when neither language has it, and counts it", () => {
    expect(createTranslator("en")("app.nowhere")).toBe("app.nowhere");
    expect(createTranslator("ka")("app.nowhere")).toBe("app.nowhere");
    expect(i18nCounters().missing_key).toBe(2);
    expect(missingKeys()).toBe(2);
  });

  it("does not resolve a key from the object prototype", () => {
    expect(createTranslator("en")("constructor")).toBe("constructor");
    expect(i18nCounters().missing_key).toBe(1);
  });

  it("picks _one and _other by count, per language", () => {
    const en = createTranslator("en");
    expect(en("feed.dropped", { count: 1 })).toBe("1 frame dropped");
    expect(en("feed.dropped", { count: 3 })).toBe("3 frames dropped");
    expect(en("feed.dropped", { count: 0 })).toBe("0 frames dropped");
    const ka = createTranslator("ka");
    expect(ka("feed.dropped", { count: 1 })).toBe("გამოტოვებულია 1 კადრი");
    expect(ka("feed.dropped", { count: 5 })).toBe("გამოტოვებულია 5 კადრი");
    expect(missingKeys()).toBe(0);
  });

  it("uses _other when the language has no _one, and the plain key without suffixes", () => {
    const t = createTranslator("en", {
      en: { "app.n_other": "{count} things", "app.plain": "{count} plain" },
    });
    expect(t("app.n", { count: 1 })).toBe("1 things");
    expect(t("app.plain", { count: 1 })).toBe("1 plain");
    expect(missingKeys()).toBe(0);
  });

  it("falls back to the en plural form from ka, counted", () => {
    const t = createTranslator("ka", {
      en: { "app.n_one": "{count} thing", "app.n_other": "{count} things" },
    });
    expect(t("app.n", { count: 2 })).toBe("2 things");
    expect(i18nCounters().missing_ka).toBe(1);
  });

  it("does not pluralise on a non-numeric count", () => {
    expect(createTranslator("en")("feed.dropped", { count: "many" })).toBe(
      "feed.dropped",
    );
    expect(i18nCounters().missing_key).toBe(1);
  });
});

describe("counters", () => {
  it("reset to zero", () => {
    createTranslator("en")("app.nowhere");
    expect(missingKeys()).toBe(1);
    resetI18nCounters();
    expect(missingKeys()).toBe(0);
    expect(Object.values(i18nCounters())).toEqual([0, 0, 0, 0]);
  });
});
