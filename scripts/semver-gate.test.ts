// The semver gate (WP-14; PLAN §12) on fixture diffs: each rule with a
// passing and a failing variant (E-01), the printed reason naming the
// rule, and the line diff it rests on. Plus one run of the command on this
// repository's own history, so the git half is exercised too.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  apiReportChanges,
  breakingHeading,
  citations,
  classifyReport,
  diffLines,
  evaluate,
  legendFunctionRanges,
  symbologyChanges,
  tokenChanges,
  type GateInput,
} from "./semver-gate.mjs";

const REPORT = `## API Report File for "@rootxkit/uspace-ui"

\`\`\`ts

import { JSX } from 'react';

// @public
function AgeChip(props: AgeChipProps): JSX.Element;

// @public (undocumented)
interface AgeChipProps {
    // (undocumented)
    ageS: number | null;
    staleAfterS: number;
}

// @beta
function resetCountersForTests(): void;

declare namespace status_2 {
    export {
        AgeChip,
        AgeChipProps,
        resetCountersForTests
    }
}
export { status_2 as status }

// Warnings were encountered during analysis:
//
// src/x.ts:1:1 - (ae-forgotten-export) The symbol "Y" needs to be exported

\`\`\`
`;

const TOKENS_CSS = `:root {
  --us-surface: #ffffff;
  --us-severity-critical: #c0143c;
  --us-trust-broadcast: #b45309;
}
`;

const CHANGELOG = `# Changelog

## Unreleased

## 1.0.0

- first stable
`;

const SYMBOLOGY = `import type { Trust } from "../model/index.js";

/** The CSS variable of a trust class. */
export function trustToken(t: Trust): string {
  switch (t) {
    case "broadcast":
      // R-05: hollow, orange
      return "--us-trust-broadcast";
    default:
      return "--us-trust-other";
  }
}

export function trustLabel(t: Trust): string {
  return t;
}
`;

function input(
  over: Partial<GateInput> & { headReport?: string } = {},
): GateInput {
  return {
    baseVersion: "1.0.0",
    base: { report: REPORT, tokens: TOKENS_CSS, changelog: CHANGELOG },
    head: {
      report: over.headReport ?? REPORT,
      tokens: TOKENS_CSS,
      changelog: CHANGELOG,
    },
    symbology: [],
    labels: [],
    ...over,
  };
}

describe("diffLines", () => {
  it("finds the removed and added lines of a shortest edit", () => {
    expect(diffLines(["a", "b", "c", "d"], ["a", "c", "x", "d"])).toEqual({
      removed: [1],
      added: [2],
    });
    expect(diffLines(["a", "b"], ["a", "b"])).toEqual({
      removed: [],
      added: [],
    });
    expect(diffLines([], ["a"])).toEqual({ removed: [], added: [0] });
    expect(diffLines(["a"], [])).toEqual({ removed: [0], added: [] });
  });

  it("sees a line inserted among identical lines as one addition", () => {
    const a = ["x", "y", "x", "y", "z"];
    const b = ["x", "y", "x", "new", "y", "z"];
    expect(diffLines(a, b)).toEqual({ removed: [], added: [3] });
  });
});

describe("classifyReport", () => {
  it("gives each declaration line its release tag and ignores the rest", () => {
    const { classes, lines, tags } = classifyReport(REPORT);
    const at = (text: string) => classes[lines.indexOf(text)];
    expect(at("function AgeChip(props: AgeChipProps): JSX.Element;")).toEqual({
      kind: "decl",
      name: "AgeChip",
      tag: "public",
    });
    expect(at("    ageS: number | null;")).toMatchObject({
      name: "AgeChipProps",
    });
    expect(at("    // (undocumented)")).toEqual({ kind: "ignore" });
    expect(at("import { JSX } from 'react';")).toEqual({ kind: "ignore" });
    expect(at("        resetCountersForTests")).toEqual({
      kind: "member",
      name: "resetCountersForTests",
    });
    expect(tags.get("resetCountersForTests")).toBe("beta");
    expect(at("// @beta")).toMatchObject({ name: "resetCountersForTests" });
  });
});

describe("rule 1: the API report", () => {
  it("an added line passes without a label", () => {
    const head = REPORT.replace(
      "    staleAfterS: number;\n",
      "    staleAfterS: number;\n    compact?: boolean;\n",
    );
    expect(apiReportChanges(REPORT, head).breaking).toEqual([]);
    const r = evaluate(input({ headReport: head }));
    expect(r.ok).toBe(true);
    expect(r.report[0]).toMatch(/^rule 1 .*not fired/);
  });

  it("a removed public line fails without the label and the heading, naming the rule", () => {
    const head = REPORT.replace("    staleAfterS: number;\n", "");
    const r = evaluate(input({ headReport: head }));
    expect(r.ok).toBe(false);
    expect(r.report[0]).toMatch(
      /^rule 1 \(API report, PLAN §12\): FIRED: 1 @public line/,
    );
    expect(r.report.join("\n")).toMatch(/AgeChipProps\): staleAfterS: number;/);
    expect(r.report.join("\n")).toMatch(/the label "breaking": MISSING/);
    expect(r.report.join("\n")).toMatch(
      /heading of 2\.0\.0 or later \(from 1\.0\.0\): MISSING/,
    );
    expect(r.report.at(-1)).toBe("semver gate: FAIL");
  });

  it("a removed public line passes with the label and a new major heading", () => {
    const head = REPORT.replace("    staleAfterS: number;\n", "");
    const changelog = CHANGELOG.replace(
      "## Unreleased\n",
      "## Unreleased\n\n## [2.0.0]\n\n- Removed: AgeChipProps.staleAfterS\n",
    );
    const r = evaluate({
      ...input({ headReport: head }),
      head: { report: head, tokens: TOKENS_CSS, changelog },
      labels: ["breaking"],
    });
    expect(r.report.join("\n")).toMatch(/found 2\.0\.0/);
    expect(r.ok).toBe(true);
  });

  it("the label alone is not enough; nor is a minor heading from v1", () => {
    const head = REPORT.replace("    staleAfterS: number;\n", "");
    const minor = CHANGELOG.replace(
      "## Unreleased\n",
      "## Unreleased\n\n## 1.1.0\n",
    );
    const r = evaluate({
      ...input({ headReport: head }),
      head: { report: head, tokens: TOKENS_CSS, changelog: minor },
      labels: ["breaking"],
    });
    expect(r.ok).toBe(false);
    expect(r.report.join("\n")).toMatch(/MISSING \(new headings: 1\.1\.0\)/);
  });

  it("a changed public line counts as removed", () => {
    const head = REPORT.replace(
      "function AgeChip(props: AgeChipProps): JSX.Element;",
      "function AgeChip(props: AgeChipProps): JSX.Element | null;",
    );
    expect(apiReportChanges(REPORT, head).breaking.map((e) => e.name)).toEqual([
      "AgeChip",
    ]);
  });

  it("a public declaration demoted to @beta is a change of the public line", () => {
    const head = REPORT.replace(
      "// @public\nfunction AgeChip",
      "// @beta\nfunction AgeChip",
    );
    expect(apiReportChanges(REPORT, head).breaking.map((e) => e.name)).toEqual([
      "AgeChip",
    ]);
  });

  it("a removed @beta export is outside the gate; a removed public one is not", () => {
    const betaGone = REPORT.replace(
      "// @beta\nfunction resetCountersForTests(): void;\n\n",
      "",
    ).replace(",\n        resetCountersForTests\n", "\n");
    const c = apiReportChanges(REPORT, betaGone);
    expect(c.breaking).toEqual([]);
    expect(c.beta.length).toBeGreaterThan(0);
    expect(evaluate(input({ headReport: betaGone })).report[0]).toMatch(
      /not fired.*@beta line\(s\) changed, outside the gate/,
    );
    const publicGone = REPORT.replace("        AgeChip,\n", "");
    expect(
      apiReportChanges(REPORT, publicGone).breaking.map((e) => e.name),
    ).toEqual(["AgeChip"]);
  });

  it("a documentation comment or a warning line is not a change", () => {
    const head = REPORT.replace(
      "    // (undocumented)\n    ageS",
      "    ageS",
    ).replace(
      '// src/x.ts:1:1 - (ae-forgotten-export) The symbol "Y" needs to be exported\n',
      "",
    );
    expect(apiReportChanges(REPORT, head).breaking).toEqual([]);
  });

  it("before v1, a minor heading is enough", () => {
    expect(
      breakingHeading("0.1.0", "## 0.1.0\n", "## 0.2.0\n## 0.1.0\n"),
    ).toEqual({
      need: "0.2.0",
      found: "0.2.0",
      fresh: ["0.2.0"],
    });
    expect(
      breakingHeading("0.1.0", "## 0.1.0\n", "## 1.0.0\n## 0.1.0\n").found,
    ).toBe("1.0.0");
    expect(
      breakingHeading("0.1.0", "## 0.1.0\n", "## 0.1.0\n").found,
    ).toBeNull();
  });
});

describe("rule 2: the semantic tokens", () => {
  it("a token value change fails without legend-change and a citation", () => {
    const tokens = TOKENS_CSS.replace("#b45309", "#c2410c");
    expect(tokenChanges(TOKENS_CSS, tokens)).toEqual([
      { line: 4, text: "--us-trust-broadcast: #b45309;" },
    ]);
    const r = evaluate({
      ...input(),
      head: { report: REPORT, tokens, changelog: CHANGELOG },
    });
    expect(r.ok).toBe(false);
    expect(r.report[1]).toMatch(
      /^rule 2 \(legend, PLAN §12\): FIRED: 1 legend line/,
    );
    expect(r.report.join("\n")).toMatch(/the label "legend-change": MISSING/);
  });

  it("passes with the label and a CHANGELOG line citing a lesson", () => {
    const tokens = TOKENS_CSS.replace("#b45309", "#c2410c");
    const changelog = CHANGELOG.replace(
      "## Unreleased\n",
      "## Unreleased\n\n- Changed: the broadcast orange is darker for contrast (R-05 keeps the hollow fill).\n",
    );
    const r = evaluate({
      ...input(),
      head: { report: REPORT, tokens, changelog },
      labels: ["legend-change"],
    });
    expect(r.ok).toBe(true);
    expect(r.report.join("\n")).toMatch(
      /found: - Changed: the broadcast orange/,
    );
  });

  it("the label without a citing line still fails", () => {
    const tokens = TOKENS_CSS.replace("#b45309", "#c2410c");
    const changelog = CHANGELOG.replace(
      "## Unreleased\n",
      "## Unreleased\n\n- Darker orange.\n",
    );
    const r = evaluate({
      ...input(),
      head: { report: REPORT, tokens, changelog },
      labels: ["legend-change"],
    });
    expect(r.ok).toBe(false);
  });

  it("a non-legend token or an added legend token passes without a label", () => {
    const tokens = TOKENS_CSS.replace("#ffffff", "#fafafa").replace(
      "}\n",
      "  --us-trust-new: #123456;\n}\n",
    );
    expect(tokenChanges(TOKENS_CSS, tokens)).toEqual([]);
    expect(
      evaluate({
        ...input(),
        head: { report: REPORT, tokens, changelog: CHANGELOG },
      }).ok,
    ).toBe(true);
  });

  it("cites LESSONS ids and spec rows, not plain text", () => {
    expect(
      citations(
        "",
        "- R-05 hollow\n- spec 04 §3\n- 02 §1\n- nothing\n- INV-03\n",
      ),
    ).toEqual(["- R-05 hollow", "- spec 04 §3", "- 02 §1", "- INV-03"]);
  });
});

describe("rule 3: the symbology", () => {
  it("finds the *Token/*Shape/*Pattern functions and their lines", () => {
    expect(legendFunctionRanges(SYMBOLOGY)).toEqual([
      { name: "trustToken", from: 4, to: 12 },
    ]);
    expect(
      legendFunctionRanges("export const zoneShape = (t: string) => t;\n"),
    ).toEqual([{ name: "zoneShape", from: 1, to: 1 }]);
  });

  it("a changed return fails without legend-change", () => {
    const head = SYMBOLOGY.replace(
      'return "--us-trust-broadcast";',
      'return "--us-trust-sensor";',
    );
    const r = evaluate({
      ...input(),
      symbology: [{ path: "src/symbology/track.ts", base: SYMBOLOGY, head }],
    });
    expect(r.ok).toBe(false);
    expect(r.report.join("\n")).toMatch(
      /src\/symbology\/track\.ts:8 in trustToken: return "--us-trust-broadcast";/,
    );
  });

  it("a comment change in symbology passes", () => {
    const head = SYMBOLOGY.replace(
      "// R-05: hollow, orange",
      "// R-05: hollow fill, orange",
    );
    expect(symbologyChanges("src/symbology/track.ts", SYMBOLOGY, head)).toEqual(
      [],
    );
    expect(
      evaluate({
        ...input(),
        symbology: [{ path: "src/symbology/track.ts", base: SYMBOLOGY, head }],
      }).ok,
    ).toBe(true);
  });

  it("a change outside a legend function, or a new case, passes", () => {
    const head = SYMBOLOGY.replace("  return t;", "  return `${t}`;").replace(
      "    default:\n",
      '    case "sensor":\n      return "--us-trust-sensor";\n    default:\n',
    );
    expect(symbologyChanges("src/symbology/track.ts", SYMBOLOGY, head)).toEqual(
      [],
    );
  });
});

describe("the command on this repository", () => {
  it("passes against HEAD itself: nothing changed, every rule not fired", () => {
    const out = execFileSync(
      process.execPath,
      ["scripts/semver-gate.mjs", "--base", "HEAD", "--labels", "[]"],
      { encoding: "utf8" },
    );
    expect(out).toMatch(/rule 1 .*not fired/);
    expect(out).toMatch(/rule 2 .*not fired/);
    expect(out.trim().split("\n").at(-1)).toBe("semver gate: pass");
  });

  it("refuses a run without --base, and labels that are not a JSON array (exit 2)", () => {
    const run = (args: string[]) => {
      try {
        execFileSync(process.execPath, ["scripts/semver-gate.mjs", ...args], {
          encoding: "utf8",
          stdio: "pipe",
        });
        return 0;
      } catch (e) {
        return (e as { status: number }).status;
      }
    };
    expect(run([])).toBe(2);
    expect(run(["--base", "HEAD", "--labels", "breaking"])).toBe(2);
  });

  it("is the job the semver-gate workflow runs on every pull request", () => {
    const wf = readFileSync(".github/workflows/semver-gate.yml", "utf8");
    expect(wf).toMatch(
      /types: \[opened, synchronize, reopened, labeled, unlabeled\]/,
    );
    expect(wf).toMatch(/node scripts\/semver-gate\.mjs --base "\$BASE_SHA"/);
    expect(wf).toMatch(
      /PR_LABELS: \$\{\{ toJSON\(github\.event\.pull_request\.labels\.\*\.name\) \}\}/,
    );
    // No path filter: a required check must report on every pull request.
    expect(wf).not.toMatch(/paths:/);
  });
});
