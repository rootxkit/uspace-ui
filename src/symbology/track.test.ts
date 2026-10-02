// Track symbology (WP-7, PLAN §3.8): trust shapes and fills, the icon
// generator (SVG parts and SDF bitmaps from one outline), and the MapLibre
// expressions, parsed and evaluated with MapLibre's own style-spec
// package. R-05 is the rule this file pins hardest: the broadcast symbol is
// hollow, and no other is. The snapshot at the end is reviewed on change
// with the `legend-change` label (PLAN §12).
import {
  createExpression,
  featureFilter,
  latest,
  type StylePropertySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import { en } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";
import { TRUSTS, type Trust } from "../model/index.js";
import { AGE_BUCKETS, tokens } from "../theme/tokens.js";
import { ageOpacity } from "./age.js";
import { IDENT_ORDER } from "./ident.js";
import {
  TRACK_ICON_IDS,
  TRUST_FILL_KEYS,
  TRUST_KEYS,
  TRUST_MEANING_KEYS,
  trackIconId,
  trackStyle,
  trustOrder,
  trustToken,
  type TrackColours,
} from "./track.js";
import {
  TRACK_ICON_PX,
  trackIconParts,
  trackIconSdf,
  trackIconSvg,
  trustFill,
  trustShape,
} from "./trackIcon.js";

// The light values of styles/tokens.css, so the snapshot reads like the map.
const COLOURS: TrackColours = {
  ident: {
    registered: "#257051",
    suspended: "#c47b08",
    unknown_operator: "#ac0202",
    unidentified: "#222124",
    none: "#848b8b",
  },
  emergency: "#88122b",
  selected: "#111111",
  halo: "#ffffff",
};

type Props = Record<string, unknown>;

function evaluate(
  expr: unknown,
  spec: StylePropertySpecification,
  properties: Props,
  zoom = 12,
): unknown {
  const parsed = createExpression(expr, spec);
  if (parsed.result !== "success") {
    throw new Error(JSON.stringify(parsed.value));
  }
  return parsed.value.evaluate(
    { zoom },
    { type: "Point", properties },
    undefined,
    undefined,
    TRACK_ICON_IDS.map((i) => i.id),
  );
}

function matches(filter: unknown, properties: Props, type: 1 | 2 = 1): boolean {
  return featureFilter(filter as never).filter(
    { zoom: 12 },
    { type, properties },
  );
}

const props = (over: Props = {}): Props => ({
  kind: "track",
  identifier: "TEST-TRK-0001",
  trust: "authenticated",
  ident: "registered",
  mark: "",
  trackDeg: 90,
  emergency: false,
  selected: false,
  age: "live",
  label: "GEO-TEST-OP-0001",
  ...over,
});

describe("trust classes", () => {
  it.each(TRUSTS)(
    "%s has a shape, a fill, a token, a name and a meaning",
    (t) => {
      expect([
        "triangle",
        "diamond",
        "square",
        "circle",
        "hexagon",
        "cross",
      ]).toContain(trustShape(t));
      expect(trustToken(t)).toBe(tokens.trust[t]);
      for (const k of [
        TRUST_KEYS[t],
        TRUST_MEANING_KEYS[t],
        TRUST_FILL_KEYS[trustFill(t)],
      ]) {
        expect(en[k]).not.toBe("");
        expect(ka[k]).not.toBe("");
      }
    },
  );

  it("every trust class has its own shape (readable without colour)", () => {
    expect(new Set(TRUSTS.map(trustShape)).size).toBe(TRUSTS.length);
  });

  it("broadcast is the hollow hexagon (R-05)", () => {
    expect(trustShape("broadcast")).toBe("hexagon");
    expect(trustFill("broadcast")).toBe("hollow");
  });

  it("no other trust class is hollow (the twin)", () => {
    expect(TRUSTS.filter((t) => trustFill(t) === "hollow")).toEqual([
      "broadcast",
    ]);
  });

  it("simulated alone is dashed", () => {
    expect(TRUSTS.filter((t) => trustFill(t) === "dashed")).toEqual([
      "simulated",
    ]);
  });

  it("the broadcast and provider names say unverified in both languages", () => {
    for (const t of ["broadcast", "provider"] as const) {
      for (const k of [TRUST_KEYS[t], TRUST_MEANING_KEYS[t]]) {
        expect(en[k]).toMatch(/unverified/);
        expect(ka[k]).toMatch(/დაუდასტურებ/);
      }
    }
  });

  it("an authenticated track's wording does not (the twin)", () => {
    expect(en[TRUST_MEANING_KEYS.authenticated]).not.toMatch(/unverified/);
  });

  it("the legend lists each class once", () => {
    expect([...trustOrder()].sort()).toEqual([...TRUSTS].sort());
  });
});

describe("the icon set", () => {
  it("is twelve images, one plain and one directional per class", () => {
    expect(TRACK_ICON_IDS).toHaveLength(12);
    expect(new Set(TRACK_ICON_IDS.map((i) => i.id)).size).toBe(12);
    for (const t of TRUSTS) {
      expect(TRACK_ICON_IDS.map((i) => i.id)).toEqual(
        expect.arrayContaining([trackIconId(t, false), trackIconId(t, true)]),
      );
    }
  });

  it("the broadcast SVG has no filled body, only an outline", () => {
    const parts = trackIconParts("broadcast", false);
    expect(parts.filter((p) => p.fill)).toEqual([]);
    expect(trackIconSvg("broadcast", false)).toContain('fill="none"');
    expect(trackIconSvg("broadcast", false)).not.toContain(
      'fill="currentColor"',
    );
  });

  it("every other class has a filled body (the twin)", () => {
    for (const t of TRUSTS.filter((x) => x !== "broadcast")) {
      expect(
        trackIconParts(t, false).some((p) => p.fill),
        t,
      ).toBe(true);
    }
  });

  it("only the simulated SVG is dashed", () => {
    for (const t of TRUSTS) {
      expect(trackIconSvg(t, true).includes("stroke-dasharray"), t).toBe(
        t === "simulated",
      );
    }
  });

  it("the directional variant adds the arrow and nothing else", () => {
    for (const t of TRUSTS) {
      expect(trackIconParts(t, true)).toHaveLength(
        trackIconParts(t, false).length + 1,
      );
    }
  });
});

// Alpha of the SDF at pixel (x, y): 192 is the edge, above is inside.
function alphaAt(t: Trust, directional: boolean, x: number, y: number): number {
  const img = trackIconSdf(t, directional);
  return img.data[(y * img.width + x) * 4 + 3] ?? -1;
}
const EDGE = 192;
const MID = TRACK_ICON_PX / 2 - 1;

describe("the SDF bitmaps", () => {
  it.each(TRUSTS)("%s is a square RGBA bitmap, empty in the corners", (t) => {
    const img = trackIconSdf(t, false);
    expect(img.width).toBe(TRACK_ICON_PX);
    expect(img.height).toBe(TRACK_ICON_PX);
    expect(img.data).toHaveLength(TRACK_ICON_PX * TRACK_ICON_PX * 4);
    expect(alphaAt(t, false, 0, 0)).toBe(0);
  });

  it("a solid symbol is inside at its centre", () => {
    for (const t of TRUSTS.filter((x) => trustFill(x) !== "hollow")) {
      expect(alphaAt(t, false, MID, MID), t).toBeGreaterThan(EDGE);
    }
  });

  it("the broadcast symbol is empty at its centre and drawn on its outline (R-05)", () => {
    expect(alphaAt("broadcast", false, MID, MID)).toBeLessThan(EDGE);
    // The hexagon's left side, at mid height.
    expect(alphaAt("broadcast", false, 16, MID)).toBeGreaterThan(EDGE);
  });

  it("the simulated ring is drawn in a dash and empty in a gap", () => {
    expect(alphaAt("simulated", false, 39, 30)).toBeGreaterThan(EDGE);
    expect(alphaAt("simulated", false, 37, 34)).toBeLessThan(EDGE);
  });

  it("the arrow is there only in the directional variant (R-10)", () => {
    for (const t of TRUSTS) {
      expect(alphaAt(t, true, MID, 11), t).toBeGreaterThan(EDGE);
      expect(alphaAt(t, false, MID, 11), t).toBeLessThan(EDGE);
    }
  });
});

const iconImage = latest.layout_symbol["icon-image"];
const iconRotate = latest.layout_symbol["icon-rotate"];
const iconSize = latest.layout_symbol["icon-size"];
const iconColor = latest.paint_symbol["icon-color"];
const iconOpacity = latest.paint_symbol["icon-opacity"];
const textSize = latest.layout_symbol["text-size"];
const circleRadius = latest.paint_circle["circle-radius"];
const lineOpacity = latest.paint_line["line-opacity"];
const lineColor = latest.paint_line["line-color"];

function imageName(v: unknown): string {
  return (v as { name: string }).name;
}

describe("trackStyle", () => {
  const style = trackStyle(COLOURS);

  it("picks each class's icon, plain without a course and with the arrow with one", () => {
    for (const trust of TRUSTS) {
      expect(
        imageName(
          evaluate(
            style.iconImage,
            iconImage,
            props({ trust, trackDeg: null }),
          ),
        ),
      ).toBe(trackIconId(trust, false));
      expect(
        imageName(
          evaluate(style.iconImage, iconImage, props({ trust, trackDeg: 0 })),
        ),
      ).toBe(trackIconId(trust, true));
    }
  });

  it("draws a trust value it does not know as the hollow broadcast icon, never an upgrade", () => {
    expect(
      imageName(
        evaluate(
          style.iconImage,
          iconImage,
          props({ trust: "new_class", trackDeg: null }),
        ),
      ),
    ).toBe(trackIconId("broadcast", false));
  });

  it("rotates by trackDeg, and not at all without one", () => {
    expect(
      evaluate(style.iconRotate, iconRotate, props({ trackDeg: 135 })),
    ).toBe(135);
    expect(
      evaluate(style.iconRotate, iconRotate, props({ trackDeg: null })),
    ).toBe(0);
  });

  it("colours by the drawn identification status, none in its grey", () => {
    for (const s of IDENT_ORDER) {
      const c = evaluate(style.iconColor, iconColor, props({ ident: s })) as {
        toString(): string;
      };
      const expected = evaluate(COLOURS.ident[s], iconColor, {}) as {
        toString(): string;
      };
      expect(c.toString(), s).toBe(expected.toString());
    }
  });

  it("fades by age bucket with ageOpacity's numbers", () => {
    for (const b of AGE_BUCKETS) {
      expect(evaluate(style.iconOpacity, iconOpacity, props({ age: b }))).toBe(
        ageOpacity(b),
      );
    }
  });

  it("a stale track is fainter than a live one (never looks fresh)", () => {
    const o = (age: string) =>
      evaluate(style.iconOpacity, iconOpacity, props({ age })) as number;
    expect(o("stale")).toBeLessThan(o("live"));
  });

  it("the emergency ring draws emergencies only", () => {
    expect(matches(style.emergencyFilter, props({ emergency: true }))).toBe(
      true,
    );
    expect(matches(style.emergencyFilter, props({ emergency: false }))).toBe(
      false,
    );
  });

  it("the selection ring draws the selected track only", () => {
    expect(matches(style.selectedFilter, props({ selected: true }))).toBe(true);
    expect(matches(style.selectedFilter, props({ selected: false }))).toBe(
      false,
    );
  });

  it("the emergency ring sits outside the selection ring", () => {
    for (const zoom of [8, 12, 16]) {
      expect(
        evaluate(style.emergencyRadius, circleRadius, {}, zoom) as number,
      ).toBeGreaterThan(
        evaluate(style.ringRadius, circleRadius, {}, zoom) as number,
      );
    }
  });

  it("marks every status but registered", () => {
    expect(matches(style.markFilter, props({ mark: "?" }))).toBe(true);
    expect(matches(style.markFilter, props({ mark: "" }))).toBe(false);
  });

  it("points and trails are told apart by geometry", () => {
    expect(matches(style.pointFilter, props(), 1)).toBe(true);
    expect(matches(style.pointFilter, props(), 2)).toBe(false);
    expect(matches(style.trailFilter, props(), 2)).toBe(true);
    expect(matches(style.trailFilter, props(), 1)).toBe(false);
  });

  it("sizes icons and labels by zoom", () => {
    const at = (
      expr: unknown,
      spec: StylePropertySpecification,
      zoom: number,
    ) => evaluate(expr, spec, props(), zoom) as number;
    expect(at(style.iconSize, iconSize, 16)).toBeGreaterThan(
      at(style.iconSize, iconSize, 8),
    );
    expect(at(style.textSize, textSize, 16)).toBeGreaterThan(
      at(style.textSize, textSize, 8),
    );
  });

  it("trails take the status colour and fade with age", () => {
    expect(
      evaluate(style.trailColor, lineColor, props({ ident: "unidentified" })),
    ).toBeTruthy();
    expect(
      evaluate(
        style.trailOpacity,
        lineOpacity,
        props({ age: "stale" }),
      ) as number,
    ).toBeLessThan(
      evaluate(
        style.trailOpacity,
        lineOpacity,
        props({ age: "live" }),
      ) as number,
    );
  });

  it("matches the reviewed expressions (legend-change on a diff)", () => {
    expect(style).toMatchSnapshot();
  });
});
