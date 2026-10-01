// Zone and restriction symbology (WP-6). The expressions are data: they
// are parsed and evaluated with MapLibre's own style-spec package, so an
// expression MapLibre would reject fails here, and the dimming the map
// draws is checked against `zoneOpacity` case by case. The snapshot at the
// end is reviewed on change with the `legend-change` label (PLAN §12).
import {
  createExpression,
  featureFilter,
  latest,
  type StylePropertySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import { en } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";
import {
  RESTRICTION_STATES,
  ZONE_TYPES,
  type RestrictionState,
  type ZoneType,
} from "../model/index.js";
import { tokens } from "../theme/tokens.js";
import {
  RESTRICTION_LINE_KEYS,
  RESTRICTION_STATE_KEYS,
  restrictionLine,
  restrictionLineFilter,
  restrictionStateToken,
} from "./restriction.js";
import {
  PATTERN_TILE_PX,
  ZONE_DIMMED_OPACITY,
  ZONE_LEGEND_ORDER,
  ZONE_PATTERN_KEYS,
  ZONE_TYPE_KEYS,
  parseHexColour,
  zoneDimExpression,
  zoneLineWidthPx,
  zoneOpacity,
  zoneOrder,
  zonePattern,
  zonePatternImage,
  zonePatternImageId,
  zoneStyle,
  zoneToken,
  type ZoneColours,
} from "./zone.js";

// The light values of styles/tokens.css, so the snapshot reads like the map.
const COLOURS: ZoneColours = {
  PROHIBITED: "#861325",
  REQ_AUTHORIZATION: "#ab4303",
  CONDITIONAL: "#b18a01",
  NO_RESTRICTION: "#2d805c",
  USPACE: "#0d67cf",
};

type Props = Record<string, unknown>;

function evaluate(
  expr: unknown,
  spec: StylePropertySpecification,
  properties: Props,
): unknown {
  const parsed = createExpression(expr, spec);
  if (parsed.result !== "success") {
    throw new Error(JSON.stringify(parsed.value));
  }
  return parsed.value.evaluate(
    { zoom: 12 },
    { type: "Polygon", properties },
    undefined,
    undefined,
    ["us-zone-pattern-REQ_AUTHORIZATION", "us-zone-pattern-CONDITIONAL"],
  );
}

function matches(filter: unknown, properties: Props): boolean {
  return featureFilter(filter as never).filter(
    { zoom: 12 },
    { type: 3, properties },
  );
}

const fillOpacity = latest.paint_fill["fill-opacity"];
const lineOpacity = latest.paint_line["line-opacity"];
const lineWidth = latest.paint_line["line-width"];
const fillPattern = latest.paint_fill["fill-pattern"];
const fillColor = latest.paint_fill["fill-color"];

const props = (over: Props = {}): Props => ({
  identifier: "GEO-TEST-Z1",
  type: "PROHIBITED",
  applies: null,
  restrictionState: null,
  selected: false,
  ...over,
});

describe("every zone type", () => {
  it.each(ZONE_TYPES)("%s has a token, a pattern, a line and a name", (t) => {
    expect(zoneToken(t)).toBe(tokens.zone[t]);
    expect(zoneToken(t)).toMatch(/^--us-zone-/);
    expect(["solid", "hatched", "dotted", "none"]).toContain(zonePattern(t));
    expect(zoneLineWidthPx(t)).toBeGreaterThan(0);
    expect(en[ZONE_TYPE_KEYS[t]]).not.toBe("");
    expect(ka[ZONE_TYPE_KEYS[t]]).not.toBe("");
    expect(ZONE_LEGEND_ORDER).toContain(t);
  });

  it("the legend lists each type once, PROHIBITED first (Z-10)", () => {
    expect([...zoneOrder()].sort()).toEqual([...ZONE_TYPES].sort());
    expect(zoneOrder()[0]).toBe("PROHIBITED");
  });

  it("PROHIBITED is the solid fill and REQ_AUTHORIZATION the hatched one", () => {
    expect(zonePattern("PROHIBITED")).toBe("solid");
    expect(zonePattern("REQ_AUTHORIZATION")).toBe("hatched");
    expect(zonePattern("CONDITIONAL")).toBe("dotted");
    expect(zonePattern("NO_RESTRICTION")).toBe("none");
    expect(zonePattern("USPACE")).toBe("none");
  });

  it("every pair of types differs in pattern or line weight, not only in colour", () => {
    const cue = (t: ZoneType) => `${zonePattern(t)}/${zoneLineWidthPx(t)}`;
    expect(new Set(ZONE_TYPES.map(cue)).size).toBe(ZONE_TYPES.length);
  });

  it("every pattern has a name in both catalogues", () => {
    for (const p of Object.values(ZONE_PATTERN_KEYS)) {
      expect(en[p]).not.toBe("");
      expect(ka[p]).not.toBe("");
    }
  });

  it("only hatched and dotted types have a pattern image", () => {
    expect(zonePatternImageId("REQ_AUTHORIZATION")).toBe(
      "us-zone-pattern-REQ_AUTHORIZATION",
    );
    expect(zonePatternImageId("CONDITIONAL")).toBe(
      "us-zone-pattern-CONDITIONAL",
    );
    expect(zonePatternImageId("PROHIBITED")).toBeNull();
    expect(zonePatternImageId("USPACE")).toBeNull();
  });
});

describe("zoneOpacity", () => {
  const z = (
    applies: boolean | null,
    restrictionState: RestrictionState | null = null,
  ) => zoneOpacity({ applies, restrictionState });

  it("dims a zone the server says does not apply", () => {
    expect(z(false)).toBeLessThan(z(true));
    expect(z(false)).toBe(ZONE_DIMMED_OPACITY);
  });

  it("draws applies: null exactly as applies: true (not stated is not off)", () => {
    expect(z(null)).toBe(z(true));
    expect(z(null)).toBe(1);
  });

  it("dims an ended, planned or cancelled restriction", () => {
    expect(z(null, "ended")).toBe(ZONE_DIMMED_OPACITY);
    expect(z(null, "planned")).toBe(ZONE_DIMMED_OPACITY);
    expect(z(null, "cancelled")).toBe(ZONE_DIMMED_OPACITY);
  });

  it("draws an active restriction in full (the twin)", () => {
    expect(z(null, "active")).toBe(1);
    expect(z(true, "active")).toBe(1);
  });
});

describe("the dimming expression is zoneOpacity, case by case", () => {
  const cases = [true, false, null].flatMap((applies) =>
    [...RESTRICTION_STATES, null].map((restrictionState) => ({
      applies,
      restrictionState,
    })),
  );
  it.each(cases)("applies %s", (c) => {
    expect(evaluate(zoneDimExpression(), lineOpacity, props(c))).toBe(
      zoneOpacity(c),
    );
  });

  it("takes both values (not constant)", () => {
    const seen = new Set(cases.map((c) => zoneOpacity(c)));
    expect(seen).toEqual(new Set([1, ZONE_DIMMED_OPACITY]));
  });
});

describe("zoneStyle", () => {
  const style = zoneStyle(COLOURS);

  it("parses and evaluates for every type", () => {
    for (const type of ZONE_TYPES) {
      const p = props({ type });
      expect(evaluate(style.fillColor, fillColor, p)).toBeTruthy();
      const opacity = evaluate(style.fillOpacity, fillOpacity, p) as number;
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(evaluate(style.lineWidth, lineWidth, p)).toBe(
        zoneLineWidthPx(type),
      );
    }
  });

  it("an outline-only type has no fill; a solid one does", () => {
    const of = (type: ZoneType) =>
      evaluate(style.fillOpacity, fillOpacity, props({ type })) as number;
    expect(of("USPACE")).toBe(0);
    expect(of("NO_RESTRICTION")).toBe(0);
    expect(of("PROHIBITED")).toBeGreaterThan(0);
  });

  it("dims the fill and the line of a zone with applies: false", () => {
    const full = props({ type: "PROHIBITED", applies: true });
    const dimmed = props({ type: "PROHIBITED", applies: false });
    const f = (p: Props) => evaluate(style.fillOpacity, fillOpacity, p);
    const l = (p: Props) => evaluate(style.lineOpacity, lineOpacity, p);
    expect(f(dimmed) as number).toBeLessThan(f(full) as number);
    expect(l(dimmed)).toBe(ZONE_DIMMED_OPACITY);
    expect(l(full)).toBe(1);
    expect(l(props({ applies: null }))).toBe(1);
  });

  it("thickens the selected zone's outline", () => {
    const w = (selected: boolean) =>
      evaluate(style.lineWidth, lineWidth, props({ selected })) as number;
    expect(w(true)).toBeGreaterThan(w(false));
  });

  it("the pattern layer draws the patterned types only, each with its image", () => {
    for (const type of ZONE_TYPES) {
      const drawn = matches(style.patternFilter, props({ type }));
      expect(drawn).toBe(zonePatternImageId(type) !== null);
      if (drawn) {
        const image = evaluate(
          style.fillPattern,
          fillPattern,
          props({ type }),
        ) as { name?: string; from?: { name?: string } };
        expect(JSON.stringify(image)).toContain(`us-zone-pattern-${type}`);
      }
    }
  });

  it("matches the reviewed expressions (legend-change on a diff)", () => {
    expect(style).toMatchSnapshot();
  });
});

describe("pattern images", () => {
  const rgb = [171, 67, 3] as const;
  const opaque = (data: Uint8Array) =>
    data.filter((_, i) => i % 4 === 3 && data[i] === 255).length;

  it.each(["hatched", "dotted"] as const)(
    "%s has pixels in the colour and transparent ones",
    (p) => {
      const img = zonePatternImage(p, rgb);
      expect(img.width).toBe(PATTERN_TILE_PX);
      expect(img.data.length).toBe(PATTERN_TILE_PX * PATTERN_TILE_PX * 4);
      const n = opaque(img.data);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(PATTERN_TILE_PX * PATTERN_TILE_PX);
      const first = img.data.findIndex(
        (_, i) => i % 4 === 3 && img.data[i] === 255,
      );
      expect([...img.data.slice(first - 3, first)]).toEqual([...rgb]);
    },
  );

  it("hatching and dots are different tiles", () => {
    expect(zonePatternImage("hatched", rgb).data).not.toEqual(
      zonePatternImage("dotted", rgb).data,
    );
  });
});

describe("parseHexColour", () => {
  it("reads #rrggbb and #rgb", () => {
    expect(parseHexColour(" #ab4303 ")).toEqual([171, 67, 3]);
    expect(parseHexColour("#fff")).toEqual([255, 255, 255]);
  });

  it("refuses what is not a hex colour", () => {
    expect(parseHexColour("")).toBeNull();
    expect(parseHexColour("rgb(1, 2, 3)")).toBeNull();
    expect(parseHexColour("#12345")).toBeNull();
  });
});

describe("restriction symbology", () => {
  it.each(RESTRICTION_STATES)("%s has a token and a name", (s) => {
    expect(restrictionStateToken(s)).toMatch(/^--us-text/);
    expect(en[RESTRICTION_STATE_KEYS[s]]).not.toBe("");
    expect(ka[RESTRICTION_STATE_KEYS[s]]).not.toBe("");
  });

  it("planned is dashed, active solid and the thickest", () => {
    expect(restrictionLine("planned").dash).not.toBeNull();
    expect(restrictionLine("active").dash).toBeNull();
    const widths = RESTRICTION_STATES.map((s) => restrictionLine(s).widthPx);
    expect(restrictionLine("active").widthPx).toBe(Math.max(...widths));
  });

  it("ended and cancelled are thin and dimmed; active is full (the twin)", () => {
    for (const s of ["ended", "cancelled"] as const) {
      expect(restrictionLine(s).opacity).toBe(ZONE_DIMMED_OPACITY);
      expect(restrictionLine(s).widthPx).toBeLessThan(
        restrictionLine("active").widthPx,
      );
    }
    expect(restrictionLine("active").opacity).toBe(1);
  });

  it("ended and cancelled are told apart by the dash", () => {
    expect(restrictionLine("ended").dash).toBeNull();
    expect(restrictionLine("cancelled").dash).not.toBeNull();
  });

  it("no state from the API draws in full", () => {
    expect(restrictionLine(null).opacity).toBe(1);
    expect(en[RESTRICTION_STATE_KEYS.unstated]).toBe("State not provided");
  });

  it("each line layer draws exactly its own state", () => {
    for (const k of RESTRICTION_LINE_KEYS) {
      for (const s of [...RESTRICTION_STATES, null]) {
        const own = k === "unstated" ? s === null : s === k;
        expect(
          matches(restrictionLineFilter(k), props({ restrictionState: s })),
          `${k} / ${String(s)}`,
        ).toBe(own);
      }
    }
  });

  it("every line layer parses with its dash array", () => {
    const dash = latest.paint_line["line-dasharray"];
    for (const s of RESTRICTION_STATES) {
      const d = restrictionLine(s).dash;
      if (d !== null)
        expect(evaluate(["literal", [...d]], dash, props())).toBeTruthy();
    }
  });
});
