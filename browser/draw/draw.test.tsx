import type { Map as MapLibreMap } from "maplibre-gl";
import { waitFor, within } from "@testing-library/react";
import type * as GeoJSON from "geojson";
import { useState } from "react";
import { expect, it } from "vitest";

import { OutlineFields } from "../../src/form/index.js";
import { useLang } from "../../src/i18n/index.js";
import { DrawLayer, drawLayerIds } from "../../src/layers/index.js";
import { MapView } from "../../src/map/index.js";
import type { DrawOutline } from "../../src/model/index.js";
import "../../styles/map.css";
import { EN_LIGHT, KA_DARK, renderKit } from "../kit.js";
import { basemapBaseUrl } from "../map/basemap.js";

// 1.0.0 (uspace-ussp Q28 gap 1): the drawing tool over the Tbilisi extract
// in both languages and both schemes. Clicks are fired on the real map at
// the place MapLibre projects, as a person's would arrive; the checks read
// what MapLibre holds and what the fields say, never pixels (PLAN D9). The
// circle's outline is a TEST ring standing in for the API's, drawn as given.

const TBILISI = {
  center: [44.8, 41.703] as [number, number],
  zoom: 13.2,
  bearing: 0,
  pitch: 0,
};

const SERVER_RING: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [44.795, 41.7],
      [44.805, 41.7],
      [44.805, 41.706],
      [44.795, 41.706],
      [44.795, 41.7],
    ],
  ],
};

const maps = new WeakMap<Element, MapLibreMap>();
const ids = drawLayerIds("uspace-draw");

function Drawing(props: {
  scheme: "light" | "dark";
  start: DrawOutline;
  ring?: GeoJSON.Polygon;
}) {
  const { lang } = useLang();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [outline, setOutline] = useState(props.start);
  return (
    <div className="grid gap-3" data-testid="drawing">
      <div ref={setHost} style={{ height: 360 }}>
        <MapView
          basemap={{ baseUrl: basemapBaseUrl() }}
          initial={TBILISI}
          lang={lang}
          scheme={props.scheme}
          onLoad={(m) => {
            if (host === null) return;
            maps.set(host, m);
            host.setAttribute("data-loaded", "true");
          }}
        >
          <DrawLayer
            outline={outline}
            onChange={setOutline}
            maxVertices={4}
            circleOutline={props.ring ?? null}
          />
        </MapView>
      </div>
      <OutlineFields
        outline={outline}
        onChange={setOutline}
        maxVertices={4}
        circleOutlineShown={props.ring !== undefined}
      />
    </div>
  );
}

async function loaded(container: HTMLElement): Promise<MapLibreMap> {
  const host = await waitFor(
    () => {
      const el = container.querySelector('[data-loaded="true"]');
      expect(el).not.toBeNull();
      return el as Element;
    },
    { timeout: 20000 },
  );
  const map = maps.get(host);
  if (map === undefined) throw new Error("no map");
  // DrawLayer shows a crosshair once its handlers listen.
  await waitFor(
    () => {
      expect(map.getCanvas().style.cursor).toBe("crosshair");
    },
    { timeout: 20000 },
  );
  return map;
}

/** The draw source's features by role, each once (tiles repeat them). */
function roles(map: MapLibreMap): string[] {
  const seen = new Set<string>();
  for (const f of map.querySourceFeatures(ids.source)) {
    seen.add(
      `${String(f.properties["role"])}:${String(f.properties["index"])}`,
    );
  }
  return [...seen].map((k) => k.split(":")[0] ?? "").sort();
}

function clickAt(map: MapLibreMap, lngLat: [number, number]): void {
  const point = map.project(lngLat);
  map.fire("click", { point, lngLat: map.unproject(point) });
}

async function drawPolygon(container: HTMLElement): Promise<void> {
  const map = await loaded(container);
  for (const id of Object.values(ids).filter((i) => i !== ids.source)) {
    expect(map.getLayer(id), id).toBeDefined();
  }
  clickAt(map, [44.795, 41.7]);
  clickAt(map, [44.805, 41.7]);
  clickAt(map, [44.8, 41.706]);
  await waitFor(
    () => {
      expect(roles(map)).toEqual([
        "area",
        "edge",
        "vertex",
        "vertex",
        "vertex",
      ]);
    },
    { timeout: 20000 },
  );
  // Every vertex shows in the fields, numbered as on the map.
  expect(container.querySelectorAll("[data-vertex]")).toHaveLength(3);
}

it("draws a polygon by clicking the map (en light)", async () => {
  const { container } = renderKit(
    <Drawing scheme="light" start={{ kind: "polygon", vertices: [] }} />,
    EN_LIGHT,
  );
  await drawPolygon(container);
  expect(within(container).getByText("3 of at most 4 points")).toBeVisible();
});

it("draws a polygon by clicking the map (ka dark)", async () => {
  const { container } = renderKit(
    <Drawing scheme="dark" start={{ kind: "polygon", vertices: [] }} />,
    KA_DARK,
  );
  await drawPolygon(container);
  expect(within(container).getByText("3 წერტილი, მაქსიმუმ 4")).toBeVisible();
});

it("a circle with the server's outline (en light)", async () => {
  const { container } = renderKit(
    <Drawing
      scheme="light"
      start={{ kind: "circle", center: null, radiusM: 300 }}
      ring={SERVER_RING}
    />,
    EN_LIGHT,
  );
  const map = await loaded(container);
  clickAt(map, [44.8, 41.703]);
  await waitFor(
    () => {
      expect(roles(map)).toEqual(["center", "circle"]);
    },
    { timeout: 20000 },
  );
  expect(container.querySelector("[data-circle-words]")?.textContent).toMatch(
    /^Circle: centre 41\.70\d*, 44\.\d+ \(degrees, WGS84\); radius 300 m$/,
  );
  expect(
    within(container).getByText(
      "The circle on the map is the outline the system drew.",
    ),
  ).toBeVisible();
});

it("a circle without an outline is its centre and words (ka dark)", async () => {
  const { container } = renderKit(
    <Drawing
      scheme="dark"
      start={{
        kind: "circle",
        center: { lat: 41.703, lng: 44.8 },
        radiusM: 300,
      }}
    />,
    KA_DARK,
  );
  const map = await loaded(container);
  await waitFor(
    () => {
      expect(roles(map)).toEqual(["center"]);
    },
    { timeout: 20000 },
  );
  expect(
    within(container).getByText(
      "წრის კონტურს სისტემა ხატავს; მანამდე რუკა მხოლოდ მის ცენტრს აჩვენებს.",
    ),
  ).toBeVisible();
});
