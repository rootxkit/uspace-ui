import { noGeometryImports } from "./noGeometryImports.js";
import { ruleTester } from "./ruleTester.testing.js";

const err = (source: string) => ({ messageId: "forbidden", data: { source } });

ruleTester().run("no-geometry-imports", noGeometryImports, {
  valid: [
    'import maplibregl from "maplibre-gl";',
    'import { PMTiles } from "pmtiles";',
    'import type { Geometry } from "geojson";',
    'import { fmt } from "./geometry-view";',
    'import { TRUSTS } from "../model/index.js";',
    'import { x } from "./geofence-label";',
    'const m = await import("maplibre-gl");',
    'const r = require("react");',
  ],
  invalid: [
    { code: 'import area from "@turf/area";', errors: [err("@turf/area")] },
    { code: 'import * as turf from "turf";', errors: [err("turf")] },
    { code: 'import { getDistance } from "geolib";', errors: [err("geolib")] },
    { code: 'import { latLngToCell } from "h3-js";', errors: [err("h3-js")] },
    { code: 'import proj4 from "proj4";', errors: [err("proj4")] },
    {
      code: 'import CheapRuler from "cheap-ruler";',
      errors: [err("cheap-ruler")],
    },
    {
      code: 'import { Geodesic } from "geographiclib-geodesic";',
      errors: [err("geographiclib-geodesic")],
    },
    {
      code: 'import area from "@mapbox/geojson-area";',
      errors: [err("@mapbox/geojson-area")],
    },
    {
      code: 'import LatLon from "geodesy/latlon-spherical.js";',
      errors: [err("geodesy/latlon-spherical.js")],
    },
    {
      code: 'import s from "spherical-geometry-js";',
      errors: [err("spherical-geometry-js")],
    },
    { code: 'import { geoArea } from "d3-geo";', errors: [err("d3-geo")] },
    { code: 'import Map from "ol/Map";', errors: [err("ol/Map")] },
    { code: 'import L from "leaflet";', errors: [err("leaflet")] },
    { code: 'import { inside } from "./geo";', errors: [err("./geo")] },
    {
      code: 'import { inside } from "../lib/geodesy.js";',
      errors: [err("../lib/geodesy.js")],
    },
    {
      code: 'import { cpa } from "../../cpa/index";',
      errors: [err("../../cpa/index")],
    },
    {
      code: 'import { c } from "./conformance.ts";',
      errors: [err("./conformance.ts")],
    },
    { code: 'export { area } from "@turf/area";', errors: [err("@turf/area")] },
    { code: 'export * from "@turf/helpers";', errors: [err("@turf/helpers")] },
    {
      code: 'const t = await import("@turf/distance");',
      errors: [err("@turf/distance")],
    },
    { code: 'const g = require("geolib");', errors: [err("geolib")] },
  ],
});
