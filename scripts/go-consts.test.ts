// The Go constant reader behind scripts/check-enums.sh (WP-14), and the
// whole check against a local uspace-core: a faithful copy passes and a
// deliberately edited one fails, naming the difference (E-01: the
// presence twin of the online check).
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import * as model from "../src/model/index.js";
import { parseConsts, structFields, tokenize } from "./go-consts.mjs";

describe("tokenize", () => {
  it("drops comments, reads both string forms, inserts Go's semicolons", () => {
    const toks = tokenize(
      'const X T = "a\\"b" // c ) "d"\n/* ( */ const Y T = `raw)`\n',
    );
    expect(toks.map((t) => t.value)).toEqual([
      "const",
      "X",
      "T",
      "=",
      'a"b',
      ";",
      "const",
      "Y",
      "T",
      "=",
      "raw)",
      ";",
    ]);
  });
});

describe("parseConsts", () => {
  it("reads typed string constants of a block, a single line, several names and a repetition", () => {
    const src = `package core

// Trust is ...
type Trust string

const (
	// TrustAuthenticated: a comment with ) and "quotes"
	TrustAuthenticated Trust = "authenticated"
	TrustProvider, TrustSurveillance Trust = "provider", "surveillance"

	untyped = "not a Trust"
	count Trust = 3
)

const Single core.Severity = "info"

const (
	A Kind = "same"
	B
)

func f() {
	const local Trust = "inside a function"
}
`;
    expect(parseConsts(src)).toEqual([
      { name: "TrustAuthenticated", type: "Trust", value: "authenticated" },
      { name: "TrustProvider", type: "Trust", value: "provider" },
      { name: "TrustSurveillance", type: "Trust", value: "surveillance" },
      { name: "Single", type: "core.Severity", value: "info" },
      { name: "A", type: "Kind", value: "same" },
      { name: "B", type: "Kind", value: "same" },
    ]);
  });

  it("reads a struct's fields in order", () => {
    const src =
      "type FieldError struct {\n\tField  string // the path\n\tReason string\n}\n";
    expect(structFields(src, "FieldError")).toEqual(["Field", "Reason"]);
    expect(structFields(src, "Other")).toEqual([]);
  });

  it("refuses what it cannot read rather than guessing", () => {
    expect(() => tokenize('const X T = "open\n')).toThrow(/newline in string/);
    expect(() => tokenize('const X T = "\\u00e9"')).toThrow(/not supported/);
  });
});

// --- the whole check against a local uspace-core -----------------------------

const SKIPPED: Record<string, readonly string[]> = {
  "alerting.ClearReason": ["acknowledged_timeout"],
};

function block(type: string, values: readonly string[]): string {
  const name = type.split(".")[1] ?? type;
  const skip = SKIPPED[type] ?? [];
  const lines = values
    .filter((v) => !skip.includes(v))
    .map((v, i) => `\t${name}${i} ${name} = "${v}"`);
  return `type ${name} string\n\nconst (\n${lines.join("\n")}\n)\n`;
}

/** A uspace-core whose constants are the kit's own lists, tagged as pinned. */
function fakeCore(dir: string, edit?: (src: string) => string): void {
  const core = [
    "package core\n",
    block("core.VerticalRef", model.VERTICAL_REFS),
    block("core.AltSource", model.ALT_SOURCES),
    block("core.TimeSource", model.TIME_SOURCES),
    block("core.Trust", model.TRUSTS),
    block("core.Severity", model.SEVERITIES),
    block("core.ZoneType", model.ZONE_TYPES),
    block("core.IdentStatus", model.IDENT_STATUSES),
    block("core.IdentReason", model.IDENT_REASONS),
    block("core.IdentBasis", model.IDENT_BASES),
    "type FieldError struct {\n\tField  string\n\tReason string\n}\n",
  ].join("\n");
  for (const pkg of ["core", "alerting", "sources"])
    mkdirSync(join(dir, pkg), { recursive: true });
  writeFileSync(join(dir, "core", "enums.go"), edit ? edit(core) : core);
  writeFileSync(
    join(dir, "alerting", "alerting.go"),
    `package alerting\n\n${block("alerting.ClearReason", model.CLEAR_REASONS)}`,
  );
  writeFileSync(
    join(dir, "sources", "sources.go"),
    `package sources\n\n${block("sources.Why", model.DISABLED_BYS)}`,
  );
  const tag = /^v\d+\.\d+\.\d+/m.exec(
    readFileSync("docs/CORE_VERSION", "utf8"),
  )?.[0];
  if (tag === undefined) throw new Error("no tag in docs/CORE_VERSION");
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", dir, ...args], { stdio: "pipe" });
  git("init", "-q");
  git("add", ".");
  git(
    "-c",
    "user.name=TEST",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "-m",
    "TEST core",
  );
  git("tag", tag);
}

function check(dir: string, out: string): { status: number; output: string } {
  try {
    const output = execFileSync("sh", ["scripts/check-enums.sh"], {
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, USPACE_CORE_REPO: dir, CORE_ENUMS_OUT: out },
    });
    return { status: 0, output };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { status: err.status, output: `${err.stdout}${err.stderr}` };
  }
}

let work = "";

afterEach(() => {
  if (work !== "") rmSync(work, { recursive: true, force: true });
  work = "";
});

describe("check-enums.sh against a local uspace-core", () => {
  it("passes a faithful copy of the kit's enumerations", () => {
    work = mkdtempSync(join(tmpdir(), "check-enums-"));
    fakeCore(join(work, "core"));
    const r = check(join(work, "core"), join(work, "enums.tsv"));
    expect(r.output).toMatch(/\| core\.Trust \| 6 \| 6 \| same \|/);
    expect(r.status).toBe(0);
    // The header is one line, and the first constant starts the next.
    const lines = readFileSync(join(work, "enums.tsv"), "utf8").split("\n");
    expect(lines[0]).toMatch(/^# uspace-core v\d+\.\d+\.\d+\S* [0-9a-f]{40}$/);
    expect(lines[1]).not.toMatch(/^#|^$/);
  }, 120_000);

  it("fails a copy with one Trust value edited, and names it in the table", () => {
    work = mkdtempSync(join(tmpdir(), "check-enums-"));
    fakeCore(join(work, "core"), (src) =>
      src.replace(/(\tTrust\d+ Trust = )"broadcast"/, '$1"broadcasted"'),
    );
    const r = check(join(work, "core"), join(work, "enums.tsv"));
    expect(r.output).toMatch(
      /\| core\.Trust \| 6 \| 6 \| DIFFERS \(missing in kit: broadcasted; absent from core: broadcast\) \|/,
    );
    expect(r.status).not.toBe(0);
  }, 120_000);
});

describe("the shell scripts' printf formats", () => {
  // A format written with a newline inside its quotes instead of `\n`
  // prints the same today and is what a tool that eats `\n` leaves
  // behind (check-enums.sh's header was one): every format is one line.
  const formats = (src: string): string[] =>
    [...src.matchAll(/\bprintf\s+'([^']*)'/g)].map((m) => m[1] ?? "");

  it("finds a format with a newline inside its quotes", () => {
    expect(formats("printf '# a %s\n' \"$x\"\nprintf '%s\\n' y\n")).toEqual([
      "# a %s\n",
      "%s\\n",
    ]);
  });

  it("writes every format of scripts/*.sh on one line, with \\n", () => {
    const broken: string[] = [];
    const scripts = readdirSync("scripts").filter((f) => f.endsWith(".sh"));
    expect(scripts).toContain("check-enums.sh");
    for (const f of scripts)
      for (const fmt of formats(readFileSync(join("scripts", f), "utf8")))
        if (fmt.includes("\n")) broken.push(`${f}: ${JSON.stringify(fmt)}`);
    expect(broken).toEqual([]);
  });
});
