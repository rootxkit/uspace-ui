import type { Map as MapLibreMap } from "maplibre-gl";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import {
  MapControls,
  MapView,
  type LayerToggle,
  type MapLang,
  type MapScheme,
} from "../../src/map/index.js";
import "../../styles/map.css";

// The committed Tbilisi extract (stories/basemap/, README.md) is served by
// Storybook at <base>/basemap/ (.storybook/main.ts staticDirs). On Pages the
// preview lives under a sub-path, so the base is the iframe's directory.
function storyBaseUrl(): string {
  const { href, origin, pathname } = window.location;
  return pathname.endsWith("iframe.html") ? new URL(".", href).href : origin;
}

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

// Story-only names for the sample layer toggles.
const LAYER_NAMES: Record<string, string> = {
  "story.layer.zones": "Zones",
  "story.layer.tracks": "Tracks",
};

const maps = new WeakMap<Element, MapLibreMap>();

interface MapStoryProps {
  lang: MapLang;
  scheme: MapScheme;
  basemapPath?: string;
}

function MapStory({ lang, scheme, basemapPath }: MapStoryProps) {
  const [current, setScheme] = useState(scheme);
  const [zones, setZones] = useState(true);
  const [tracks, setTracks] = useState(false);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const layers: LayerToggle[] = [
    {
      id: "zones",
      labelKey: "story.layer.zones",
      visible: zones,
      onChange: setZones,
    },
    {
      id: "tracks",
      labelKey: "story.layer.tracks",
      visible: tracks,
      onChange: setTracks,
    },
  ];
  const base = storyBaseUrl();
  return (
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
        <MapControls
          layers={layers}
          scheme
          onSchemeChange={setScheme}
          translate={(k) => LAYER_NAMES[k] ?? k}
        />
      </MapView>
    </div>
  );
}

const meta = {
  title: "map/MapView",
  component: MapStory,
  args: { lang: "en", scheme: "light" },
} satisfies Meta<typeof MapStory>;

export default meta;
type Story = StoryObj<typeof meta>;

async function loadedMap(canvasElement: HTMLElement): Promise<MapLibreMap> {
  const host = within(canvasElement).getByTestId("map-host");
  await waitFor(() => expect(host.getAttribute("data-loaded")).toBe("true"), {
    timeout: 20000,
  });
  const map = maps.get(host);
  if (map === undefined) throw new Error("onLoad did not hand over the map");
  await expect(host.querySelector("canvas.maplibregl-canvas")).not.toBeNull();
  return map;
}

/**
 * Every resource the page fetched came from the story's own origin. Glyph
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
  await expect(foreign).toEqual([]);
  await expect(urls.some((u) => u.includes("/basemap/"))).toBe(true);
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
  await expect(styleUrls.filter((u) => !u.startsWith(origin))).toEqual([]);
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

export const EnglishLight: Story = {
  play: async ({ canvasElement }) => {
    const map = await loadedMap(canvasElement);
    const attribution = canvasElement.querySelector(".maplibregl-ctrl-attrib");
    await waitFor(() =>
      expect(attribution?.textContent).toContain("OSM data as of 2026-10-01"),
    );
    await expect(map.getStyle().sprite).toContain("/basemap/sprites/v4/light");
    await expectSameOriginOnly(map);
  },
};

export const GeorgianLight: Story = {
  args: { lang: "ka" },
  play: async ({ canvasElement }) => {
    const map = await loadedMap(canvasElement);
    // A label layer drew a Georgian name (Mkhedruli), read from the map's
    // rendered features rather than from pixels.
    await waitFor(
      async () => {
        const names = await renderedNames(map);
        await expect(names.some((n) => /[ა-ჿ]/.test(n))).toBe(true);
      },
      { timeout: 20000 },
    );
    await expect(
      JSON.stringify(map.getLayoutProperty("places_locality", "text-field")),
    ).toContain("name:ka");
    await expectSameOriginOnly(map);
  },
};

export const EnglishDark: Story = {
  args: { scheme: "dark" },
  play: async ({ canvasElement }) => {
    const map = await loadedMap(canvasElement);
    await expect(map.getStyle().sprite).toContain("/basemap/sprites/v4/dark");
  },
};

export const GeorgianDark: Story = {
  args: { lang: "ka", scheme: "dark" },
  play: async ({ canvasElement }) => {
    await loadedMap(canvasElement);
    await expect(
      within(canvasElement).getByRole("button", { name: "მასშტაბის გაზრდა" }),
    ).toBeTruthy();
  },
};

export const NoBasemap: Story = {
  args: { basemapPath: "no-such-basemap" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(/No base map: positions are drawn/, undefined, {
        timeout: 10000,
      }),
    ).toBeTruthy();
    const map = await loadedMap(canvasElement);
    await expectSameOriginOnly(map);
  },
};

export const NoWebGL: Story = {
  beforeEach: () => {
    const original = HTMLCanvasElement.prototype.getContext;
    // Simulates a browser without WebGL; restored after the story.
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return (original as (...a: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
    return () => {
      HTMLCanvasElement.prototype.getContext = original;
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notice = await canvas.findByText(
      /this browser has no WebGL/,
      undefined,
      {
        timeout: 10000,
      },
    );
    await expect(notice.textContent).toMatch(/\(lng, lat, WGS84\)/);
    await expect(notice.textContent).toMatch(
      /44\.\d{4}, 41\.\d{4} to 44\.\d{4}, 41\.\d{4}/,
    );
  },
};
