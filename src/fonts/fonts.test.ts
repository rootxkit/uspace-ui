// The bundled fonts are checked, not assumed (docs/PLAN.md D7, LESSONS
// E-02): every assigned code point of every Georgian block has a glyph,
// Latin is there, the files fit the budget, and the ranges declared in
// four places agree. CI's `fonts` job runs this file.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { openSync, type Font } from "fontkit";
import { describe, expect, it } from "vitest";

import {
  FONT_FILES,
  GEORGIAN_UNICODE_RANGE,
  LATIN_UNICODE_RANGE,
} from "./faces.js";

const FONTS_DIR = "fonts";

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// The assigned code points of the four Georgian blocks, from the Unicode
// Character Database 16.0.0 (UnicodeData.txt; unchanged since Unicode 11.0
// added Mtavruli). Checked against `\p{Assigned}` of ICU 76.1 (Node 22,
// Unicode 16.0) when written. Unassigned: U+10C6, U+10C8-10CC, U+10CE,
// U+10CF; U+1CBB, U+1CBC; U+2D26, U+2D28-2D2C, U+2D2E, U+2D2F.
const GEORGIAN_BLOCKS: Readonly<Record<string, readonly number[]>> = {
  // Georgian block, capital letters (U+10A0-10CF)
  Asomtavruli: [...range(0x10a0, 0x10c5), 0x10c7, 0x10cd],
  // Georgian block, small letters and marks (U+10D0-10FF)
  Mkhedruli: range(0x10d0, 0x10ff),
  // Georgian Extended (U+1C90-1CBF)
  Mtavruli: [...range(0x1c90, 0x1cba), ...range(0x1cbd, 0x1cbf)],
  // Georgian Supplement (U+2D00-2D2F)
  Nuskhuri: [...range(0x2d00, 0x2d25), 0x2d27, 0x2d2d],
};

const BASIC_LATIN = range(0x20, 0x7e);

function font(file: string): Font {
  return openSync(join(FONTS_DIR, file));
}

/** The code points of `cps` the font has no glyph for. */
function missingGlyphs(f: Font, cps: readonly number[]): number[] {
  return cps.filter((cp) => !f.hasGlyphForCodePoint(cp));
}

function expectCovers(f: Font, cps: readonly number[]): void {
  const missing = missingGlyphs(f, cps).map(
    (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
  );
  expect(missing, `${f.familyName} ${f.subfamilyName} lacks`).toEqual([]);
}

const GEORGIAN_FILES = [
  "NotoSansGeorgian-Regular.woff2",
  "NotoSansGeorgian-Bold.woff2",
];
const LATIN_FILES = ["NotoSans-Regular.woff2", "NotoSans-Bold.woff2"];

describe("Georgian glyph coverage", () => {
  it("lists the block sizes Unicode assigns", () => {
    expect(GEORGIAN_BLOCKS["Asomtavruli"]).toHaveLength(40);
    expect(GEORGIAN_BLOCKS["Mkhedruli"]).toHaveLength(48);
    expect(GEORGIAN_BLOCKS["Mtavruli"]).toHaveLength(46);
    expect(GEORGIAN_BLOCKS["Nuskhuri"]).toHaveLength(40);
  });

  for (const file of GEORGIAN_FILES) {
    for (const [block, cps] of Object.entries(GEORGIAN_BLOCKS)) {
      it(`${file} has a glyph for every ${block} code point`, () => {
        expectCovers(font(file), cps);
      });
    }
  }

  it("fails the check for a code point the font does not have (Hangul)", () => {
    const f = font("NotoSansGeorgian-Regular.woff2");
    expect(missingGlyphs(f, [0xac00])).toEqual([0xac00]);
    expect(() => expectCovers(f, [0x10d0, 0xac00])).toThrow(/U\+AC00/);
  });
});

describe("Latin glyph coverage", () => {
  for (const file of LATIN_FILES) {
    it(`${file} has Basic Latin, the degree and lari signs, Greek and Cyrillic samples`, () => {
      expectCovers(font(file), [
        ...BASIC_LATIN,
        0xb0, // degree sign, every heading
        0x20be, // lari sign
        0x3a9, // Greek capital omega
        0x416, // Cyrillic capital zhe
        0x259, // Latin small schwa (Azerbaijani)
      ]);
    });
  }

  it("leaves Georgian to the Georgian face", () => {
    expect(
      missingGlyphs(font("NotoSans-Regular.woff2"), [0x10d0, 0x1c90]),
    ).toEqual([0x10d0, 0x1c90]);
  });
});

describe("files and budget", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    fontBudget: { paths: string[]; maxWoff2Bytes: number };
  };
  const woff2 = readdirSync(FONTS_DIR).filter((f) => f.endsWith(".woff2"));

  it("ships exactly the four faces of faces.ts", () => {
    expect(woff2.sort()).toEqual(FONT_FILES.map((f) => f.file).sort());
  });

  it("keeps every woff2 within the budget in package.json", () => {
    const total = woff2.reduce(
      (n, f) => n + statSync(join(FONTS_DIR, f)).size,
      0,
    );
    expect(pkg.fontBudget.paths).toEqual([FONTS_DIR]);
    expect(total).toBeLessThanOrEqual(pkg.fontBudget.maxWoff2Bytes);
    expect(pkg.fontBudget.maxWoff2Bytes).toBe(120 * 1024); // PLAN §8
  });

  it("records each file's SHA-256 in fonts/SOURCES.md", () => {
    const sources = readFileSync(join(FONTS_DIR, "SOURCES.md"), "utf8");
    for (const f of woff2) {
      const sha = createHash("sha256")
        .update(readFileSync(join(FONTS_DIR, f)))
        .digest("hex");
      expect(sources, f).toContain(`${sha}  ${f}`);
    }
  });

  it("ships the OFL with both copyright lines", () => {
    const ofl = readFileSync(join(FONTS_DIR, "LICENSE-OFL.txt"), "utf8");
    expect(ofl).toContain("SIL Open Font License, Version 1.1");
    expect(ofl).toContain("https://github.com/notofonts/georgian");
    expect(ofl).toContain("https://github.com/notofonts/latin-greek-cyrillic");
  });
});

describe("declared ranges agree", () => {
  const flat = (s: string): string => s.replace(/\s+/g, "");

  it("index.ts passes faces.ts's ranges to next/font", () => {
    const src = readFileSync("src/fonts/index.ts", "utf8").replace(
      /"\s*\+?\s*\n\s*"/g,
      "",
    );
    expect(src).toContain(`"${LATIN_UNICODE_RANGE}"`);
    expect(src).toContain(`"${GEORGIAN_UNICODE_RANGE}"`);
  });

  it("fonts.css declares the same ranges per family", () => {
    const css = readFileSync(join(FONTS_DIR, "fonts.css"), "utf8");
    const ranges = [...css.matchAll(/unicode-range:([^;]+);/g)].map((m) =>
      flat(m[1] ?? ""),
    );
    expect(ranges).toEqual([
      flat(GEORGIAN_UNICODE_RANGE),
      flat(GEORGIAN_UNICODE_RANGE),
      flat(LATIN_UNICODE_RANGE),
      flat(LATIN_UNICODE_RANGE),
    ]);
  });

  it("subset-fonts.sh subsets to the same ranges", () => {
    const sh = readFileSync("scripts/subset-fonts.sh", "utf8");
    expect(sh).toContain(`latin_range="${flat(LATIN_UNICODE_RANGE)}"`);
    expect(sh).toContain(`georgian_range="${flat(GEORGIAN_UNICODE_RANGE)}"`);
  });
});
