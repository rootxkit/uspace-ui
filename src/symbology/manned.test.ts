// Manned symbology (WP-12): total over every trust class, hollow for a
// broadcast position and solid for surveillance (R-05, with its twin), an
// absent or unknown trust class drawn as broadcast (never an upgrade, with
// its twin), the ringed no-course icon (R-10), and the expressions parsed
// and evaluated with MapLibre's own style-spec package. The snapshot at
// the end is reviewed on change with the `legend-change` label.
import {
  createExpression,
  featureFilter,
  latest,
  type StylePropertySpecification,
} from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import { TRUSTS, type Trust } from "../model/index.js";
import { tokens } from "../theme/tokens.js";
import { ageOpacity } from "./age.js";
import {
  MANNED_ICON_IDS,
  MANNED_SOURCE_CLASS_KEYS,
  mannedFill,
  mannedIconDistance,
  mannedIconId,
  mannedIconParts,
  mannedIconSdf,
  mannedStyle,
  mannedToken,
  mannedTrustDrawn,
  type MannedColours,
} from "./manned.js";
import { TRACK_ICON_IDS, trackIconId } from "./track.js";
import { TRACK_ICON_PX } from "./trackIcon.js";
import { en } from "../i18n/en.js";
import { ka } from "../i18n/ka.js";

const COLOURS: MannedColours = {
  trust: {
    authenticated: "#11591c",
    provider: "#1184e1",
    surveillance: "#5112a4",
    broadcast: "#cb7e09",
    sensor: "#109c8d",
    simulated: "#4c4e55",
  },
  emergency: "#88122b",
  selected: "#111111",
  halo: "#ffffff",
};

type Props = Record<string, unknown>;

const style = mannedStyle(COLOURS);

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
    MANNED_ICON_IDS.map((i) => i.id),
  );
}

/** The image name an `icon-image` expression resolved to. */
function image(p: Props): string {
  const v = evaluate(style.iconImage, iconImage, p);
  return (v as { name: string }).name;
}

const str = (v: unknown): string => (v as { toString(): string }).toString();
/** The colour an `icon-color` expression resolved to, as MapLibre prints it. */
const colourOf = (p: Props): string =>
  str(evaluate(style.iconColor, iconColor, p));
/** A `#rrggbb` as MapLibre prints the same colour. */
const hex = (c: string): string => str(evaluate(c, iconColor, {}));

const props = (over: Props = {}): Props => ({
  kind: "manned",
  identifier: "TEST-MAN-0001",
  trust: "surveillance",
  trustStated: true,
  trackDeg: 90,
  emergency: false,
  selected: false,
  age: "live",
  label: "TEST001",
  ...over,
});

const iconImage = latest.layout_symbol["icon-image"];
const iconColor = latest.paint_symbol["icon-color"];
const iconOpacity = latest.paint_symbol["icon-opacity"];

describe("total over Trust", () => {
  // A loop over every value: with `satisfies never` in each switch, a new
  // trust class fails the build first and this loop second.
  for (const t of TRUSTS) {
    it(`${t} has a fill, a token, two icons and an expression arm`, () => {
      expect(["solid", "hollow"]).toContain(mannedFill(t));
      expect(mannedToken(t)).toBe(tokens.trust[t]);
      const ids = MANNED_ICON_IDS.filter((i) => i.trust === t).map((i) => i.id);
      expect(ids.sort()).toEqual(
        [mannedIconId(t, false), mannedIconId(t, true)].sort(),
      );
      expect(image(props({ trust: t }))).toBe(mannedIconId(t, true));
      expect(colourOf(props({ trust: t }))).toBe(hex(COLOURS.trust[t]));
    });
  }

  it("has twelve icons, none named like a track icon", () => {
    expect(MANNED_ICON_IDS).toHaveLength(TRUSTS.length * 2);
    const tracks = new Set(TRACK_ICON_IDS.map((i) => i.id));
    expect(MANNED_ICON_IDS.filter((i) => tracks.has(i.id))).toEqual([]);
    expect(mannedIconId("surveillance", true)).not.toBe(
      trackIconId("surveillance", true),
    );
  });
});

describe("R-05: a broadcast position is hollow", () => {
  it("broadcast is hollow", () => {
    expect(mannedFill("broadcast")).toBe("hollow");
  });

  it("surveillance is solid (the twin)", () => {
    expect(mannedFill("surveillance")).toBe("solid");
  });

  it("the hollow icon is empty at its centre and the solid one is not", () => {
    // Centre of the fuselage, a point well inside the outline.
    const inside = [0, -2] as const;
    expect(mannedIconDistance("surveillance", true, inside)).toBeLessThan(0);
    expect(mannedIconDistance("broadcast", true, inside)).toBeGreaterThan(0);
  });

  it("surveillance and broadcast differ in colour", () => {
    const s = colourOf(props({ trust: "surveillance" }));
    const b = colourOf(props({ trust: "broadcast" }));
    expect(s).not.toBe(b);
  });
});

describe("an absent trust class is never an upgrade", () => {
  it.each([null, undefined, "bogus", 7])(
    "%s draws as broadcast",
    (v: unknown) => {
      expect(mannedTrustDrawn(v)).toBe("broadcast");
    },
  );

  it.each(TRUSTS)("%s is kept as sent (the twin)", (t: Trust) => {
    expect(mannedTrustDrawn(t)).toBe(t);
  });

  it("an unknown trust in the feature draws the broadcast icon and colour", () => {
    expect(image(props({ trust: "bogus" }))).toBe(
      mannedIconId("broadcast", true),
    );
    expect(colourOf(props({ trust: "bogus" }))).toBe(
      hex(COLOURS.trust.broadcast),
    );
  });
});

describe("R-10: no course, no direction", () => {
  it("a null trackDeg picks the ringed icon, a number the plain one", () => {
    expect(image(props({ trackDeg: null }))).toBe(
      mannedIconId("surveillance", false),
    );
    expect(image(props({ trackDeg: 0 }))).toBe(
      mannedIconId("surveillance", true),
    );
  });

  it("the no-course icon carries the ring, the directional one does not", () => {
    const onRing = [21, 0] as const;
    expect(mannedIconDistance("surveillance", false, onRing)).toBeLessThan(0);
    expect(mannedIconDistance("surveillance", true, onRing)).toBeGreaterThan(0);
    expect(mannedIconParts("surveillance", false)).toHaveLength(2);
    expect(mannedIconParts("surveillance", true)).toHaveLength(1);
  });
});

describe("icons", () => {
  it.each(MANNED_ICON_IDS)("$id is an SDF bitmap with ink", (i) => {
    const img = mannedIconSdf(i.trust, i.directional);
    expect(img.width).toBe(TRACK_ICON_PX);
    expect(img.height).toBe(TRACK_ICON_PX);
    expect(img.data).toHaveLength(TRACK_ICON_PX * TRACK_ICON_PX * 4);
    let inked = 0;
    for (let p = 3; p < img.data.length; p += 4) {
      if ((img.data[p] ?? 0) >= 192) inked += 1;
    }
    expect(inked).toBeGreaterThan(20);
  });

  it("the hollow parts are stroked, the solid parts filled", () => {
    expect(mannedIconParts("broadcast", true)[0]?.fill).toBe(false);
    expect(mannedIconParts("surveillance", true)[0]?.fill).toBe(true);
  });
});

describe("age and rings", () => {
  it("fades by age bucket: stale is fainter than live, unknown in full", () => {
    const at = (age: string): unknown =>
      evaluate(style.iconOpacity, iconOpacity, props({ age }));
    expect(at("live")).toBe(ageOpacity("live"));
    expect(at("stale")).toBe(ageOpacity("stale"));
    expect(at("stale")).toBeLessThan(at("live") as number);
    expect(at("unknown")).toBe(1);
  });

  it("the emergency and selection filters match their features only", () => {
    const f = (filter: unknown, p: Props): boolean =>
      featureFilter(filter as never).filter(
        { zoom: 12 },
        { type: 1, properties: p },
      );
    expect(f(style.emergencyFilter, props({ emergency: true }))).toBe(true);
    expect(f(style.emergencyFilter, props())).toBe(false);
    expect(f(style.selectedFilter, props({ selected: true }))).toBe(true);
    expect(f(style.selectedFilter, props())).toBe(false);
  });
});

describe("words", () => {
  it("every source class 02 F4 names has a word in both catalogues", () => {
    expect(Object.keys(MANNED_SOURCE_CLASS_KEYS).sort()).toEqual(
      ["ads_b", "ads_l", "atm_feed", "mode_s", "ssr"].sort(),
    );
    for (const k of Object.values(MANNED_SOURCE_CLASS_KEYS)) {
      expect(en[k]).not.toBe("");
      expect(ka[k]).not.toBe("");
    }
  });
});

describe("snapshot", () => {
  it("the expressions, as data", () => {
    expect(style).toMatchSnapshot();
  });
});
