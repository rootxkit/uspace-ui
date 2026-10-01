// The next/font loaders, with next/font/local mocked: outside a Next.js
// build it throws by design (Next's compiler replaces the call). The mock
// records the options, which is what Next reads at build time.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("next/font/local", () => ({
  default: (opts: Record<string, unknown>) => {
    calls.push(opts);
    const variable = String(opts["variable"]);
    return {
      className: `cls${variable}`,
      variable: `var${variable}`,
      style: { fontFamily: variable },
    };
  },
}));

const fonts = await import("./index.js");
const here = dirname(fileURLToPath(import.meta.url));

interface Options {
  src: { path: string; weight: string; style: string }[];
  variable: string;
  adjustFontFallback?: false;
  declarations: { prop: string; value: string }[];
}

const [latin, georgian] = calls as unknown as [Options, Options];

describe("fonts loaders", () => {
  it("calls next/font/local once per family", () => {
    expect(calls).toHaveLength(2);
  });

  it("points every src at a committed file, from src/ as from dist/", () => {
    const paths = [...latin.src, ...georgian.src].map((s) => s.path);
    expect(paths.map((p) => p.replace("../../fonts/", "")).sort()).toEqual(
      fonts.FONT_FILES.map((f) => f.file).sort(),
    );
    for (const p of paths) expect(existsSync(resolve(here, p)), p).toBe(true);
  });

  it("gives each file the weight faces.ts records", () => {
    for (const s of [...latin.src, ...georgian.src]) {
      const face = fonts.FONT_FILES.find((f) => s.path.endsWith(f.file));
      expect(s.weight).toBe(String(face?.weight));
    }
  });

  it("limits each family to its unicode-range", () => {
    expect(latin.declarations).toEqual([
      { prop: "unicode-range", value: fonts.LATIN_UNICODE_RANGE },
    ]);
    expect(georgian.declarations).toEqual([
      { prop: "unicode-range", value: fonts.GEORGIAN_UNICODE_RANGE },
    ]);
  });

  it("gives Georgian no metric fallback face to cover Latin, and Latin one", () => {
    expect(georgian.adjustFontFallback).toBe(false);
    expect(latin.adjustFontFallback).toBeUndefined();
  });

  it("sets the variables fontFamily stacks, Georgian first", () => {
    expect(latin.variable).toBe(fonts.FONT_VARIABLES.latin);
    expect(georgian.variable).toBe(fonts.FONT_VARIABLES.georgian);
    expect(fonts.fontClassName).toBe(
      "var--us-font-georgian var--us-font-latin",
    );
    expect(fonts.fontFamily.indexOf("--us-font-georgian")).toBeLessThan(
      fonts.fontFamily.indexOf("--us-font-latin"),
    );
    expect(fonts.notoSans.variable).toBe("var--us-font-latin");
    expect(fonts.notoSansGeorgian.variable).toBe("var--us-font-georgian");
  });

  it("names the basemap glyph set as the map fontstack", () => {
    expect(fonts.mapFontstack).toBe("Noto Sans Regular");
  });
});
