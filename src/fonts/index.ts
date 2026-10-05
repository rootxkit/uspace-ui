// `@rootxkit/uspace-ui/fonts` (docs/PLAN.md D7, §3.5, WP-2): next/font
// loaders over the bundled Noto Sans and Noto Sans Georgian subsets, so a
// console makes no font request to a third party (06 §4).
//
// In a Next.js app: put `fontClassName` on <html> (the stack resolves the
// variables on the root element) and import
// "@rootxkit/uspace-ui/fonts/fonts.css" into the global stylesheet after
// Tailwind (it maps Tailwind's `font-sans` onto the stack). Checked with a
// packed build of this package in a Next.js 16.3.8 app (Turbopack): the
// calls compile from node_modules with or without `transpilePackages`.
//
// next/font reads its options at build time and accepts only literals, so
// the paths and ranges below are written out; src/fonts/fonts.test.ts
// checks them against faces.ts and the files. The paths are relative to
// this file in dist/fonts/ and in src/fonts/ alike.
import localFont from "next/font/local";

export {
  FONT_FILES,
  FONT_VARIABLES,
  GEORGIAN_UNICODE_RANGE,
  LATIN_UNICODE_RANGE,
  fontFamily,
  mapFontstack,
  type FontFile,
} from "./faces.js";

/**
 * Latin, Latin Extended, Greek and Cyrillic, regular and bold.
 *
 * @public
 */
export const notoSans = localFont({
  src: [
    {
      path: "../../fonts/NotoSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    { path: "../../fonts/NotoSans-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--us-font-latin",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-017F, U+018F, U+0192, U+0218-021B, U+0237, U+0259, U+02BB-02BC, U+02C6-02DD, U+0300-0304, U+0306-0308, U+030A-030C, U+0327-0328, U+0370-03FF, U+0400-04FF, U+1E9E, U+2000-206F, U+20AC, U+20B8, U+20BD, U+20BE, U+2116, U+2122, U+2190-2193, U+2212",
    },
  ],
});

/**
 * Mkhedruli, Mtavruli, Nuskhuri and Asomtavruli, regular and bold. No
 * metric fallback: a fallback face would cover Latin and stand in front of
 * Noto Sans in the stack.
 *
 * @public
 */
export const notoSansGeorgian = localFont({
  src: [
    {
      path: "../../fonts/NotoSansGeorgian-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/NotoSansGeorgian-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--us-font-georgian",
  display: "swap",
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+10A0-10FF, U+1C90-1CBF, U+2D00-2D2F" },
  ],
});

/**
 * Both loaders' classes: they define `--us-font-georgian` and
 * `--us-font-latin`, which `fontFamily` (and `fonts.css`'s `font-sans`)
 * stack Georgian first, so Georgian text falls to the Georgian face.
 *
 * @public
 */
export const fontClassName = `${notoSansGeorgian.variable} ${notoSans.variable}`;
