// The part of fontkit 2.0.4 the font test uses (it ships no types). Read
// from its dist/module.mjs: `openSync(path)` returns a font object with
// these members for TrueType and WOFF2 alike.
declare module "fontkit" {
  export interface Font {
    familyName: string;
    subfamilyName: string;
    characterSet: number[];
    hasGlyphForCodePoint(codePoint: number): boolean;
  }
  export function openSync(path: string): Font;
}
