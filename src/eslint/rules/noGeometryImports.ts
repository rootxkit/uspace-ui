import type { Rule } from "eslint";

import { visitSources } from "./sources.js";

// Spec 00 §6 hard rule and 06 T12: safety logic exists once, in Go, in
// uspace-core. A geometry or geodesy library in TypeScript is where a
// second, diverging copy of it would start. The map is MapLibre, so the
// other map libraries are refused too.
export const FORBIDDEN_PACKAGES: readonly string[] = [
  "turf",
  "geolib",
  "h3-js",
  "proj4",
  "cheap-ruler",
  "@mapbox/geojson-area",
  "geodesy",
  "spherical-geometry-js",
  "d3-geo",
  "ol",
  "leaflet",
];

// Scopes and name prefixes refused as a whole.
export const FORBIDDEN_PREFIXES: readonly string[] = [
  "@turf/",
  "geographiclib",
];

// A relative import with a path segment named like a judgement.
export const FORBIDDEN_RELATIVE =
  /^\.{1,2}\/(?:.*\/)?(?:geo|geodesy|cpa|conformance)(?:\.[cm]?[jt]sx?)?(?:\/|$)/;

function packageName(source: string): string {
  const parts = source.split("/");
  return source.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : (parts[0] ?? source);
}

export function isGeometryImport(source: string): boolean {
  if (source.startsWith(".")) return FORBIDDEN_RELATIVE.test(source);
  if (FORBIDDEN_PREFIXES.some((p) => source.startsWith(p))) return true;
  return FORBIDDEN_PACKAGES.includes(packageName(source));
}

export const noGeometryImports: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid geometry and geodesy imports: the kit renders, it never judges (spec 00 §6, 06 T12).",
    },
    schema: [],
    messages: {
      forbidden:
        "'{{source}}' computes geometry or geodesy. Containment, distance, CPA and conformance are judged in uspace-core; render the fields the API sends.",
    },
  },
  create(context) {
    return visitSources((source, node) => {
      if (isGeometryImport(source)) {
        context.report({ node, messageId: "forbidden", data: { source } });
      }
    });
  },
};
