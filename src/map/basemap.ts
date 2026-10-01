// The self-hosted basemap (PLAN D6, §6.3; LESSONS P1-12): one PMTiles file
// read with HTTP range requests, Protomaps style layers, glyphs and sprites
// under paths the app configures. No third-party request, ever (spec 06 §4).
import { layers, namedFlavor } from "@protomaps/basemaps";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

import { countMap } from "./counters.js";
import type { Lang } from "../i18n/lang.js";
import { createTranslator } from "../i18n/translate.js";

export interface BasemapConfig {
  /** Absolute origin (and base path) the paths below are appended to. */
  baseUrl: string;
  /** Default "/basemap/basemap.pmtiles". */
  pmtilesPath?: string;
  /** Default "/basemap/fonts/{fontstack}/{range}.pbf". */
  glyphsPath?: string;
  /** Default "/basemap/sprites/v4/{flavor}"; `{flavor}` is light or dark. */
  spritesPath?: string;
  /** Default "/basemap/SOURCE.json". */
  sourceInfoPath?: string;
}

/** From SOURCE.json: an offline map has no other way to say it is stale. */
export interface BasemapInfo {
  /** [[minLng, minLat], [maxLng, maxLat]], WGS84 degrees. */
  bounds: [[number, number], [number, number]];
  osmDataAsOf: string | null;
}

export type MapScheme = "light" | "dark";

/** The bundle layout of PLAN §6.3, relative to `baseUrl`. */
export const BASEMAP_DEFAULT_PATHS = {
  pmtilesPath: "/basemap/basemap.pmtiles",
  glyphsPath: "/basemap/fonts/{fontstack}/{range}.pbf",
  spritesPath: "/basemap/sprites/v4/{flavor}",
  sourceInfoPath: "/basemap/SOURCE.json",
} as const;

/** The protomaps source id; layer WPs place their layers above it. */
export const BASEMAP_SOURCE_ID = "protomaps";

type PathKey = keyof typeof BASEMAP_DEFAULT_PATHS;

/** `baseUrl` joined with the configured (or default) path. */
export function basemapUrl(cfg: BasemapConfig, key: PathKey): string {
  const path = cfg[key] ?? BASEMAP_DEFAULT_PATHS[key];
  return cfg.baseUrl.replace(/\/+$/, "") + path;
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );
}

/** The OSM date as SOURCE.json gives it: the date part of an RFC 3339 UTC time. */
function osmDate(asOf: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(asOf) ? asOf.slice(0, 10) : asOf;
}

/** The attribution of the basemap source, with the extract's OSM date. */
export function basemapAttribution(
  info: BasemapInfo | null,
  lang: Lang,
): string {
  const t = createTranslator(lang);
  if (info === null) return t("map.no_basemap_attribution");
  const parts = [
    '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
  ];
  if (info.osmDataAsOf !== null) {
    parts.push(
      escapeHtml(t("map.osm_as_of", { date: osmDate(info.osmDataAsOf) })),
    );
  }
  parts.push('<a href="https://protomaps.com">Protomaps</a>');
  return parts.join(" · ");
}

// The basemap library has no Georgian. In Georgia OSM's plain `name` is the
// Georgian name and an extract may lack `name:ka`, so in `ka` every label
// that shows a name reads `name:ka`, then `name` (predecessor basemap.ts).
// Road shields (`shield_text`, from `ref`) and house numbers are left alone.
function georgianLabels(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== "symbol") return layer;
  const field = layer.layout?.["text-field"];
  if (field === undefined || !JSON.stringify(field).includes('"name')) {
    return layer;
  }
  return {
    ...layer,
    layout: {
      ...layer.layout,
      "text-field": ["coalesce", ["get", "name:ka"], ["get", "name"]],
    },
  };
}

/**
 * The basemap style. With `info === null` (no SOURCE.json) a plain
 * background whose attribution says "no base map"; `MapView` renders the
 * visible notice beside it.
 */
export function basemapStyle(
  cfg: BasemapConfig,
  info: BasemapInfo | null,
  lang: Lang,
  scheme: MapScheme,
): StyleSpecification {
  const flavor = namedFlavor(scheme);
  if (info === null) {
    return {
      version: 8,
      sources: {
        // An empty source carries the attribution: MapLibre shows the
        // attribution of sources a layer uses.
        "basemap-none": {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          attribution: basemapAttribution(null, lang),
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": flavor.background },
        },
        { id: "basemap-none", type: "fill", source: "basemap-none" },
      ],
    };
  }
  let styleLayers = layers(BASEMAP_SOURCE_ID, flavor, { lang: "en" });
  if (lang === "ka") styleLayers = styleLayers.map(georgianLabels);
  return {
    version: 8,
    glyphs: basemapUrl(cfg, "glyphsPath"),
    sprite: basemapUrl(cfg, "spritesPath").replace("{flavor}", scheme),
    sources: {
      [BASEMAP_SOURCE_ID]: {
        type: "vector",
        url: `pmtiles://${basemapUrl(cfg, "pmtilesPath")}`,
        attribution: basemapAttribution(info, lang),
      },
    },
    layers: styleLayers,
  };
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Reads a SOURCE.json body (PLAN §6.3: `bounds`, `osm_data_as_of`).
 * `bounds` is `[minLng, minLat, maxLng, maxLat]`, the TileJSON order.
 * Anything else is null and counted as malformed.
 */
export function parseSourceInfo(body: unknown): BasemapInfo | null {
  const src = (typeof body === "object" && body !== null ? body : {}) as {
    bounds?: unknown;
    osm_data_as_of?: unknown;
  };
  const b = src.bounds;
  const asOf = src.osm_data_as_of;
  if (
    !Array.isArray(b) ||
    b.length !== 4 ||
    !b.every(isNumber) ||
    !(asOf === undefined || asOf === null || typeof asOf === "string")
  ) {
    countMap("basemap_source_malformed");
    return null;
  }
  const [minLng, minLat, maxLng, maxLat] = b as [
    number,
    number,
    number,
    number,
  ];
  return {
    bounds: [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    osmDataAsOf: typeof asOf === "string" && asOf !== "" ? asOf : null,
  };
}

/**
 * Network timeout of the SOURCE.json fetch. Display-only constant: it
 * decides how long the map shows "loading" before "no base map".
 */
export const SOURCE_INFO_TIMEOUT_MS = 5000;

/**
 * Fetches SOURCE.json. Absent, refused, timed out or malformed is `null`
 * and counted as `basemap_missing`; an abort by `signal` (the caller went
 * away) is `null` and not counted.
 */
export async function loadBasemapInfo(
  cfg: BasemapConfig,
  signal: AbortSignal,
  timeoutMs: number = SOURCE_INFO_TIMEOUT_MS,
): Promise<BasemapInfo | null> {
  const ctrl = new AbortController();
  const onAbort = (): void => ctrl.abort();
  signal.addEventListener("abort", onAbort);
  const timer = setTimeout(onAbort, timeoutMs);
  let info: BasemapInfo | null = null;
  try {
    const res = await fetch(basemapUrl(cfg, "sourceInfoPath"), {
      signal: ctrl.signal,
      cache: "no-cache",
    });
    if (res.ok) info = parseSourceInfo(await res.json());
  } catch {
    info = null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
  if (info === null && !signal.aborted) countMap("basemap_missing");
  return info;
}
