import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  expectedFiles,
  exportTargets,
  packProblems,
  readTarEntries,
} from "./pack-test.mjs";

/** A minimal tar entry: a ustar header (no checksum; unused) and its body. */
function entry(name: string, body: string, type = "0", prefix = ""): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, "utf8");
  const data = Buffer.from(body, "utf8");
  header.write(data.length.toString(8).padStart(11, "0"), 124, "latin1");
  header.write(type, 156, "latin1");
  header.write("ustar\u0000", 257, "latin1");
  header.write(prefix, 345, "utf8");
  const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512);
  data.copy(padded);
  return Buffer.concat([header, padded]);
}

function tgz(...parts: Buffer[]): Buffer {
  return gzipSync(Buffer.concat([...parts, Buffer.alloc(1024)]));
}

const PKG = {
  files: ["bin", "dist", "styles", "fonts", "README.md", "CHANGELOG.md"],
  exports: {
    "./model": {
      types: "./dist/model/index.d.ts",
      default: "./dist/model/index.js",
    },
    "./styles/tokens.css": "./styles/tokens.css",
    "./fonts/*.woff2": "./fonts/*.woff2",
    "./fonts/fonts.css": "./fonts/fonts.css",
    "./package.json": "./package.json",
  },
  bin: { "uspace-ui-gen-api": "./bin/uspace-ui-gen-api.mjs" },
};

const GOOD = [
  "CHANGELOG.md",
  "README.md",
  "bin/uspace-ui-gen-api.mjs",
  "dist/model/index.d.ts",
  "dist/model/index.js",
  "fonts/NotoSans-Regular.woff2",
  "fonts/fonts.css",
  "package.json",
  "styles/tokens.css",
];

describe("readTarEntries", () => {
  it("lists regular files without package/, joining ustar prefixes", () => {
    const entries = readTarEntries(
      tgz(
        entry("package/", "", "5"),
        entry("package/package.json", "{}"),
        entry("index.js", "x".repeat(700), "0", "package/dist/model"),
      ),
    );
    expect(entries).toEqual([
      { path: "package.json", size: 2 },
      { path: "dist/model/index.js", size: 700 },
    ]);
  });

  it("takes a long name from a pax header", () => {
    const pax = "35 path=package/dist/a/very/long.js\n";
    const entries = readTarEntries(
      tgz(entry("PaxHeader", pax, "x"), entry("package/short", "y")),
    );
    expect(entries).toEqual([{ path: "dist/a/very/long.js", size: 1 }]);
  });
});

describe("packProblems", () => {
  it("passes a tarball holding exactly the expected files", () => {
    expect(packProblems(GOOD, GOOD, PKG)).toEqual([]);
  });

  it("reports a source or test file that was packed", () => {
    const actual = [...GOOD, "src/model/index.ts", "dist/x.test.js"];
    const expected = [...GOOD, "dist/x.test.js"];
    expect(packProblems(actual, expected, PKG)).toEqual([
      "not in files, but packed: src/model/index.ts",
      "forbidden path packed: src/model/index.ts",
      "forbidden path packed: dist/x.test.js",
    ]);
  });

  it("reports a file of files that is missing, and a required one", () => {
    const actual = GOOD.filter((f) => f !== "CHANGELOG.md");
    expect(packProblems(actual, GOOD, PKG)).toEqual([
      "missing from the tarball: CHANGELOG.md",
      "required file absent: CHANGELOG.md",
    ]);
  });

  it("reports exports and bin targets the tarball does not hold", () => {
    const actual = GOOD.filter(
      (f) =>
        !f.endsWith(".woff2") &&
        f !== "dist/model/index.d.ts" &&
        f !== "bin/uspace-ui-gen-api.mjs",
    );
    expect(packProblems(actual, actual, PKG)).toEqual([
      "required file absent: bin/uspace-ui-gen-api.mjs",
      'exports "./model": ./dist/model/index.d.ts is not in the tarball',
      'exports "./fonts/*.woff2": no packed file matches ./fonts/*.woff2',
      'bin "uspace-ui-gen-api": ./bin/uspace-ui-gen-api.mjs is not in the tarball',
    ]);
  });

  it("lists every conditional target of exports", () => {
    expect(exportTargets(PKG.exports).map((t) => t.target)).toEqual([
      "./dist/model/index.d.ts",
      "./dist/model/index.js",
      "./styles/tokens.css",
      "./fonts/*.woff2",
      "./fonts/fonts.css",
      "./package.json",
    ]);
  });
});

describe("expectedFiles", () => {
  let root = "";
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "pack-test-"));
    mkdirSync(join(root, "dist", "model"), { recursive: true });
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "dist", "model", "index.js"), "");
    writeFileSync(join(root, "src", "index.ts"), "");
    writeFileSync(join(root, "LICENSE"), "");
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("walks files and adds the manifest, README, CHANGELOG and a licence", () => {
    expect(expectedFiles(root, { files: ["dist", "missing"] })).toEqual([
      "CHANGELOG.md",
      "LICENSE",
      "README.md",
      "dist/model/index.js",
      "package.json",
    ]);
  });
});
