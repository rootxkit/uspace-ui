import { namedFlavor } from "@protomaps/basemaps";
import type { LayerSpecification, SymbolLayerSpecification } from "maplibre-gl";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  basemapAttribution,
  basemapStyle,
  basemapUrl,
  loadBasemapInfo,
  parseSourceInfo,
  type BasemapConfig,
  type BasemapInfo,
} from "./basemap.js";
import { mapCounters } from "./counters.js";

const CFG: BasemapConfig = { baseUrl: "https://kit.test/" };
const INFO: BasemapInfo = {
  bounds: [
    [44.77, 41.68],
    [44.83, 41.73],
  ],
  osmDataAsOf: "2026-10-01T04:00:00Z",
};

function symbols(layers: LayerSpecification[]): SymbolLayerSpecification[] {
  return layers.filter(
    (l): l is SymbolLayerSpecification => l.type === "symbol",
  );
}

function textField(layers: LayerSpecification[], id: string): string {
  const layer = symbols(layers).find((l) => l.id === id);
  if (layer === undefined) throw new Error(`no symbol layer ${id}`);
  return JSON.stringify(layer.layout?.["text-field"]);
}

const KA_FIELD = JSON.stringify([
  "coalesce",
  ["get", "name:ka"],
  ["get", "name"],
]);

describe("basemapStyle", () => {
  it("in ka turns every name text-field into name:ka then name", () => {
    const style = basemapStyle(CFG, INFO, "ka", "light");
    const named = symbols(style.layers).filter((l) =>
      JSON.stringify(
        basemapStyle(CFG, INFO, "en", "light").layers.find(
          (e) => e.id === l.id,
        ),
      ).includes('"name'),
    );
    expect(named.length).toBeGreaterThan(5);
    for (const layer of named) {
      if (JSON.stringify(layer.layout?.["text-field"]).includes("shield")) {
        continue;
      }
      expect(JSON.stringify(layer.layout?.["text-field"])).toBe(KA_FIELD);
    }
    expect(textField(style.layers, "places_locality")).toBe(KA_FIELD);
    expect(textField(style.layers, "roads_labels_major")).toBe(KA_FIELD);
  });

  it("in en leaves the library's name expressions alone", () => {
    const style = basemapStyle(CFG, INFO, "en", "light");
    expect(textField(style.layers, "places_locality")).not.toBe(KA_FIELD);
    expect(textField(style.layers, "places_locality")).toContain("name:en");
    for (const layer of symbols(style.layers)) {
      expect(JSON.stringify(layer.layout?.["text-field"])).not.toBe(KA_FIELD);
    }
  });

  it("leaves road shields (ref) and house numbers untouched in ka", () => {
    const ka = basemapStyle(CFG, INFO, "ka", "light").layers;
    const en = basemapStyle(CFG, INFO, "en", "light").layers;
    expect(textField(ka, "roads_shields")).toBe(textField(en, "roads_shields"));
    expect(textField(ka, "roads_shields")).toContain("shield_text");
    expect(textField(ka, "address_label")).toBe(textField(en, "address_label"));
  });

  it("selects the dark flavour, sprite and background by scheme", () => {
    const dark = basemapStyle(CFG, INFO, "en", "dark");
    const light = basemapStyle(CFG, INFO, "en", "light");
    expect(dark.sprite).toBe("https://kit.test/basemap/sprites/v4/dark");
    expect(light.sprite).toBe("https://kit.test/basemap/sprites/v4/light");
    const bg = (s: typeof dark): unknown =>
      s.layers.find((l) => l.type === "background")?.paint;
    expect(bg(dark)).toEqual({
      "background-color": namedFlavor("dark").background,
    });
    expect(bg(light)).toEqual({
      "background-color": namedFlavor("light").background,
    });
  });

  it("reads tiles, glyphs and sprites from the configured paths only", () => {
    const style = basemapStyle(CFG, INFO, "en", "light");
    expect(style.glyphs).toBe(
      "https://kit.test/basemap/fonts/{fontstack}/{range}.pbf",
    );
    expect(style.sources).toEqual({
      protomaps: {
        type: "vector",
        url: "pmtiles://https://kit.test/basemap/basemap.pmtiles",
        attribution: expect.stringContaining("2026-10-01") as unknown,
      },
    });
    const custom = basemapStyle(
      {
        baseUrl: "https://kit.test/app",
        pmtilesPath: "/m/x.pmtiles",
        glyphsPath: "/m/g/{fontstack}/{range}.pbf",
        spritesPath: "/m/s/{flavor}",
      },
      INFO,
      "en",
      "dark",
    );
    expect(custom.glyphs).toBe(
      "https://kit.test/app/m/g/{fontstack}/{range}.pbf",
    );
    expect(custom.sprite).toBe("https://kit.test/app/m/s/dark");
    expect(JSON.stringify(custom.sources)).toContain(
      "pmtiles://https://kit.test/app/m/x.pmtiles",
    );
  });

  it("with no info is a plain background whose attribution says no base map", () => {
    const style = basemapStyle(CFG, null, "en", "light");
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    expect(JSON.stringify(style)).not.toContain("pmtiles://");
    expect(style.layers.map((l) => l.type)).toEqual(["background", "fill"]);
    expect(style.sources["basemap-none"]).toMatchObject({
      attribution: "no base map",
    });
    expect(
      basemapStyle(CFG, null, "ka", "dark").sources["basemap-none"],
    ).toMatchObject({ attribution: "საბაზისო რუკა არ არის" });
  });
});

describe("basemapAttribution", () => {
  it("contains the OSM date when known, in both languages", () => {
    expect(basemapAttribution(INFO, "en")).toContain(
      "OSM data as of 2026-10-01 (UTC)",
    );
    expect(basemapAttribution(INFO, "ka")).toContain("2026-10-01");
    expect(basemapAttribution(INFO, "en")).toContain("OpenStreetMap");
  });

  it("has no date when SOURCE.json gave none, and never invents one", () => {
    const text = basemapAttribution({ ...INFO, osmDataAsOf: null }, "en");
    expect(text).toContain("OpenStreetMap");
    expect(text).not.toContain("as of");
  });

  it("shows a non-ISO date as given, escaped", () => {
    const text = basemapAttribution(
      { ...INFO, osmDataAsOf: "<b>autumn</b>" },
      "en",
    );
    expect(text).toContain("&lt;b&gt;autumn&lt;/b&gt;");
    expect(text).not.toContain("<b>");
  });

  it("says no base map when there is none", () => {
    expect(basemapAttribution(null, "en")).toBe("no base map");
  });
});

describe("basemapUrl", () => {
  it("joins the base URL and the default paths of PLAN §6.3", () => {
    expect(basemapUrl({ baseUrl: "https://a.test//" }, "sourceInfoPath")).toBe(
      "https://a.test/basemap/SOURCE.json",
    );
    expect(basemapUrl({ baseUrl: "https://a.test" }, "pmtilesPath")).toBe(
      "https://a.test/basemap/basemap.pmtiles",
    );
  });
});

describe("parseSourceInfo", () => {
  it("reads TileJSON-order bounds and the OSM date", () => {
    expect(
      parseSourceInfo({
        bounds: [44.77, 41.68, 44.83, 41.73],
        osm_data_as_of: "2026-10-01T04:00:00Z",
      }),
    ).toEqual(INFO);
  });

  it("keeps an absent or empty OSM date as null", () => {
    expect(parseSourceInfo({ bounds: [1, 2, 3, 4] })?.osmDataAsOf).toBeNull();
    expect(
      parseSourceInfo({ bounds: [1, 2, 3, 4], osm_data_as_of: "" })
        ?.osmDataAsOf,
    ).toBeNull();
  });

  it.each([
    ["no bounds", { osm_data_as_of: "2026-10-01" }],
    ["three numbers", { bounds: [1, 2, 3] }],
    [
      "nested pairs",
      {
        bounds: [
          [1, 2],
          [3, 4],
        ],
      },
    ],
    [
      "a string date of the wrong type",
      { bounds: [1, 2, 3, 4], osm_data_as_of: 5 },
    ],
    ["not an object", "SOURCE"],
    ["null", null],
  ])("refuses %s and counts it as malformed", (_name, body) => {
    const before = mapCounters().basemap_source_malformed;
    expect(parseSourceInfo(body)).toBeNull();
    expect(mapCounters().basemap_source_malformed).toBe(before + 1);
  });
});

describe("loadBasemapInfo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function stubFetch(
    impl: (url: string, init: RequestInit) => Promise<Response>,
  ) {
    const fn = vi.fn(impl);
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("returns the info from SOURCE.json and counts nothing", async () => {
    const fetchFn = stubFetch(() =>
      Promise.resolve(
        Response.json({
          bounds: [44.77, 41.68, 44.83, 41.73],
          osm_data_as_of: "2026-10-01T04:00:00Z",
        }),
      ),
    );
    const before = mapCounters();
    await expect(
      loadBasemapInfo(CFG, new AbortController().signal),
    ).resolves.toEqual(INFO);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://kit.test/basemap/SOURCE.json",
      expect.objectContaining({ cache: "no-cache" }),
    );
    expect(mapCounters()).toEqual(before);
  });

  it("is null and counted on a 404", async () => {
    stubFetch(() => Promise.resolve(new Response("", { status: 404 })));
    const before = mapCounters().basemap_missing;
    await expect(
      loadBasemapInfo(CFG, new AbortController().signal),
    ).resolves.toBeNull();
    expect(mapCounters().basemap_missing).toBe(before + 1);
  });

  it("is null and counted on a network error or a body that is not JSON", async () => {
    const before = mapCounters().basemap_missing;
    stubFetch(() => Promise.reject(new TypeError("network")));
    await expect(
      loadBasemapInfo(CFG, new AbortController().signal),
    ).resolves.toBeNull();
    stubFetch(() => Promise.resolve(new Response("not json")));
    await expect(
      loadBasemapInfo(CFG, new AbortController().signal),
    ).resolves.toBeNull();
    expect(mapCounters().basemap_missing).toBe(before + 2);
  });

  it("is null and counted as missing and malformed on a malformed body", async () => {
    stubFetch(() => Promise.resolve(Response.json({ bbox: "1,2,3,4" })));
    const before = mapCounters();
    await expect(
      loadBasemapInfo(CFG, new AbortController().signal),
    ).resolves.toBeNull();
    expect(mapCounters().basemap_missing).toBe(before.basemap_missing + 1);
    expect(mapCounters().basemap_source_malformed).toBe(
      before.basemap_source_malformed + 1,
    );
  });

  // A fetch that answers only by aborting, as a hung server does.
  function hangingFetch() {
    return stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
  }

  it("times out, then is null and counted", async () => {
    vi.useFakeTimers();
    hangingFetch();
    const before = mapCounters().basemap_missing;
    const result = loadBasemapInfo(CFG, new AbortController().signal, 1000);
    await vi.advanceTimersByTimeAsync(999);
    expect(mapCounters().basemap_missing).toBe(before);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBeNull();
    expect(mapCounters().basemap_missing).toBe(before + 1);
  });

  it("is null and not counted when the caller aborts", async () => {
    hangingFetch();
    const before = mapCounters().basemap_missing;
    const ctrl = new AbortController();
    const result = loadBasemapInfo(CFG, ctrl.signal);
    ctrl.abort();
    await expect(result).resolves.toBeNull();
    expect(mapCounters().basemap_missing).toBe(before);
  });
});
