// The track icon generator (docs/PLAN.md §3.8, WP-7): one shape per trust
// class, drawn twice from the same outline: as SVG parts for the legends
// and the DOM, and as a signed-distance-field bitmap that MapLibre tints
// with `icon-color` (an SDF icon), so one image per trust class serves
// every identification colour. Each class has a directional variant with
// an arrow (rotated by `trackDeg` on the map) and a plain one for a track
// with no direction (LESSONS R-10: null means no arrow).
//
// This is the one file of `symbology` that uses `Math`: it draws shapes in
// icon pixels. It never touches a position, a distance on the ground or a
// bearing of an aircraft (WP-7 done-when). WP-12's manned icons are drawn
// with its exported helpers, so `manned.ts` needs no `Math` of its own.
import type { Trust } from "../model/index.js";
import type { PatternImage } from "./zone.js";

/** The six symbol shapes (PLAN §3.8). */
export type Shape =
  "triangle" | "diamond" | "square" | "circle" | "hexagon" | "cross";

/**
 * How a shape is filled: `solid`; `hollow`, an outline with nothing inside
 * (broadcast only, R-05: anyone can transmit it, so it never looks as
 * solid as an authenticated track); `dashed`, a small solid core inside a
 * dashed ring (simulated only, lab traffic).
 */
export type ShapeFill = "solid" | "hollow" | "dashed";

/**
 * authenticated triangle, provider diamond, surveillance square, broadcast
 * hexagon (hollow), sensor cross, simulated circle (dashed).
 */
export function trustShape(t: Trust): Shape {
  switch (t) {
    case "authenticated":
      return "triangle";
    case "provider":
      return "diamond";
    case "surveillance":
      return "square";
    case "broadcast":
      return "hexagon";
    case "sensor":
      return "cross";
    case "simulated":
      return "circle";
    default:
      return t satisfies never;
  }
}

export function trustFill(t: Trust): ShapeFill {
  switch (t) {
    case "broadcast":
      return "hollow";
    case "simulated":
      return "dashed";
    case "authenticated":
    case "provider":
    case "surveillance":
    case "sensor":
      return "solid";
    default:
      return t satisfies never;
  }
}

// --- geometry in icon pixels -------------------------------------------------
// Display-only constants: the bitmap's side, the shape's radius, the
// outline width of a hollow or dashed shape, and the arrow's size.

/** Side of an icon bitmap and of the SVG viewBox, in icon pixels. */
export const TRACK_ICON_PX = 56;
/** Icon pixels per CSS pixel: the icon draws 28 CSS pixels wide at size 1. */
export const TRACK_ICON_PIXEL_RATIO = 2;
const C = TRACK_ICON_PX / 2;
const R = 12;
const STROKE = 4;
const DASHES = 8;
const ARROW_TIP = -R - 10;
const ARROW_BASE = -R - 1;
const ARROW_HALF = 5;
/** Signed-distance spread, as MapLibre's glyphs use (TinySDF radius 8, cutoff 0.25). */
const SDF_RADIUS = 8;
const SDF_CUTOFF = 0.25;

/** A point in icon pixels, origin at the icon's centre, y down. */
export type IconPoint = readonly [number, number];
type Pt = IconPoint;

type Outline =
  { kind: "polygon"; points: readonly Pt[] } | { kind: "circle"; r: number };

function regular(n: number, radius: number, startDeg: number): Pt[] {
  return Array.from({ length: n }, (_, k) => {
    const a = ((startDeg + (360 / n) * k) * Math.PI) / 180;
    return [radius * Math.cos(a), radius * Math.sin(a)] as const;
  });
}

function outline(shape: Shape): Outline {
  switch (shape) {
    case "triangle":
      return { kind: "polygon", points: regular(3, R * 1.2, -90) };
    case "diamond":
      return { kind: "polygon", points: regular(4, R * 1.2, -90) };
    case "square":
      return { kind: "polygon", points: regular(4, R * 1.2, -45) };
    case "hexagon":
      return { kind: "polygon", points: regular(6, R * 1.1, -90) };
    case "circle":
      return { kind: "circle", r: R };
    case "cross": {
      const a = R * 0.38;
      const e = R * 1.15;
      return {
        kind: "polygon",
        points: [
          [-a, -e],
          [a, -e],
          [a, -a],
          [e, -a],
          [e, a],
          [a, a],
          [a, e],
          [-a, e],
          [-a, a],
          [-e, a],
          [-e, -a],
          [-a, -a],
        ],
      };
    }
    default:
      return shape satisfies never;
  }
}

const ARROW: readonly Pt[] = [
  [0, ARROW_TIP],
  [ARROW_HALF, ARROW_BASE],
  [-ARROW_HALF, ARROW_BASE],
];

// --- SVG ----------------------------------------------------------------------

/** One SVG path of an icon: filled, or stroked with an optional dash. */
export interface IconPart {
  d: string;
  fill: boolean;
  strokeWidth: number;
  /** SVG `stroke-dasharray`, or null for a continuous line. */
  dash: string | null;
}

const n2 = (v: number): string => String(Math.round(v * 100) / 100);

/** An SVG path of a closed polygon in icon pixels (centre origin). */
export function polygonPath(points: readonly Pt[]): string {
  return `${points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${n2(C + x)} ${n2(C + y)}`)
    .join(" ")} Z`;
}

/** An SVG path of a circle of radius `r` icon pixels, centred. */
export function circlePath(r: number): string {
  return `M${n2(C - r)} ${n2(C)} A${n2(r)} ${n2(r)} 0 1 0 ${n2(C + r)} ${n2(C)} A${n2(r)} ${n2(r)} 0 1 0 ${n2(C - r)} ${n2(C)} Z`;
}

function outlinePath(o: Outline): string {
  return o.kind === "circle" ? circlePath(o.r) : polygonPath(o.points);
}

/**
 * The parts of a trust class's icon, in the TRACK_ICON_PX viewBox: the
 * shape as its fill says, and the arrow when `directional`. The arrow
 * points up (north); the map rotates it by `trackDeg`.
 */
export function trackIconParts(t: Trust, directional: boolean): IconPart[] {
  const o = outline(trustShape(t));
  const fill = trustFill(t);
  const parts: IconPart[] = [];
  if (fill === "solid") {
    parts.push({ d: outlinePath(o), fill: true, strokeWidth: 0, dash: null });
  } else if (fill === "hollow") {
    parts.push({
      d: outlinePath(o),
      fill: false,
      strokeWidth: STROKE,
      dash: null,
    });
  } else {
    const r = o.kind === "circle" ? o.r : R;
    const dash = (2 * Math.PI * r) / (DASHES * 2);
    parts.push({
      d: circlePath(r * 0.5),
      fill: true,
      strokeWidth: 0,
      dash: null,
    });
    parts.push({
      d: circlePath(r),
      fill: false,
      strokeWidth: STROKE - 1,
      dash: `${n2(dash)} ${n2(dash)}`,
    });
  }
  if (directional) {
    parts.push({
      d: polygonPath(ARROW),
      fill: true,
      strokeWidth: 0,
      dash: null,
    });
  }
  return parts;
}

/** The icon as a standalone SVG document, drawn in `colour`. */
export function trackIconSvg(
  t: Trust,
  directional: boolean,
  colour = "currentColor",
): string {
  const paths = trackIconParts(t, directional)
    .map((p) =>
      p.fill
        ? `<path d="${p.d}" fill="${colour}"/>`
        : `<path d="${p.d}" fill="none" stroke="${colour}" stroke-width="${p.strokeWidth}"${p.dash === null ? "" : ` stroke-dasharray="${p.dash}"`}/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TRACK_ICON_PX}" height="${TRACK_ICON_PX}" viewBox="0 0 ${TRACK_ICON_PX} ${TRACK_ICON_PX}">${paths}</svg>`;
}

// --- signed distance field ---------------------------------------------------

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const u =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

/** Distance to the polygon's edge, negative inside (even-odd rule). */
export function sdPolygon(p: Pt, points: readonly Pt[]): number {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i] as Pt;
    const b = points[j] as Pt;
    d = Math.min(d, segmentDistance(p, a, b));
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside ? -d : d;
}

/** Distance to a centred circle's edge, negative inside. */
export function sdCircle(p: Pt, r: number): number {
  return Math.hypot(p[0], p[1]) - r;
}

function sdOutline(p: Pt, o: Outline): number {
  return o.kind === "circle" ? sdCircle(p, o.r) : sdPolygon(p, o.points);
}

/** A ring of width `w` along a circle of radius `r`, broken into dashes. */
function sdDashedRing(p: Pt, r: number, w: number): number {
  const ring = Math.abs(sdCircle(p, r)) - w / 2;
  const turn = (Math.atan2(p[1], p[0]) / (2 * Math.PI) + 1) % 1;
  const s = turn * DASHES;
  const frac = s - Math.floor(s);
  if (frac < 0.5) return ring;
  const gapTurns = Math.min(frac - 0.5, 1 - frac) / DASHES;
  const gap = gapTurns * 2 * Math.PI * Math.hypot(p[0], p[1]);
  return Math.hypot(Math.max(ring, 0), gap);
}

/** Signed distance of point `p` (icon pixels, centre origin) to the icon. */
export function trackIconDistance(
  t: Trust,
  directional: boolean,
  p: Pt,
): number {
  const o = outline(trustShape(t));
  const fill = trustFill(t);
  let d: number;
  if (fill === "solid") {
    d = sdOutline(p, o);
  } else if (fill === "hollow") {
    d = Math.abs(sdOutline(p, o)) - STROKE / 2;
  } else {
    const r = o.kind === "circle" ? o.r : R;
    d = Math.min(sdCircle(p, r * 0.5), sdDashedRing(p, r, STROKE - 1));
  }
  return directional ? Math.min(d, sdPolygon(p, ARROW)) : d;
}

/**
 * The icon as an SDF bitmap for `map.addImage(id, image, { sdf: true,
 * pixelRatio: TRACK_ICON_PIXEL_RATIO })`: the alpha channel holds the
 * distance to the shape's edge, 192 on the edge, more inside.
 */
export function trackIconSdf(t: Trust, directional: boolean): PatternImage {
  return sdfBitmap((p) => trackIconDistance(t, directional, p));
}

/**
 * Any icon given as a signed distance (icon pixels, centre origin,
 * negative inside) as an SDF bitmap of TRACK_ICON_PX square, in the
 * encoding `trackIconSdf` uses. WP-12's manned icons are drawn with it.
 */
export function sdfBitmap(distance: (p: Pt) => number): PatternImage {
  const size = TRACK_ICON_PX;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = distance([x + 0.5 - C, y + 0.5 - C]);
      const a = 255 - 255 * (d / SDF_RADIUS + SDF_CUTOFF);
      data[(y * size + x) * 4 + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  return { width: size, height: size, data };
}
