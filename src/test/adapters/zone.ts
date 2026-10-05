// Reference adapters for zones (WP-14): one ED-318 UASZone feature (the
// lab's round-trip vector, 04 §3.4) to a ZoneView, a `zone/applicable/v1`
// frame (lab schemas/common, PLAN §14 Q3) to the applicability the app
// puts on it, and a `cis/change/v1` body to what a console says about it.
//
// What the adapter does not do, because it would be a judgement or a
// conversion (CLAUDE.md rules 2 and 4): it converts no unit (a limit in
// feet is unknown here, null with its reference kept; the API converts),
// draws no circle (a Point with an `extent` stays the Point the feature
// is; the API serves a display geometry drawn in Go), and picks no layer
// of several (the limits are null; the feature keeps its geometry).
import type * as GeoJSON from "geojson";

import type { ConsoleFrame } from "../../live/frame.js";
import {
  isVerticalRef,
  isZoneType,
  type VerticalRef,
  type ZoneView,
} from "../../model/index.js";
import {
  adapted,
  isObj,
  num,
  obj,
  refused,
  str,
  type Adapted,
  type Obj,
} from "./result.js";

/** The text of a multilingual ED-318 value: English first, else the first. */
function text(v: unknown): string | null {
  if (!Array.isArray(v)) return str(v);
  const items = v.filter(isObj);
  const en = items.find((t) => str(t["lang"])?.startsWith("en") === true);
  return str((en ?? items[0])?.["text"]);
}

function limit(
  layer: Obj,
  value: "lower" | "upper",
): Adapted<{ m: number | null; ref: VerticalRef | null }> {
  const refKey = `${value}Reference`;
  const ref = layer[refKey] ?? null;
  if (ref !== null && !isVerticalRef(ref))
    return refused(`layer.${refKey}`, ref, "not a core.VerticalRef");
  const uom = layer["uom"] ?? "m";
  // Metres as given; any other unit is the API's to convert.
  const m = uom === "m" ? num(layer[value]) : null;
  return adapted({ m, ref });
}

/** One ED-318 feature to a ZoneView; `applies` is the app's (Q3). */
export function adaptEd318Feature(
  feature: unknown,
  applies: boolean | null = null,
): Adapted<ZoneView> {
  const f = obj(feature);
  const p = obj(f["properties"]);
  const identifier = str(p["identifier"]);
  if (identifier === null)
    return refused("properties.identifier", p["identifier"], "missing");
  if (!isZoneType(p["type"]))
    return refused("properties.type", p["type"], "not an ED-318 zone type");
  const geometry = f["geometry"];
  if (!isObj(geometry) || typeof geometry["type"] !== "string")
    return refused("geometry", geometry, "not a geometry");
  const layers = [
    geometry["layer"],
    ...(Array.isArray(geometry["geometries"])
      ? geometry["geometries"].map((g) => obj(g)["layer"])
      : []),
  ].filter(isObj);
  let lower: { m: number | null; ref: VerticalRef | null } = {
    m: null,
    ref: null,
  };
  let upper = lower;
  if (layers.length === 1) {
    const layer = layers[0] as Obj;
    const lo = limit(layer, "lower");
    if (!lo.ok) return lo;
    const up = limit(layer, "upper");
    if (!up.ok) return up;
    lower = lo.value;
    upper = up.value;
  }
  const reason = Array.isArray(p["reason"])
    ? p["reason"].filter((r): r is string => typeof r === "string")
    : [];
  const source = obj(p["dataSource"]);
  return adapted({
    identifier,
    name: text(p["name"]),
    type: p["type"],
    variant: str(p["variant"]),
    reason,
    message: text(p["message"]),
    lowerLimitM: lower.m,
    lowerRef: lower.ref,
    upperLimitM: upper.m,
    upperRef: upper.ref,
    geometry: geometry as unknown as GeoJSON.Geometry,
    applies,
    restrictionState: null,
    version: null,
    updatedAt: str(source["updateDateTime"]),
  });
}

/** Every feature of an ED-318 collection, or the first it cannot map. */
export function adaptEd318Collection(doc: unknown): Adapted<ZoneView[]> {
  const features = obj(doc)["features"];
  if (!Array.isArray(features))
    return refused("features", features, "not a feature list");
  const out: ZoneView[] = [];
  for (const [i, feature] of features.entries()) {
    const z = adaptEd318Feature(feature);
    if (!z.ok) return { ...z, field: `features[${String(i)}].${z.field}` };
    out.push(z.value);
  }
  return adapted(out);
}

/** The applicability of `zone/applicable/v1` as ZoneView.applies (Q3). */
export function adaptApplicability(
  f: ConsoleFrame,
): Adapted<{ identifier: string; applies: boolean | null }> {
  if (f.schema !== "zone/applicable/v1")
    return refused("schema", f.schema, "not zone/applicable/v1");
  const b = obj(f.body);
  const identifier = str(b["identifier"]);
  if (identifier === null)
    return refused("identifier", b["identifier"], "missing");
  const a = b["cis_applicability"];
  const applies =
    a === "applies"
      ? true
      : a === "not_applicable"
        ? false
        : a === "unknown"
          ? null
          : undefined;
  if (applies === undefined)
    return refused(
      "cis_applicability",
      a,
      "not applies, not_applicable or unknown",
    );
  return adapted({ identifier, applies });
}

/** A CIS change as a console words it: "zones updated to version V at T". */
export interface CisChange {
  dataset: string;
  version: string;
  at: string;
}

/** `cis/change/v1` to the change a console announces (PLAN §6.3). */
export function adaptCisChange(f: ConsoleFrame): Adapted<CisChange> {
  if (f.schema !== "cis/change/v1")
    return refused("schema", f.schema, "not cis/change/v1");
  const b = obj(f.body);
  const dataset = str(b["dataset"]);
  if (dataset === null) return refused("dataset", b["dataset"], "missing");
  const v = b["version"];
  if (typeof v !== "string" && typeof v !== "number")
    return refused("version", v, "neither a string nor a number");
  return adapted({
    dataset,
    version: String(v),
    at: str(b["at"]) ?? f.capturedAt ?? f.rxTs,
  });
}
