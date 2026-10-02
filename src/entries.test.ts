// Every JavaScript key of the package's `exports` map points at a source
// entry under src/, and every stub entry carries its marker.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

interface ExportTarget {
  types: string;
  default: string;
}

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  exports: Record<string, ExportTarget | string>;
};

// The entry points of docs/PLAN.md §2, in the plan's order.
const PLAN_KEYS = [
  "./model",
  "./theme",
  "./ui",
  "./i18n",
  "./fonts",
  "./map",
  "./api",
  "./auth/server",
  "./auth/client",
  "./symbology",
  "./layers",
  "./legend",
  "./live",
  "./status",
  "./alerts",
  "./table",
  "./form",
  "./eslint",
  "./test",
  "./styles/tokens.css",
  "./styles/map.css",
  "./fonts/*.woff2",
];

// Plan entries not yet in the map, each with the reason and the WP that
// adds it.
const PENDING: Record<string, string> = {};

// Entries a work package added beyond PLAN §2 (additive, §12), each with
// the reason, in the map's order after the plan's.
const ADDED: Record<string, string> = {
  "./fonts/fonts.css":
    "WP-2: the @font-face rules and the font-sans stack for Storybook and non-Next consumers",
};

// Entries that are real (WP-0, WP-1, WP-2, WP-3, WP-4, WP-6); the rest are stubs
// until their WP.
const REAL = new Set([
  "./model",
  "./theme",
  "./ui",
  "./i18n",
  "./fonts",
  "./map",
  "./api",
  "./symbology",
  "./layers",
  "./legend",
  "./eslint",
  "./test",
]);

const jsKeys = Object.entries(pkg.exports).filter(
  (e): e is [string, ExportTarget] => typeof e[1] === "object",
);

describe("exports map", () => {
  it("has every entry point of PLAN §2 but the pending ones, the added ones, and package.json", () => {
    const expected = PLAN_KEYS.filter((k) => !(k in PENDING));
    expect(Object.keys(pkg.exports)).toEqual([
      ...expected,
      ...Object.keys(ADDED),
      "./package.json",
    ]);
  });

  it("lists as pending only plan entries that are absent", () => {
    for (const key of Object.keys(PENDING)) {
      expect(PLAN_KEYS).toContain(key);
      expect(pkg.exports).not.toHaveProperty([key]);
    }
  });

  it.each(jsKeys)(
    "%s maps dist/<key>/index onto src/<key>/index.ts",
    (key, target) => {
      const dir = key.slice(2);
      expect(target).toEqual({
        types: `./dist/${dir}/index.d.ts`,
        default: `./dist/${dir}/index.js`,
      });
      expect(existsSync(`src/${dir}/index.ts`)).toBe(true);
    },
  );

  it.each(jsKeys.filter(([k]) => !REAL.has(k)))(
    "%s stub exports its marker",
    async (key) => {
      const url = pathToFileURL(resolve("src", key.slice(2), "index.ts")).href;
      const mod = (await import(/* @vite-ignore */ url)) as Record<
        string,
        unknown
      >;
      expect({ ...mod }).toEqual({ ENTRY: key.slice(2) });
    },
  );
});
