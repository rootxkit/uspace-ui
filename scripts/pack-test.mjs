// Pack test (WP-13a): runs `pnpm pack` on the built package and checks the
// tarball that would be released. It must contain exactly what `files`
// names (plus the manifest, README.md and CHANGELOG.md), nothing from the
// sources, tests or docs, and every `exports` and `bin` target. Run by
// `pnpm check` and by CI's `pack` job, whose tarball is the one a tag
// releases.
//
//   node scripts/pack-test.mjs [--out <dir>]
//
// With GITHUB_OUTPUT set it writes `tarball`, `name` and `sha256` there.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { tarballName } from "./release.mjs";

/** Always in the tarball besides `files` (npm adds the first two itself). */
export const ALWAYS = ["package.json", "README.md", "CHANGELOG.md"];
/** Must be present: presence is checked, not only absence (E-01). */
export const REQUIRED = [
  ...ALWAYS,
  "bin/uspace-ui-gen-api.mjs",
  "dist/model/index.js",
  "styles/tokens.css",
  "fonts/fonts.css",
];
/** Never in the tarball. */
export const FORBIDDEN = [
  /^src\//,
  /^browser\//,
  /^scripts\//,
  /^docs\//,
  /^examples\//,
  /^\.github\//,
  /^node_modules\//,
  /^coverage\//,
  /\.test\.[cm]?[jt]sx?$/,
  /(^|\/)\.env/,
  /\.tgz$/,
];

function octal(buf, start, len) {
  const text = buf
    .subarray(start, start + len)
    .toString("latin1")
    .replace(/\0.*$/s, "")
    .trim();
  return text === "" ? 0 : parseInt(text, 8);
}

function cstr(buf, start, len) {
  return buf
    .subarray(start, start + len)
    .toString("utf8")
    .replace(/\0.*$/s, "");
}

/**
 * Regular-file entries of a gzipped tar: [{ path, size }], with the
 * leading `package/` removed. Handles ustar prefixes, pax `path` records
 * and GNU long names.
 */
export function readTarEntries(gz) {
  const tar = gunzipSync(gz);
  const entries = [];
  let longName = null;
  for (let off = 0; off + 512 <= tar.length;) {
    const header = tar.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const size = octal(header, 124, 12);
    const type = String.fromCharCode(header[156] ?? 0);
    const body = tar.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") {
      const m = /\d+ path=([^\n]*)\n/.exec(body.toString("utf8"));
      if (m?.[1]) longName = m[1];
      continue;
    }
    if (type === "L") {
      longName = body.toString("utf8").replace(/\0.*$/s, "");
      continue;
    }
    if (type === "g") continue;
    let path = cstr(header, 0, 100);
    if (cstr(header, 257, 5) === "ustar") {
      const prefix = cstr(header, 345, 155);
      if (prefix) path = `${prefix}/${path}`;
    }
    if (longName !== null) path = longName;
    longName = null;
    if (type !== "0" && type !== "\0") continue;
    entries.push({ path: path.replace(/^package\//, ""), size });
  }
  return entries;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return [dir];
  return readdirSync(dir).flatMap((name) => walk(join(dir, name)));
}

/** What the tarball must hold: every file under `files`, plus ALWAYS. */
export function expectedFiles(root, pkg) {
  const fromFiles = pkg.files.flatMap((entry) =>
    walk(join(root, entry)).map((f) => relative(root, f).split(sep).join("/")),
  );
  const licence = readdirSync(root).filter((n) => /^LICEN[CS]E/i.test(n));
  return [...new Set([...fromFiles, ...ALWAYS, ...licence])].sort();
}

/** Every target path in an `exports` value, with its subpath key. */
export function exportTargets(exportsMap) {
  const out = [];
  const visit = (key, value) => {
    if (typeof value === "string") out.push({ key, target: value });
    else if (value && typeof value === "object")
      for (const v of Object.values(value)) visit(key, v);
  };
  for (const [key, value] of Object.entries(exportsMap)) visit(key, value);
  return out;
}

/**
 * Problems with a packed file list against the manifest: missing or extra
 * files, forbidden paths, absent required files, and `exports` or `bin`
 * targets that do not exist in the tarball. [] when it is right.
 */
export function packProblems(actual, expected, pkg) {
  const have = new Set(actual);
  const want = new Set(expected);
  const problems = [];
  for (const f of expected)
    if (!have.has(f)) problems.push(`missing from the tarball: ${f}`);
  for (const f of actual)
    if (!want.has(f)) problems.push(`not in files, but packed: ${f}`);
  for (const f of actual)
    if (FORBIDDEN.some((re) => re.test(f)))
      problems.push(`forbidden path packed: ${f}`);
  for (const f of REQUIRED)
    if (!have.has(f)) problems.push(`required file absent: ${f}`);
  for (const { key, target } of exportTargets(pkg.exports ?? {})) {
    const path = target.replace(/^\.\//, "");
    if (path.includes("*")) {
      const re = new RegExp(`^${path.split("*").map(escapeRe).join("[^/]+")}$`);
      if (!actual.some((f) => re.test(f)))
        problems.push(`exports "${key}": no packed file matches ${target}`);
    } else if (!have.has(path)) {
      problems.push(`exports "${key}": ${target} is not in the tarball`);
    }
  }
  for (const [name, target] of Object.entries(pkg.bin ?? {}))
    if (!have.has(target.replace(/^\.\//, "")))
      problems.push(`bin "${name}": ${target} is not in the tarball`);
  return problems;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Runs `pnpm pack` into `outDir`; returns the tarball path. */
export function pack(root, outDir) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const file = join(outDir, tarballName(pkg.name, pkg.version));
  rmSync(file, { force: true });
  execFileSync("pnpm", ["pack", "--pack-destination", outDir], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
    shell: process.platform === "win32",
  });
  if (!existsSync(file)) throw new Error(`pnpm pack did not write ${file}`);
  return file;
}

function main(argv) {
  const root = process.cwd();
  const outIdx = argv.indexOf("--out");
  const outDir =
    outIdx === -1
      ? mkdtempSync(join(tmpdir(), "uspace-ui-pack-"))
      : resolve(argv[outIdx + 1] ?? ".");
  mkdirSync(outDir, { recursive: true });
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (!existsSync(join(root, "dist"))) {
    console.error("dist/ does not exist; run pnpm build first");
    return 1;
  }
  const file = pack(root, outDir);
  const bytes = readFileSync(file);
  const actual = readTarEntries(bytes)
    .map((e) => e.path)
    .sort();
  const problems = packProblems(actual, expectedFiles(root, pkg), pkg);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  for (const p of problems) console.error(`pack-test: ${p}`);
  if (problems.length > 0) return 1;
  const exportsCount = Object.keys(pkg.exports ?? {}).length;
  console.log(
    `pack-test: ${file} holds exactly the ${actual.length} files of "files"; ` +
      `${exportsCount} exports and ${Object.keys(pkg.bin ?? {}).length} bin target(s) present; ` +
      `${bytes.length} bytes, sha256 ${sha256}`,
  );
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `tarball=${file}\nname=${tarballName(pkg.name, pkg.version)}\nsha256=${sha256}\n`,
    );
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
