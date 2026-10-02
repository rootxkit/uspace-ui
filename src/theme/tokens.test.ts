// styles/tokens.css against WCAG 2.2 AA contrast and simulated colour
// vision deficiency (WP-1; docs/PLAN.md §3.2). Colour carries meaning on a
// safety console; this file is the proof that an operator can tell the
// colours of each palette apart, under any colour vision, in both schemes.
// "Looks fine on my screen" is not (LESSONS E-04).
//
// Everything is computed here, without a dependency:
//
// - Contrast ratio: WCAG 2.2 definition of relative luminance and contrast
//   ratio (https://www.w3.org/TR/WCAG22/#dfn-relative-luminance,
//   #dfn-contrast-ratio). Thresholds: SC 1.4.3 Contrast (Minimum), 4.5:1
//   for text; SC 1.4.11 Non-text Contrast, 3:1 for graphical objects and
//   component boundaries.
// - Colour vision deficiency: Machado, Oliveira and Fernandes, "A
//   Physiologically-based Model for Simulation of Color Vision
//   Deficiency", IEEE TVCG 15(6), 2009, pp. 1291-1298. The severity 1.0
//   protanopia and deuteranopia matrices from the authors' table
//   (inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/), applied to
//   linear RGB.
// - Colour difference: CIEDE2000 (CIE 142-2001) as written in Sharma, Wu
//   and Dalal, "The CIEDE2000 Color-Difference Formula: Implementation
//   Notes, Supplementary Test Data, and Mathematical Observations", Color
//   Research and Application 30(1), 2005; pinned below with three pairs of
//   their test data. sRGB to CIELAB with the D65 white point.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  IDENT_STATUSES,
  SEVERITIES,
  TRUSTS,
  ZONE_TYPES,
} from "../model/index.js";
import { AGE_BUCKETS, tokens } from "./tokens.js";

/** SC 1.4.3: text and images of text. */
const MIN_CONTRAST_TEXT = 4.5;
/** SC 1.4.11: graphical objects and user interface component boundaries. */
const MIN_CONTRAST_GRAPHICS = 3;
/**
 * The smallest CIEDE2000 difference allowed between two colours of one
 * palette, in normal vision and under each simulation. A difference of
 * about 2 is just noticeable side by side; 12 keeps two map symbols apart
 * at a glance, apart in space and on a busy basemap.
 */
const MIN_DELTA_E00 = 12;

type Rgb = readonly [number, number, number];
type Lab = readonly [number, number, number];
type Matrix = readonly [Rgb, Rgb, Rgb];

const PROTANOPIA: Matrix = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
];
const DEUTERANOPIA: Matrix = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
];
const VISIONS: readonly (readonly [string, Matrix | null])[] = [
  ["normal vision", null],
  ["deuteranopia", DEUTERANOPIA],
  ["protanopia", PROTANOPIA],
];

function srgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) throw new Error(`not a #rrggbb colour: ${hex}`);
  return [1, 2, 3].map((i) => parseInt(m[i] ?? "", 16) / 255) as unknown as Rgb;
}

const toLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

function linear(hex: string): Rgb {
  const [r, g, b] = srgb(hex);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

function luminance(hex: string): number {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const clamp = (x: number): number => Math.min(1, Math.max(0, x));

function simulate(rgb: Rgb, m: Matrix | null): Rgb {
  if (m === null) return rgb;
  const [r, g, b] = rgb;
  return m.map((row) => clamp(row[0] * r + row[1] * g + row[2] * b)) as [
    number,
    number,
    number,
  ];
}

// Linear sRGB to XYZ (IEC 61966-2-1) to CIELAB, D65.
function lab([r, g, b]: Rgb): Lab {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t: number): number =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const fx = f(x / 0.95047);
  const fy = f(y);
  const fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

function deltaE00([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar7 = ((c1 + c2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number): number => {
    if (a === 0 && b === 0) return 0;
    const h = deg(Math.atan2(b, a));
    return h < 0 ? h + 360 : h;
  };
  const h1 = hue(b1, a1p);
  const h2 = hue(b2, a2p);
  const chroma = c1p * c2p;
  let dh = 0;
  if (chroma !== 0) {
    dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dL = l2 - l1;
  const dC = c2p - c1p;
  const dH = 2 * Math.sqrt(chroma) * Math.sin(rad(dh / 2));
  const lBar = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBar = h1 + h2;
  if (chroma !== 0) {
    if (Math.abs(h1 - h2) <= 180) hBar = (h1 + h2) / 2;
    else hBar = h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos(rad(hBar - 30)) +
    0.24 * Math.cos(rad(2 * hBar)) +
    0.32 * Math.cos(rad(3 * hBar + 6)) -
    0.2 * Math.cos(rad(4 * hBar - 63));
  const dTheta = 30 * Math.exp(-(((hBar - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(rad(2 * dTheta)) * rc;
  return Math.sqrt(
    (dL / sl) ** 2 +
      (dC / sc) ** 2 +
      (dH / sh) ** 2 +
      rt * (dC / sc) * (dH / sh),
  );
}

function differenceUnder(a: string, b: string, m: Matrix | null): number {
  return deltaE00(lab(simulate(linear(a), m)), lab(simulate(linear(b), m)));
}

// --- the assertions, shared by the real palettes and the presence twins.

function assertContrast(
  fg: Record<string, string>,
  bg: Record<string, string>,
  min: number,
): void {
  for (const [fn, f] of Object.entries(fg)) {
    for (const [bn, b] of Object.entries(bg)) {
      const ratio = contrast(f, b);
      if (ratio < min) {
        throw new Error(
          `${fn} ${f} on ${bn} ${b}: ${ratio.toFixed(2)}:1 < ${min}:1`,
        );
      }
    }
  }
}

function assertDistinguishable(palette: Record<string, string>): void {
  const entries = Object.entries(palette);
  for (const [vision, m] of VISIONS) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [an, a] = entries[i] as [string, string];
        const [bn, b] = entries[j] as [string, string];
        const d = differenceUnder(a, b, m);
        if (d < MIN_DELTA_E00) {
          throw new Error(
            `${an} ${a} and ${bn} ${b} under ${vision}: ΔE00 ${d.toFixed(1)} < ${MIN_DELTA_E00}`,
          );
        }
      }
    }
  }
}

// --- styles/tokens.css

const css = readFileSync("styles/tokens.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function block(selector: string): Record<string, string> {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if ((m[1] ?? "").replace(/\s+/g, " ").trim() !== selector) continue;
    const out: Record<string, string> = {};
    for (const d of (m[2] ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out[d[1] ?? ""] = (d[2] ?? "").trim();
    }
    return out;
  }
  throw new Error(`no block for ${selector} in styles/tokens.css`);
}

const SCHEMES = {
  light: block(':root, [data-theme="light"]'),
  dark: block('[data-theme="dark"]'),
} as const;

function pick(
  scheme: Record<string, string>,
  names: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, name] of Object.entries(names)) {
    const v = scheme[name];
    if (v === undefined) throw new Error(`${name} is not defined`);
    out[key] = v;
  }
  return out;
}

const ageNames = Object.fromEntries(
  AGE_BUCKETS.map((b, i) => [b, tokens.age[i] ?? ""]),
);
const PALETTES = {
  severity: { names: tokens.severity, min: MIN_CONTRAST_TEXT },
  trust: { names: tokens.trust, min: MIN_CONTRAST_GRAPHICS },
  ident: {
    names: { ...tokens.ident, none: tokens.identNone },
    min: MIN_CONTRAST_GRAPHICS,
  },
  zone: { names: tokens.zone, min: MIN_CONTRAST_GRAPHICS },
  age: { names: ageNames, min: MIN_CONTRAST_GRAPHICS },
} as const;

const v = (name: string): string => `--us-${name}`;

describe("colour math", () => {
  it("reproduces CIEDE2000 test data of Sharma, Wu and Dalal (2005)", () => {
    // Pairs 1, 25 and 26 of their Table 1.
    expect(deltaE00([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(
      2.0425,
      4,
    );
    expect(deltaE00([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 4);
    expect(deltaE00([50, 2.5, 0], [61, -5, 29])).toBeCloseTo(22.8977, 4);
  });

  it("gives 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 6);
    expect(contrast("#1f5fc4", "#1f5fc4")).toBe(1);
  });

  it("leaves greys grey under both simulations", () => {
    // Each Machado row sums to 1, so an achromatic colour is unchanged.
    for (const m of [PROTANOPIA, DEUTERANOPIA]) {
      for (const row of m) expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 5);
      const grey = linear("#808080");
      const sim = simulate(grey, m);
      for (let i = 0; i < 3; i++) expect(sim[i]).toBeCloseTo(grey[i] ?? 0, 5);
    }
  });

  it("collapses red and green under deuteranopia but not in normal vision", () => {
    // The transform does something: the classic confusion pair is far apart
    // in normal vision and close once simulated.
    const red = "#c8501e";
    const green = "#6e8c1e";
    expect(differenceUnder(red, green, null)).toBeGreaterThan(MIN_DELTA_E00);
    expect(differenceUnder(red, green, DEUTERANOPIA)).toBeLessThan(
      MIN_DELTA_E00,
    );
  });
});

describe("the assertions fail on a bad palette (presence twins)", () => {
  it("refuses a pair that only differs in hue for a deuteranope", () => {
    expect(() => assertDistinguishable({ a: "#c8501e", b: "#6e8c1e" })).toThrow(
      /under deuteranopia/,
    );
  });

  it("refuses a pair that collapses only under protanopia", () => {
    // A teal and a magenta: far apart in normal vision and for a
    // deuteranope, nearly one colour for a protanope, who sees reds dark.
    const pair = { teal: "#006677", magenta: "#ff0077" };
    expect(differenceUnder(pair.teal, pair.magenta, null)).toBeGreaterThan(
      MIN_DELTA_E00,
    );
    expect(
      differenceUnder(pair.teal, pair.magenta, DEUTERANOPIA),
    ).toBeGreaterThan(MIN_DELTA_E00);
    expect(() => assertDistinguishable(pair)).toThrow(/under protanopia/);
  });

  it("refuses two colours too close in normal vision", () => {
    expect(() => assertDistinguishable({ a: "#1366ea", b: "#1a6ce8" })).toThrow(
      /under normal vision/,
    );
  });

  it("refuses a colour below the contrast threshold", () => {
    expect(() =>
      assertContrast({ pale: "#9db8e0" }, { surface: "#ffffff" }, 3),
    ).toThrow(/pale #9db8e0 on surface #ffffff/);
  });

  it("accepts a palette that is apart and contrasted", () => {
    expect(() =>
      assertDistinguishable({ a: "#000000", b: "#ffffff" }),
    ).not.toThrow();
    expect(() =>
      assertContrast({ ink: "#000000" }, { paper: "#ffffff" }, 4.5),
    ).not.toThrow();
  });
});

describe.each(Object.entries(SCHEMES))("%s scheme", (_scheme, s) => {
  const surfaces = pick(s, {
    surface: v("surface"),
    "surface-raised": v("surface-raised"),
  });

  it("defines every token name as a #rrggbb colour", () => {
    const names = [
      ...Object.values(tokens.severity),
      ...Object.values(tokens.trust),
      ...Object.values(tokens.ident),
      tokens.identNone,
      ...Object.values(tokens.zone),
      ...tokens.age,
      tokens.brandAccent,
    ];
    expect(names).toHaveLength(
      SEVERITIES.length +
        TRUSTS.length +
        IDENT_STATUSES.length +
        1 +
        ZONE_TYPES.length +
        AGE_BUCKETS.length +
        1,
    );
    for (const n of names) expect(s[n]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(Object.entries(PALETTES))(
    "%s meets its contrast on both surfaces",
    (_name, p) => {
      assertContrast(pick(s, p.names), surfaces, p.min);
    },
  );

  it.each(Object.entries(PALETTES))(
    "%s stays apart in normal vision, deuteranopia and protanopia",
    (_name, p) => {
      assertDistinguishable(pick(s, p.names));
    },
  );

  it("keeps text, borders and focus legible", () => {
    const backgrounds = {
      ...surfaces,
      "surface-sunken": s[v("surface-sunken")] ?? "",
    };
    assertContrast(
      pick(s, { text: v("text"), "text-muted": v("text-muted") }),
      backgrounds,
      MIN_CONTRAST_TEXT,
    );
    // Destructive text (form errors) sits on the surfaces too.
    assertContrast(
      pick(s, { danger: v("danger") }),
      surfaces,
      MIN_CONTRAST_TEXT,
    );
    // Input boundaries and the focus ring are component boundaries.
    assertContrast(
      pick(s, { "border-strong": v("border-strong"), focus: v("focus") }),
      surfaces,
      MIN_CONTRAST_GRAPHICS,
    );
    assertContrast(
      pick(s, { "on-brand-accent": v("on-brand-accent") }),
      pick(s, { "brand-accent": v("brand-accent") }),
      MIN_CONTRAST_TEXT,
    );
    // shadcn's destructive Button and Badge hard-code white text on
    // `bg-destructive` (`/60` in dark); the Button browser test's axe run checks
    // that rendered pair. `--us-on-danger` is for the kit's own use.
    assertContrast(
      pick(s, { "on-danger": v("on-danger") }),
      pick(s, { danger: v("danger") }),
      MIN_CONTRAST_TEXT,
    );
  });
});

describe("tokens.css", () => {
  it("names no organisation colour: the accent default is the focus blue", () => {
    for (const s of Object.values(SCHEMES)) {
      expect(s[tokens.brandAccent]).toBe(s[v("focus")]);
    }
  });

  it("maps every palette colour to a Tailwind utility", () => {
    const theme = /@theme inline\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    for (const p of Object.values(PALETTES)) {
      for (const name of Object.values(p.names)) {
        const util = name.replace(/^--us-/, "--color-");
        expect(theme).toContain(`${util}: var(${name});`);
      }
    }
  });
});
