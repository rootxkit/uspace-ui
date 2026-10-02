import { waitFor, within } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import {
  I18nProvider,
  type Catalogues,
  type Lang,
} from "../../src/i18n/index.js";
import {
  MapControls,
  MapView,
  type LayerToggle,
  type MapScheme,
} from "../../src/map/index.js";
import "../../styles/map.css";
import { EN_LIGHT, renderKit } from "../kit.js";
import { basemapBaseUrl } from "./basemap.js";

// Display-only sample camera: the centre of the committed extract.
const TBILISI = {
  center: [44.8, 41.705] as [number, number],
  zoom: 14,
  bearing: 0,
  pitch: 0,
};

const LABEL_LAYERS = [
  "places_locality",
  "places_subplace",
  "roads_labels_major",
  "roads_labels_minor",
  "pois",
];

// Test-only names for the sample layer toggles, as an app's own
// catalogue: MapControls resolves `labelKey` through the I18nProvider.
const LAYER_NAMES: Catalogues = {
  en: { "test.layer.zones": "Zones", "test.layer.tracks": "Tracks" },
  ka: { "test.layer.zones": "ზონები", "test.layer.tracks": "ტრეკები" },
};

const maps = new WeakMap<Element, MapLibreMap>();

interface MapTestProps {
  lang: Lang;
  scheme: MapScheme;
  basemapPath?: string;
}

function MapTest({ lang, scheme, basemapPath }: MapTestProps) {
  const [current, setScheme] = useState(scheme);
  const [zones, setZones] = useState(true);
  const [tracks, setTracks] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const layers: LayerToggle[] = [
    {
      id: "zones",
      labelKey: "test.layer.zones",
      visible: zones,
      onChange: setZones,
    },
    {
      id: "tracks",
      labelKey: "test.layer.tracks",
      visible: tracks,
      onChange: setTracks,
    },
  ];
  const base = basemapBaseUrl();
  return (
    <I18nProvider lang={lang} catalogues={LAYER_NAMES}>
      <div ref={setHost} style={{ height: 480 }} data-testid="map-host">
        <MapView
          basemap={{
            baseUrl: basemapPath === undefined ? base : base + basemapPath,
          }}
          initial={TBILISI}
          lang={lang}
          scheme={current}
          onLoad={(m) => {
            if (host !== null) maps.set(host, m);
            host?.setAttribute("data-loaded", "true");
          }}
        >
          <MapControls layers={layers} scheme onSchemeChange={setScheme} />
        </MapView>
      </div>
    </I18nProvider>
  );
}

async function loadedMap(canvasElement: HTMLElement): Promise<MapLibreMap> {
  const host = within(canvasElement).getByTestId("map-host");
  await waitFor(() => expect(host.getAttribute("data-loaded")).toBe("true"), {
    timeout: 20000,
  });
  const map = maps.get(host);
  if (map === undefined) throw new Error("onLoad did not hand over the map");
  expect(host.querySelector("canvas.maplibregl-canvas")).not.toBeNull();
  return map;
}

/**
 * Every resource the page fetched came from the test page's own origin. Glyph
 * requests come from MapLibre's worker and are not in the page's resource
 * timeline, so the style's own URLs are checked as well.
 */
async function expectSameOriginOnly(map: MapLibreMap): Promise<void> {
  const origin = window.location.origin;
  const urls = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => !u.startsWith("data:") && !u.startsWith("blob:"));
  const foreign = urls.filter((u) => !u.startsWith(origin));
  expect(foreign).toEqual([]);
  expect(urls.some((u) => u.includes("/basemap/"))).toBe(true);
  const style = map.getStyle();
  const styleUrls = [
    style.glyphs,
    typeof style.sprite === "string" ? style.sprite : undefined,
    ...Object.values(style.sources).map((src) =>
      "url" in src && typeof src.url === "string"
        ? src.url.replace(/^pmtiles:\/\//, "")
        : undefined,
    ),
  ].filter((u): u is string => u !== undefined);
  expect(styleUrls.filter((u) => !u.startsWith(origin))).toEqual([]);
}

async function renderedNames(map: MapLibreMap): Promise<string[]> {
  const layers = LABEL_LAYERS.filter((id) => map.getLayer(id) !== undefined);
  return map
    .queryRenderedFeatures({ layers })
    .map((f) => {
      const p = f.properties as Record<string, unknown>;
      return String(p["name:ka"] ?? p["name"] ?? "");
    })
    .filter((n) => n !== "");
}

it("English, light", async () => {
  const canvasElement = renderKit(
    <MapTest lang="en" scheme="light" />,
    EN_LIGHT,
  ).container;
  const map = await loadedMap(canvasElement);
  const attribution = canvasElement.querySelector(".maplibregl-ctrl-attrib");
  await waitFor(() =>
    expect(attribution?.textContent).toContain("OSM data as of 2026-10-01"),
  );
  expect(map.getStyle().sprite).toContain("/basemap/sprites/v4/light");
  await expectSameOriginOnly(map);
});

it("Georgian, light", async () => {
  const canvasElement = renderKit(
    <MapTest lang="ka" scheme="light" />,
    EN_LIGHT,
  ).container;
  const map = await loadedMap(canvasElement);
  // A label layer drew a Georgian name (Mkhedruli), read from the map's
  // rendered features rather than from pixels.
  await waitFor(
    async () => {
      const names = await renderedNames(map);
      expect(names.some((n) => /[ა-ჿ]/.test(n))).toBe(true);
    },
    { timeout: 20000 },
  );
  expect(
    JSON.stringify(map.getLayoutProperty("places_locality", "text-field")),
  ).toContain("name:ka");
  await expectSameOriginOnly(map);
});

it("English, dark", async () => {
  const canvasElement = renderKit(
    <MapTest lang="en" scheme="dark" />,
    EN_LIGHT,
  ).container;
  const map = await loadedMap(canvasElement);
  expect(map.getStyle().sprite).toContain("/basemap/sprites/v4/dark");
  // The controls take the dark tokens from the map's own data-theme,
  // although the page around it is light (styles/tokens.css).
  const canvas = within(canvasElement);
  const layers = canvas.getByRole("button", { name: "Layers" });
  expect(getComputedStyle(layers).backgroundColor).toBe("rgb(27, 31, 38)");
  // The layer sheet opens with the toggles; axe runs with it open.
  await userEvent.click(layers);
  const page = within(canvasElement.ownerDocument.body);
  const sheet = await page.findByRole("dialog", { name: "Layers" });
  expect(
    within(sheet).getByRole("checkbox", { name: "Zones" }),
  ).toHaveAttribute("aria-checked", "true");
  await userEvent.click(
    within(sheet).getByRole("checkbox", { name: "Tracks" }),
  );
  expect(
    within(sheet).getByRole("checkbox", { name: "Tracks" }),
  ).toHaveAttribute("aria-checked", "true");
});

it("Georgian, dark", async () => {
  const canvasElement = renderKit(
    <MapTest lang="ka" scheme="dark" />,
    EN_LIGHT,
  ).container;
  await loadedMap(canvasElement);
  expect(
    within(canvasElement).getByRole("button", { name: "მასშტაბის გაზრდა" }),
  ).toBeTruthy();
});

it("no basemap", async () => {
  const canvasElement = renderKit(
    <MapTest lang="en" scheme="light" basemapPath="no-such-basemap" />,
    EN_LIGHT,
  ).container;
  const canvas = within(canvasElement);
  expect(
    await canvas.findByText(/No base map: positions are drawn/, undefined, {
      timeout: 10000,
    }),
  ).toBeTruthy();
  const map = await loadedMap(canvasElement);
  await expectSameOriginOnly(map);
});

const getContext = HTMLCanvasElement.prototype.getContext;

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContext;
});

it("no WebGL", async () => {
  // Simulates a browser without WebGL; restored after the test.
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    if (type.startsWith("webgl")) return null;
    return (getContext as (...a: unknown[]) => unknown).call(
      this,
      type,
      ...rest,
    );
  } as typeof getContext;
  const canvasElement = renderKit(
    <MapTest lang="en" scheme="light" />,
    EN_LIGHT,
  ).container;
  const canvas = within(canvasElement);
  const notice = await canvas.findByText(
    /this browser has no WebGL/,
    undefined,
    {
      timeout: 10000,
    },
  );
  expect(notice.textContent).toMatch(/\(lng, lat, WGS84\)/);
  expect(notice.textContent).toMatch(
    /44\.\d{4}, 41\.\d{4} to 44\.\d{4}, 41\.\d{4}/,
  );
});
