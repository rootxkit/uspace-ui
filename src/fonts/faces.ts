// The bundled faces as data (docs/PLAN.md D7, §3.5): which file covers
// which code points, the CSS variables the loaders set and the MapLibre
// fontstack. No `next` import, so the map layers, Storybook and the tests
// read these without Next.js. `index.ts` repeats the ranges as literals
// (next/font requires literal options); the font test compares them.

/**
 * Asomtavruli and Mkhedruli (U+10A0-10FF), Mtavruli (U+1C90-1CBF),
 * Nuskhuri (U+2D00-2D2F): every Georgian block, so Georgian text falls to
 * the Georgian face and Latin text never downloads it.
 */
export const GEORGIAN_UNICODE_RANGE = "U+10A0-10FF, U+1C90-1CBF, U+2D00-2D2F";

/**
 * What NotoSans-*.woff2 is subset to (scripts/subset-fonts.sh): Latin with
 * Latin-1, Extended-A and the region's Extended-B letters, Greek,
 * Cyrillic, punctuation, currency signs and arrows.
 */
export const LATIN_UNICODE_RANGE =
  "U+0000-017F, U+018F, U+0192, U+0218-021B, U+0237, U+0259, U+02BB-02BC, U+02C6-02DD, U+0300-0304, U+0306-0308, U+030A-030C, U+0327-0328, U+0370-03FF, U+0400-04FF, U+1E9E, U+2000-206F, U+20AC, U+20B8, U+20BD, U+20BE, U+2116, U+2122, U+2190-2193, U+2212";

/** The CSS variables the loaders define (`fontClassName` sets both). */
export const FONT_VARIABLES = {
  latin: "--us-font-latin",
  georgian: "--us-font-georgian",
} as const;

/**
 * The family stack: the Georgian face first (its unicode-range admits only
 * Georgian), then Latin, then the platform. Without the loaders' classes
 * (Storybook, a non-Next app) the variables fall back to the families
 * `fonts/fonts.css` declares over the same files.
 */
export const fontFamily = `var(${FONT_VARIABLES.georgian}, "Noto Sans Georgian"), var(${FONT_VARIABLES.latin}, "Noto Sans"), ui-sans-serif, system-ui, sans-serif`;

/**
 * The MapLibre fontstack every label layer uses: the glyph set the
 * basemap bundle is built with, Latin and Georgian ranges included
 * (PLAN §6.3, §14 Q4; lab WP-L3). A layer writes
 * `"text-font": [mapFontstack]`.
 */
export const mapFontstack = "Noto Sans Regular";

export interface FontFile {
  file: string;
  family: "Noto Sans" | "Noto Sans Georgian";
  weight: 400 | 700;
  unicodeRange: string;
}

/** The four committed files, as `fonts/` holds them. */
export const FONT_FILES: readonly FontFile[] = [
  {
    file: "NotoSans-Regular.woff2",
    family: "Noto Sans",
    weight: 400,
    unicodeRange: LATIN_UNICODE_RANGE,
  },
  {
    file: "NotoSans-Bold.woff2",
    family: "Noto Sans",
    weight: 700,
    unicodeRange: LATIN_UNICODE_RANGE,
  },
  {
    file: "NotoSansGeorgian-Regular.woff2",
    family: "Noto Sans Georgian",
    weight: 400,
    unicodeRange: GEORGIAN_UNICODE_RANGE,
  },
  {
    file: "NotoSansGeorgian-Bold.woff2",
    family: "Noto Sans Georgian",
    weight: 700,
    unicodeRange: GEORGIAN_UNICODE_RANGE,
  },
];
