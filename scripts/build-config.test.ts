// The two build configs of `pnpm build`: tsconfig.build.json emits the
// declarations with their doc comments (api-extractor and consumers read
// them), tsconfig.build.js.json the JavaScript without comments (they
// count against the PLAN §8 gzip budgets and reach no one from there).
// Each config is compiled on a one-file source with a doc comment and
// its output read back.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repo = join(import.meta.dirname, "..");
const DOC = "/** Gzip budget fixture: this doc comment is read back. */";
const SOURCE = `${DOC}\nexport function answer(): number {\n  // A line comment.\n  return 42;\n}\n`;

let tmp = "";

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "build-config-"));
  mkdirSync(join(tmp, "src"));
  writeFileSync(join(tmp, "src", "answer.ts"), SOURCE);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Emits src/answer.ts under `config`'s options into tmp/dist. */
function emit(config: string): void {
  const path = join(repo, config);
  const read = ts.readConfigFile(path, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, repo);
  const options = {
    ...parsed.options,
    rootDir: join(tmp, "src"),
    outDir: join(tmp, "dist"),
  };
  const program = ts.createProgram([join(tmp, "src", "answer.ts")], options);
  const result = program.emit();
  expect(result.emitSkipped).toBe(false);
}

const out = (name: string) => join(tmp, "dist", name);

describe("build configs", () => {
  it("tsconfig.build.json emits declarations with their doc comments and no JavaScript", () => {
    emit("tsconfig.build.json");
    expect(readFileSync(out("answer.d.ts"), "utf8")).toContain(DOC);
    expect(existsSync(out("answer.d.ts.map"))).toBe(true);
    expect(existsSync(out("answer.js"))).toBe(false);
  });

  it("tsconfig.build.js.json emits JavaScript without comments and no declarations", () => {
    emit("tsconfig.build.js.json");
    const js = readFileSync(out("answer.js"), "utf8");
    expect(js).toContain("return 42;");
    expect(js).not.toContain("Gzip budget fixture");
    expect(js).not.toContain("A line comment");
    expect(js).toContain("//# sourceMappingURL=answer.js.map");
    expect(existsSync(out("answer.js.map"))).toBe(true);
    expect(existsSync(out("answer.d.ts"))).toBe(false);
  });

  it("pnpm build runs both, declarations first", () => {
    const pkg = JSON.parse(
      readFileSync(join(repo, "package.json"), "utf8"),
    ) as { scripts: { build: string } };
    expect(pkg.scripts.build).toBe(
      "node scripts/clean.mjs dist && tsc -p tsconfig.build.json && tsc -p tsconfig.build.js.json",
    );
  });
});
