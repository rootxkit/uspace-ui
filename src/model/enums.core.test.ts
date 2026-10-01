// Compares src/model with the string constants scripts/check-enums.sh
// extracted from uspace-core/core at the tag in docs/CORE_VERSION.
//
// Without the extraction file (any run other than the script) every test
// here is skipped with a printed reason, so the skip is visible in the
// summary and never reads as a pass.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";

import * as model from "./index.js";
import type { FieldError } from "./index.js";

const file = process.env["CORE_ENUMS_FILE"] ?? ".cache/core-enums.tsv";
const present = existsSync(file);

// core type name -> the kit's array
const MIRRORED: Record<string, readonly string[]> = {
  VerticalRef: model.VERTICAL_REFS,
  AltSource: model.ALT_SOURCES,
  TimeSource: model.TIME_SOURCES,
  Trust: model.TRUSTS,
  Severity: model.SEVERITIES,
  ZoneType: model.ZONE_TYPES,
  IdentStatus: model.IDENT_STATUSES,
  IdentReason: model.IDENT_REASONS,
  IdentBasis: model.IDENT_BASES,
};

// core.FieldError has no JSON tags; the wire names are its field names in
// lower case, which is what model.FieldError carries.
const FIELD_ERROR_KEYS = ["field", "reason"] as const;
expectTypeOf<keyof FieldError>().toEqualTypeOf<
  (typeof FIELD_ERROR_KEYS)[number]
>();

export interface Extraction {
  header: string;
  byType: Map<string, string[]>;
}

export function parseExtraction(text: string): Extraction {
  const byType = new Map<string, string[]>();
  let header = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("#")) {
      header ||= line.slice(1).trim();
      continue;
    }
    const [type, value] = line.split("\t");
    if (!type || value === undefined) continue;
    const list = byType.get(type) ?? [];
    list.push(value);
    byType.set(type, list);
  }
  return { header, byType };
}

export interface Skip {
  type: string;
  value: string;
  why: string;
}

export function parseSkips(coreVersion: string): Skip[] {
  const skips: Skip[] = [];
  for (const line of coreVersion.split(/\r?\n/)) {
    const m = /^skip\s+(\S+)\s+(\S+)\s*(.*)$/.exec(line);
    if (m?.[1] && m[2])
      skips.push({ type: m[1], value: m[2], why: m[3] ?? "" });
  }
  return skips;
}

export interface Comparison {
  missingInKit: string[];
  missingInCore: string[];
  skipped: string[];
  staleSkips: string[];
}

// Core values the kit lacks always fail. Kit values core lacks fail unless
// listed as a skip; a listed skip core now has is stale and fails too.
export function compare(
  type: string,
  core: readonly string[],
  kit: readonly string[],
  skips: readonly Skip[],
): Comparison {
  const listed = new Set(
    skips.filter((s) => s.type === type).map((s) => s.value),
  );
  const coreSet = new Set(core);
  const kitSet = new Set(kit);
  const absentInCore = kit.filter((v) => !coreSet.has(v));
  return {
    missingInKit: core.filter((v) => !kitSet.has(v)),
    missingInCore: absentInCore.filter((v) => !listed.has(v)),
    skipped: absentInCore.filter((v) => listed.has(v)),
    staleSkips: [...listed].filter((v) => coreSet.has(v)),
  };
}

describe("compare", () => {
  const skips = [{ type: "IdentBasis", value: "provider", why: "Q18" }];

  it("agrees when both sides carry the same values", () => {
    expect(compare("Trust", ["a", "b"], ["b", "a"], skips)).toEqual({
      missingInKit: [],
      missingInCore: [],
      skipped: [],
      staleSkips: [],
    });
  });

  it("fails a core value the kit lacks", () => {
    expect(compare("Trust", ["a", "b"], ["a"], skips).missingInKit).toEqual([
      "b",
    ]);
  });

  it("fails a kit value core lacks when it is not listed", () => {
    expect(compare("Trust", ["a"], ["a", "x"], skips).missingInCore).toEqual([
      "x",
    ]);
  });

  it("reports a listed kit value core lacks as a skip, not a failure", () => {
    const c = compare(
      "IdentBasis",
      ["authenticated"],
      ["authenticated", "provider"],
      skips,
    );
    expect(c.skipped).toEqual(["provider"]);
    expect(c.missingInCore).toEqual([]);
  });

  it("fails a listed skip that core has gained", () => {
    const c = compare("IdentBasis", ["provider"], ["provider"], skips);
    expect(c.staleSkips).toEqual(["provider"]);
  });

  it("parses the extraction and the skip lines", () => {
    const e = parseExtraction(
      "# uspace-core v1 abc\nTrust\ta\nTrust\tb\nFieldError\tField\n",
    );
    expect(e.header).toBe("uspace-core v1 abc");
    expect(e.byType.get("Trust")).toEqual(["a", "b"]);
    expect(e.byType.get("FieldError")).toEqual(["Field"]);
    expect(
      parseSkips("v1.0.0\n# skip X y\nskip IdentBasis provider  Q18 note\n"),
    ).toEqual([{ type: "IdentBasis", value: "provider", why: "Q18 note" }]);
  });
});

const title = present
  ? `enumerations against uspace-core (${file})`
  : `enumerations against uspace-core: SKIPPED, no extraction at ${file}; run scripts/check-enums.sh`;

describe.skipIf(!present)(title, () => {
  const extraction = present
    ? parseExtraction(readFileSync(file, "utf8"))
    : { header: "", byType: new Map<string, string[]>() };
  const skips = parseSkips(readFileSync("docs/CORE_VERSION", "utf8"));

  it("names the tag and commit it was extracted from", () => {
    expect(extraction.header).toMatch(/^uspace-core \S+ [0-9a-f]{40}$/);
    console.log(`enums.core: comparing with ${extraction.header}`);
  });

  it.each(Object.keys(MIRRORED))("%s mirrors core", (type) => {
    const core = extraction.byType.get(type);
    expect(core, `core has no constants of type ${type}`).toBeDefined();
    const c = compare(type, core ?? [], MIRRORED[type] ?? [], skips);
    for (const v of c.skipped) {
      const why =
        skips.find((s) => s.type === type && s.value === v)?.why ?? "";
      console.log(
        `enums.core: SKIP ${type} "${v}" absent from core (listed: ${why})`,
      );
    }
    expect(
      c.missingInKit,
      `core values missing from the kit's ${type}`,
    ).toEqual([]);
    expect(
      c.missingInCore,
      `kit values of ${type} absent from core and not listed`,
    ).toEqual([]);
    expect(c.staleSkips, `listed skips of ${type} that core now has`).toEqual(
      [],
    );
  });

  it("mirrors the FieldError shape", () => {
    const fields = extraction.byType.get("FieldError") ?? [];
    expect(fields.map((f) => f.toLowerCase()).sort()).toEqual(
      [...FIELD_ERROR_KEYS].sort(),
    );
  });
});

if (!present) {
  console.log(
    `enums.core: SKIPPED, no extraction at ${file}; run scripts/check-enums.sh to compare with uspace-core`,
  );
}
