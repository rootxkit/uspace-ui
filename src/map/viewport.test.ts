import { describe, expect, it } from "vitest";

import { mapText, MAP_MESSAGES } from "./messages.js";
import { bboxText, subscriptionBBox, viewportBBox } from "./viewport.js";

describe("subscriptionBBox", () => {
  const view = { minLng: 44.71, minLat: 41.62, maxLng: 44.89, maxLat: 41.78 };

  it("is the view widened outwards to the quantum with no margin", () => {
    expect(subscriptionBBox(view, 0, 0.1)).toEqual({
      minLng: 44.7,
      minLat: 41.6,
      maxLng: 44.9,
      maxLat: 41.8,
    });
  });

  it("pads by the margin fraction of the width and height on every side", () => {
    // width 0.18 and height 0.16: half pads by 0.09 and 0.08
    expect(subscriptionBBox(view, 0.5, 0.01)).toEqual({
      minLng: 44.62,
      minLat: 41.54,
      maxLng: 44.98,
      maxLat: 41.86,
    });
  });

  it("gives the same box for a pan smaller than the quantum", () => {
    const moved = {
      minLng: view.minLng + 0.005,
      minLat: view.minLat,
      maxLng: view.maxLng + 0.005,
      maxLat: view.maxLat,
    };
    expect(subscriptionBBox(moved, 0, 0.1)).toEqual(
      subscriptionBBox(view, 0, 0.1),
    );
  });

  it("clamps to the WGS84 range", () => {
    expect(
      subscriptionBBox(
        { minLng: -179.5, minLat: -89.5, maxLng: 179.5, maxLat: 89.5 },
        0.5,
        1,
      ),
    ).toEqual({ minLng: -180, minLat: -90, maxLng: 180, maxLat: 90 });
  });
});

describe("viewportBBox", () => {
  const v = {
    center: [44.8, 41.7] as [number, number],
    zoom: 12,
    bearing: 0,
    pitch: 0,
  };

  it("is the centre point for an unmeasured container", () => {
    const b = viewportBBox(v, 0, 0);
    expect(b.minLng).toBeCloseTo(44.8, 9);
    expect(b.maxLng).toBeCloseTo(44.8, 9);
    expect(b.minLat).toBeCloseTo(41.7, 9);
    expect(b.maxLat).toBeCloseTo(41.7, 9);
  });

  it("is [lng, lat] ordered around the centre for a measured container", () => {
    const b = viewportBBox(v, 1024, 512);
    expect(b.minLng).toBeLessThan(44.8);
    expect(b.maxLng).toBeGreaterThan(44.8);
    expect(b.minLat).toBeLessThan(41.7);
    expect(b.maxLat).toBeGreaterThan(41.7);
    // 1024 px at zoom 12 is 1024 / (512 * 4096) of 360 degrees
    expect(b.maxLng - b.minLng).toBeCloseTo((1024 / (512 * 4096)) * 360, 9);
  });
});

describe("bboxText", () => {
  it("prints four decimals in lng, lat order", () => {
    expect(
      mapText(
        "en",
        "map.bbox",
        bboxText({ minLng: 44.7, minLat: 41.6, maxLng: 44.9, maxLat: 41.8 }),
      ),
    ).toBe("44.7000, 41.6000 to 44.9000, 41.8000 (lng, lat, WGS84)");
  });
});

describe("map messages", () => {
  it("have the same keys in ka and en", () => {
    expect(Object.keys(MAP_MESSAGES.ka).sort()).toEqual(
      Object.keys(MAP_MESSAGES.en).sort(),
    );
  });

  it("translate every key: no value equals its key or its English", () => {
    for (const [key, value] of Object.entries(MAP_MESSAGES.en)) {
      expect(value).not.toBe(key);
      expect(MAP_MESSAGES.ka[key as keyof typeof MAP_MESSAGES.ka]).not.toBe(
        value,
      );
    }
  });

  it("have the same placeholders in both languages", () => {
    const holes = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [key, value] of Object.entries(MAP_MESSAGES.en)) {
      expect(
        holes(MAP_MESSAGES.ka[key as keyof typeof MAP_MESSAGES.ka]),
      ).toEqual(holes(value));
    }
  });

  it("leave an unknown placeholder visible rather than empty", () => {
    expect(mapText("en", "map.osm_as_of")).toBe("OSM data as of {date} (UTC)");
    expect(mapText("en", "map.osm_as_of", { date: "2026-10-01" })).toBe(
      "OSM data as of 2026-10-01 (UTC)",
    );
  });

  it("never say lost", () => {
    for (const lang of ["en", "ka"] as const) {
      for (const value of Object.values(MAP_MESSAGES[lang])) {
        expect(value).not.toMatch(/lost|დაკარგ/i);
      }
    }
  });
});
