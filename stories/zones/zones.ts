// Story data for the zone layers (WP-6): invented zones over the committed
// Tbilisi extract (stories/basemap/, bounds 44.77..44.83 E, 41.68..41.73 N),
// written as ED-318 features and turned into view models by the kind of
// adapter a `web/` owns (PLAN §3.1: each app maps its generated types onto
// the kit's view models). The coordinates are display-only sample shapes;
// none is a real restriction (spec 06 §4: no real data).
import type * as GeoJSON from "geojson";

import type { RestrictionView } from "../../src/layers/index.js";
import type { Lang } from "../../src/i18n/index.js";
import type {
  RestrictionState,
  VerticalRef,
  ZoneType,
  ZoneView,
} from "../../src/model/index.js";

// --- the adapter example ---------------------------------------------------
//
// ED-318 field names as uspace-core/ed318 reads them: `properties.name` and
// `properties.message` are lists of {text, lang}; the vertical extent is
// the geometry's `layer` member {upper, upperReference, lower,
// lowerReference, uom} (ed318/testdata/authority_collection.json). The CIS read API annotates each feature with
// `extendedProperties.cis_applicability` on `?applies_at=` (spec 02 F3,
// reconciliation M17); the collection's version and issue time come from
// the response (`cis_version`, core's `metadata.issued`, M15) and are
// passed in. In an app these types are generated from the OpenAPI schema,
// never written by hand (CLAUDE.md rule 8); they are spelled out here only
// because a story has no generated client.

interface Ed318Text {
  text: string;
  lang: string;
}

interface Ed318Layer {
  upper?: number;
  upperReference?: VerticalRef;
  lower?: number;
  lowerReference?: VerticalRef;
  uom?: string;
}

export interface Ed318Feature {
  type: "Feature";
  /** GeoJSON with ED-318's `layer` member: the vertical extent. */
  geometry: (GeoJSON.Polygon | GeoJSON.MultiPolygon) & { layer?: Ed318Layer };
  properties: {
    identifier: string;
    name?: Ed318Text[];
    type: ZoneType;
    variant: string;
    reason?: string[];
    message?: Ed318Text[];
    extendedProperties?: {
      cis_applicability?: "applies" | "not_applicable" | "unknown";
    };
  };
}

function textIn(list: Ed318Text[] | undefined, lang: Lang): string | null {
  if (list === undefined || list.length === 0) return null;
  const hit = list.find((t) => t.lang.toLowerCase().startsWith(lang));
  return (hit ?? list[0])?.text ?? null;
}

/** A metre value as the API sent it; any other unit is not converted here. */
function metres(v: number | undefined, uom: string | undefined): number | null {
  return v !== undefined && (uom === undefined || uom === "m") ? v : null;
}

export function zoneViewFromEd318(
  f: Ed318Feature,
  opts: {
    lang: Lang;
    version: string | null;
    updatedAt: string | null;
    restrictionState?: RestrictionState | null;
  },
): ZoneView {
  const p = f.properties;
  const a = p.extendedProperties?.cis_applicability;
  const layer = f.geometry.layer ?? {};
  return {
    identifier: p.identifier,
    name: textIn(p.name, opts.lang),
    type: p.type,
    variant: p.variant,
    reason: p.reason ?? [],
    message: textIn(p.message, opts.lang),
    lowerLimitM: metres(layer.lower, layer.uom),
    lowerRef: layer.lowerReference ?? null,
    upperLimitM: metres(layer.upper, layer.uom),
    upperRef: layer.upperReference ?? null,
    geometry: f.geometry,
    // The server's word, mapped one to one; `unknown` stays unknown.
    applies: a === "applies" ? true : a === "not_applicable" ? false : null,
    restrictionState: opts.restrictionState ?? null,
    version: opts.version,
    updatedAt: opts.updatedAt,
  };
}

// --- the features ----------------------------------------------------------

const box = (
  w: number,
  s: number,
  e: number,
  n: number,
): GeoJSON.Position[][] => [
  [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ],
];

const txt = (en: string, ka: string): Ed318Text[] => [
  { text: en, lang: "en-GB" },
  { text: ka, lang: "ka-GE" },
];

export const ED318_FEATURES: readonly Ed318Feature[] = [
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: box(44.772, 41.682, 44.828, 41.728),
      layer: {
        upper: 150,
        upperReference: "AMSL",
        lower: 0,
        lowerReference: "AGL",
        uom: "m",
      },
    },
    properties: {
      identifier: "GEO-TEST-Z0001",
      name: txt("Test U-space airspace", "სატესტო U-space საჰაერო სივრცე"),
      type: "USPACE",
      variant: "COMMON",
      reason: ["AIR_TRAFFIC"],
      message: txt(
        "Test: network identification and flight authorisation required",
        "ტესტი: საჭიროა ქსელური იდენტიფიკაცია და ფრენის ნებართვა",
      ),
      extendedProperties: { cis_applicability: "applies" },
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: box(44.795, 41.695, 44.805, 41.703),
      layer: {
        upper: 120,
        upperReference: "AGL",
        lower: 0,
        lowerReference: "AGL",
        uom: "m",
      },
    },
    properties: {
      identifier: "GEO-TEST-Z0002",
      name: txt("Test prohibited area", "სატესტო აკრძალული ზონა"),
      type: "PROHIBITED",
      variant: "COMMON",
      reason: ["SECURITY"],
      message: txt("Test: no flights", "ტესტი: ფრენა აკრძალულია"),
      extendedProperties: { cis_applicability: "applies" },
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: box(44.78, 41.705, 44.792, 41.715),
      layer: {
        upper: 600,
        upperReference: "AMSL",
        lower: 0,
        lowerReference: "AGL",
        uom: "m",
      },
    },
    properties: {
      identifier: "GEO-TEST-Z0003",
      name: txt("Test authorisation area", "სატესტო ნებართვის ზონა"),
      type: "REQ_AUTHORIZATION",
      variant: "COMMON",
      reason: ["PRIVACY"],
      // No cis_applicability: the server did not say, so `applies` is null.
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        box(44.808, 41.685, 44.815, 41.692),
        box(44.818, 41.69, 44.825, 41.697),
      ],
      layer: {
        upper: 90,
        upperReference: "AGL",
        lower: 0,
        lowerReference: "AGL",
        uom: "m",
      },
    },
    properties: {
      identifier: "GEO-TEST-Z0004",
      name: txt(
        "Test conditional area (two parts)",
        "სატესტო პირობითი ზონა (ორი ნაწილი)",
      ),
      type: "CONDITIONAL",
      variant: "COMMON",
      reason: ["NATURE"],
      extendedProperties: { cis_applicability: "not_applicable" },
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: box(44.81, 41.71, 44.825, 41.72),
      layer: {
        upper: 120,
        upperReference: "AGL",
        lower: 0,
        lowerReference: "AGL",
        uom: "m",
      },
    },
    properties: {
      identifier: "GEO-TEST-Z0005",
      name: txt("Test open area", "სატესტო ღია ზონა"),
      type: "NO_RESTRICTION",
      variant: "COMMON",
      extendedProperties: { cis_applicability: "unknown" },
    },
  },
];

// Display-only sample values of a response's version and issue time.
const VERSION = "42";
const ISSUED = "2026-10-01T08:30:00Z";

export function storyZones(lang: Lang): ZoneView[] {
  return ED318_FEATURES.map((f) =>
    zoneViewFromEd318(f, { lang, version: VERSION, updatedAt: ISSUED }),
  );
}

const restriction = (
  id: string,
  state: RestrictionState,
  coordinates: GeoJSON.Position[][],
  startsAt: string,
  endsAt: string,
  lang: Lang,
): RestrictionView => ({
  ...zoneViewFromEd318(
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates,
        layer: {
          upper: 120,
          upperReference: "AGL",
          lower: 0,
          lowerReference: "AGL",
          uom: "m",
        },
      },
      properties: {
        identifier: id,
        name: txt(`Test restriction ${id}`, `სატესტო შეზღუდვა ${id}`),
        type: "PROHIBITED",
        variant: "COMMON",
        reason: ["DAR"],
      },
    },
    { lang, version: VERSION, updatedAt: ISSUED, restrictionState: state },
  ),
  startsAt,
  endsAt,
});

/** A planned, an active and an ended restriction (spec 02 F2; ids DAR + 4). */
export function storyRestrictions(lang: Lang): RestrictionView[] {
  return [
    restriction(
      "DARA1B2",
      "planned",
      box(44.775, 41.69, 44.785, 41.698),
      "2026-10-02T14:00:00Z",
      "2026-10-02T16:00:00Z",
      lang,
    ),
    restriction(
      "DARC3D4",
      "active",
      box(44.788, 41.69, 44.798, 41.698),
      "2026-10-02T09:00:00Z",
      "2026-10-02T12:00:00Z",
      lang,
    ),
    restriction(
      "DARE5F6",
      "ended",
      box(44.801, 41.69, 44.811, 41.698),
      "2026-10-01T09:00:00Z",
      "2026-10-01T10:00:00Z",
      lang,
    ),
  ];
}
