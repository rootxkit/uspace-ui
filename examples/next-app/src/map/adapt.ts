// The one hand-written mapping, from the generated API types to the kit's
// view model (docs/PLAN.md §3.1, §11). It copies what the API said and
// decides nothing: the geometry as served, the limits only when they are
// in metres (never converted here), and `applies` from the API's
// `cis_applicability` one to one (`unknown` stays unknown: null).
import type { Lang } from "@rootxkit/uspace-ui/i18n";
import type { ZoneView } from "@rootxkit/uspace-ui/model";
import type { components } from "../api/generated/openapi";

type Feature = components["schemas"]["ZoneFeature"];
type Text = components["schemas"]["Text"];

function textIn(list: Text[] | undefined, lang: Lang): string | null {
  if (list === undefined || list.length === 0) return null;
  const hit = list.find((t) => t.lang.toLowerCase().startsWith(lang));
  return (hit ?? list[0])?.text ?? null;
}

function metres(v: number | undefined, uom: string | undefined): number | null {
  return v !== undefined && (uom === undefined || uom === "m") ? v : null;
}

export function toZoneView(
  f: Feature,
  meta: { version: string | null; updatedAt: string | null },
  lang: Lang,
): ZoneView {
  const p = f.properties;
  const layer = f.geometry.layer ?? {};
  const a = p.extendedProperties?.cis_applicability;
  return {
    identifier: p.identifier,
    name: textIn(p.name, lang),
    type: p.type,
    variant: p.variant,
    reason: p.reason ?? [],
    message: textIn(p.message, lang),
    lowerLimitM: metres(layer.lower, layer.uom),
    lowerRef: layer.lowerReference ?? null,
    upperLimitM: metres(layer.upper, layer.uom),
    upperRef: layer.upperReference ?? null,
    geometry: f.geometry as unknown as ZoneView["geometry"],
    applies: a === "applies" ? true : a === "not_applicable" ? false : null,
    restrictionState: null,
    version: meta.version,
    updatedAt: meta.updatedAt,
  };
}
