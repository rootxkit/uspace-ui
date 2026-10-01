// Viewport and bbox values. The map never computes a position: these are
// the camera MapLibre reports, in the `[lng, lat]` order of spec 02 §1.
import type { LngLatBounds, Map as MapLibreMap } from "maplibre-gl";

import { maplibre } from "./maplibre.js";

export interface Viewport {
  /** [lng, lat], WGS84 degrees. */
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

/** WGS84 degrees. */
export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function bboxOfBounds(b: LngLatBounds): BBox {
  return {
    minLng: b.getWest(),
    minLat: b.getSouth(),
    maxLng: b.getEast(),
    maxLat: b.getNorth(),
  };
}

export function viewportOf(map: MapLibreMap): Viewport {
  const c = map.getCenter();
  return {
    center: [c.lng, c.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

export function bboxOf(map: MapLibreMap): BBox {
  return bboxOfBounds(map.getBounds());
}

// MapLibre's tile size in CSS pixels at zoom 0.
const WORLD_PX_AT_Z0 = 512;

/**
 * The bbox of a north-up, unpitched view of `v` in a `widthPx` x
 * `heightPx` container, by MapLibre's own Web Mercator conversion. Used
 * only where no map exists to ask (no WebGL): bearing and pitch are
 * ignored, so the text is the unrotated view.
 */
export function viewportBBox(
  v: Viewport,
  widthPx: number,
  heightPx: number,
): BBox {
  const { MercatorCoordinate } = maplibre;
  const c = MercatorCoordinate.fromLngLat({
    lng: v.center[0],
    lat: v.center[1],
  });
  const worldPx = WORLD_PX_AT_Z0 * 2 ** v.zoom;
  const dx = widthPx / 2 / worldPx;
  const dy = heightPx / 2 / worldPx;
  const nw = new MercatorCoordinate(c.x - dx, c.y - dy).toLngLat();
  const se = new MercatorCoordinate(c.x + dx, c.y + dy).toLngLat();
  return { minLng: nw.lng, minLat: se.lat, maxLng: se.lng, maxLat: nw.lat };
}

/** Four decimals: about 10 m, the precision of a viewport label. */
export function bboxText(b: BBox): Record<keyof BBox, string> {
  return {
    minLng: b.minLng.toFixed(4),
    minLat: b.minLat.toFixed(4),
    maxLng: b.maxLng.toFixed(4),
    maxLat: b.maxLat.toFixed(4),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Grid arithmetic without binary noise: 41.62 - 0.08 is 41.539999...,
// which is on the 0.01 grid and must floor to 41.54, not 41.53.
function steps(v: number, quantum: number): number {
  return Number((v / quantum).toFixed(6));
}

function onGrid(n: number, quantum: number): number {
  return Number((n * quantum).toFixed(9));
}

/**
 * The subscription bbox of spec 05 §5: `b` padded by `marginFraction` of
 * its width and height on every side, then widened outwards to multiples
 * of `quantizeDeg` so a small pan gives the same box. Clamped to the WGS84
 * range.
 */
export function subscriptionBBox(
  b: BBox,
  marginFraction: number,
  quantizeDeg: number,
): BBox {
  const padLng = (b.maxLng - b.minLng) * marginFraction;
  const padLat = (b.maxLat - b.minLat) * marginFraction;
  const q = quantizeDeg;
  return {
    minLng: clamp(
      onGrid(Math.floor(steps(b.minLng - padLng, q)), q),
      -180,
      180,
    ),
    minLat: clamp(onGrid(Math.floor(steps(b.minLat - padLat, q)), q), -90, 90),
    maxLng: clamp(onGrid(Math.ceil(steps(b.maxLng + padLng, q)), q), -180, 180),
    maxLat: clamp(onGrid(Math.ceil(steps(b.maxLat + padLat, q)), q), -90, 90),
  };
}
