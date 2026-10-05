// Release tags for the API freeze (WP-14; PLAN §12, docs/api): every
// export of an entry point carries `@public` or `@beta`, and
// api-extractor fails on an untagged one (scripts/api-extractor.json,
// ae-missing-release-tag). `@public` is the contract the semver gate
// holds; `@beta` is outside it.
//
//   node scripts/release-tags.mjs           list the untagged exports and the tag each would get
//   node scripts/release-tags.mjs --write   add the tags to the source
//
// The rule (docs/RELEASING.md "The API freeze"): `model` and the vendored
// shadcn/ui set of `ui` are public whole (the frozen view models; the
// upstream components, PLAN §3.3); elsewhere an export named in PLAN §3
// is public and any other is beta, and a name that says it is for tests
// (`...ForTests`) is beta wherever it is named. A new export is tagged by
// its author; this script is the first tagging and the check of the rule.
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const root = process.cwd();

/** Every identifier written in PLAN §3. */
export function planNames(plan) {
  const start = plan.indexOf("## 3. Public API per entry point");
  const end = plan.indexOf("## 4. ", start);
  const section = plan.slice(start, end < 0 ? undefined : end);
  return new Set(section.match(/[A-Za-z_$][\w$]*/g) ?? []);
}

/** `public` or `beta` for an export of `entry` named `name`. */
export function decide(entry, name, file, names) {
  if (/ForTests$/.test(name)) return "beta";
  // The reference adapters are examples (PLAN §3.18), not a contract.
  if (file.startsWith("src/test/adapters/")) return "beta";
  if (entry === "model") return "public";
  if (
    entry === "ui" &&
    /^src\/ui\/[^/]+\.tsx?$/.test(file) &&
    !file.endsWith("index.ts")
  )
    return "public";
  if (entry === "ui" && file === "src/ui/cn.ts") return "public";
  return names.has(name) ? "public" : "beta";
}

function program() {
  const configPath = join(root, "tsconfig.build.json");
  const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
  return ts.createProgram(parsed.fileNames, parsed.options);
}

const STATEMENT_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.ModuleDeclaration,
  ts.SyntaxKind.VariableStatement,
]);

function statementOf(decl) {
  let n = decl;
  if (ts.isVariableDeclaration(n)) n = n.parent.parent;
  return STATEMENT_KINDS.has(n.kind) ? n : null;
}

/** Every exported declaration with its entry, name and file. */
export function exportedDeclarations() {
  const prog = program();
  const checker = prog.getTypeChecker();
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const out = [];
  const visit = (entry, sym, name, seen) => {
    let s = sym;
    if (s.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
    if (seen.has(s)) return;
    seen.add(s);
    for (const d of s.declarations ?? []) {
      const sf = d.getSourceFile();
      const file = relative(root, sf.fileName).split(sep).join("/");
      if (!file.startsWith("src/")) continue;
      if (ts.isSourceFile(d)) {
        // `export * as ns`: the module's own exports.
        for (const inner of checker.getExportsOfModule(s))
          visit(entry, inner, inner.getName(), seen);
        continue;
      }
      const st = statementOf(d);
      if (st !== null) out.push({ entry, name, file, node: st, sf });
    }
  };
  for (const [key, target] of Object.entries(pkg.exports)) {
    if (typeof target !== "object" || !target.types) continue;
    const src = target.types
      .replace(/^\.\/dist\//, "src/")
      .replace(/\.d\.ts$/, ".ts");
    const sf =
      prog.getSourceFile(join(root, src)) ??
      prog.getSourceFile(join(root, src + "x"));
    if (sf === undefined) throw new Error(`release-tags: no source for ${key}`);
    const msym = checker.getSymbolAtLocation(sf);
    if (msym === undefined) continue;
    const entry = key.slice(2);
    const seen = new Set();
    for (const e of checker.getExportsOfModule(msym))
      visit(entry, e, e.getName(), seen);
  }
  return out;
}

const TAGGED = /@(public|beta|alpha|internal)\b/;

function edits(decls, names) {
  // One decision per declaration: public wins when two exports share it.
  const byNode = new Map();
  for (const d of decls) {
    const tag = decide(d.entry, d.name, d.file, names);
    const prev = byNode.get(d.node);
    if (prev === undefined || (prev.tag === "beta" && tag === "public"))
      byNode.set(d.node, { ...d, tag });
  }
  const perFile = new Map();
  for (const d of byNode.values()) {
    const text = d.sf.getFullText();
    const docs = d.node.jsDoc ?? [];
    const doc = docs.at(-1);
    if (doc !== undefined && TAGGED.test(text.slice(doc.pos, doc.end)))
      continue;
    const start = d.node.getStart(d.sf, false);
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const indent = text.slice(lineStart, start).match(/^\s*/)?.[0] ?? "";
    let edit;
    if (doc === undefined) {
      edit = { pos: start, end: start, text: `/** @${d.tag} */\n${indent}` };
    } else {
      const old = text.slice(doc.pos, doc.end);
      const body = old.includes("\n")
        ? old.replace(
            /\s*\*\/$/,
            `\n${indent} *\n${indent} * @${d.tag}\n${indent} */`,
          )
        : `/**\n${indent} * ${old.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "")}\n${indent} *\n${indent} * @${d.tag}\n${indent} */`;
      edit = { pos: doc.pos, end: doc.end, text: body };
    }
    const list = perFile.get(d.sf.fileName) ?? [];
    list.push({ ...edit, name: d.name, tag: d.tag, entry: d.entry });
    perFile.set(d.sf.fileName, list);
  }
  return perFile;
}

/**
 * Retags the declarations named `names` from @beta to @public: a public
 * declaration whose signature references them makes them public too
 * (api-extractor's ae-incompatible-release-tags).
 */
export function promote(promoted) {
  const changed = new Set();
  for (const d of exportedDeclarations()) {
    if (!promoted.has(d.name)) continue;
    const doc = (d.node.jsDoc ?? []).at(-1);
    if (doc === undefined) continue;
    const text = readFileSync(d.sf.fileName, "utf8");
    const old = text.slice(doc.pos, doc.end);
    if (!old.includes("@beta")) continue;
    writeFileSync(
      d.sf.fileName,
      text.slice(0, doc.pos) +
        old.replace("@beta", "@public") +
        text.slice(doc.end),
    );
    changed.add(d.name);
  }
  return changed;
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv.includes("--promote")
) {
  const promoted = new Set(
    process.argv.slice(process.argv.indexOf("--promote") + 1),
  );
  const changed = promote(promoted);
  console.error(
    `release-tags: promoted ${changed.size}: ${[...changed].join(", ")}`,
  );
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const names = planNames(readFileSync(join(root, "docs/PLAN.md"), "utf8"));
  const perFile = edits(exportedDeclarations(), names);
  const write = process.argv.includes("--write");
  let count = 0;
  for (const [file, list] of perFile) {
    for (const e of list) {
      console.log(`${e.tag}\t${e.entry}\t${e.name}\t${relative(root, file)}`);
      count += 1;
    }
    if (!write) continue;
    let text = readFileSync(file, "utf8");
    for (const e of [...list].sort((a, b) => b.pos - a.pos))
      text = text.slice(0, e.pos) + e.text + text.slice(e.end);
    writeFileSync(file, text);
  }
  console.error(
    `release-tags: ${count} untagged export declarations${write ? " tagged" : ""}`,
  );
}
