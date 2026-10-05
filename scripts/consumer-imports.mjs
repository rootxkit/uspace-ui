// What the four consoles import from the kit, pinned, and the check that
// every one of those exports is `@public` (WP-14; PLAN §3, "The 1.0.0
// freeze"). A console that imports a `@beta` export builds on something
// the semver gate does not hold, so the next minor may break it.
//
//   node scripts/consumer-imports.mjs
//       check: every pinned import is an export of its entry point and
//       is tagged @public; fails otherwise
//   node scripts/consumer-imports.mjs --update <repo>...
//       rewrite scripts/consumer-imports.json from each repo's
//       origin/main `web/` (a local clone, fetched beforehand); review
//       the diff, then commit it
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { exportedDeclarations } from "./release-tags.mjs";

const root = process.cwd();
const PINNED = join(root, "scripts", "consumer-imports.json");
const PKG = "@rootxkit/uspace-ui";
const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/**
 * The named imports of the kit in one source file, as
 * `{ entry, name }` (entry without the leading `./`). `import * as`,
 * `export *` and a dynamic import of a kit entry are returned as
 * `{ entry, name: "*" }`: their names cannot be read statically, so the
 * check refuses them rather than passing over them. A member read off a
 * named import (`shapes.bbox`) is returned as `shapes.bbox` too, since a
 * namespace export (`form`'s `shapes`) is tagged member by member.
 */
export function kitImports(fileName, text) {
  const sf = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out = [];
  const locals = new Map();
  const entryOf = (spec) => {
    if (spec !== PKG && !spec.startsWith(`${PKG}/`)) return null;
    return spec === PKG ? "" : spec.slice(PKG.length + 1);
  };
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const entry = entryOf(node.moduleSpecifier.text);
      if (entry !== null) {
        if (ts.isImportDeclaration(node)) {
          const clause = node.importClause;
          if (clause?.name !== undefined) out.push({ entry, name: "default" });
          const nb = clause?.namedBindings;
          if (nb !== undefined && ts.isNamespaceImport(nb))
            out.push({ entry, name: "*" });
          if (nb !== undefined && ts.isNamedImports(nb))
            for (const el of nb.elements) {
              const name = (el.propertyName ?? el.name).text;
              out.push({ entry, name });
              locals.set(el.name.text, { entry, name });
            }
        } else if (
          node.exportClause !== undefined &&
          ts.isNamedExports(node.exportClause)
        ) {
          for (const el of node.exportClause.elements)
            out.push({ entry, name: (el.propertyName ?? el.name).text });
        } else {
          out.push({ entry, name: "*" });
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const entry = entryOf(node.arguments[0].text);
      if (entry !== null) out.push({ entry, name: "*" });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const members = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      locals.has(node.expression.text)
    ) {
      const { entry, name } = locals.get(node.expression.text);
      out.push({ entry, name: `${name}.${node.name.text}` });
    }
    ts.forEachChild(node, members);
  };
  members(sf);
  return out;
}

/** `{ entry: [name, ...] }`, sorted, for the files of one repo at `ref`. */
function repoImports(repo, ref, tags) {
  const git = (...args) =>
    execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  const files = git("ls-tree", "-r", "--name-only", ref, "--", "web")
    .split("\n")
    .filter((f) => SOURCE.test(f) && !f.includes("node_modules/"));
  const byEntry = {};
  for (const f of files) {
    const text = git("show", `${ref}:${f}`);
    if (!text.includes(PKG)) continue;
    for (const { entry, name } of kitImports(f, text)) {
      // Asset entry points (CSS, fonts) carry no declarations.
      if (/\.(css|woff2)$/.test(entry)) continue;
      // `x.y` is kept only when `x` is a namespace export; otherwise it
      // is a property of a value (`Form.displayName`), not an export.
      const dot = name.indexOf(".");
      if (
        dot >= 0 &&
        tags.get(`${entry}\t${name.slice(0, dot)}`) !== "namespace"
      )
        continue;
      (byEntry[entry] ??= new Set()).add(name);
    }
  }
  const sorted = {};
  for (const e of Object.keys(byEntry).sort())
    sorted[e] = [...byEntry[e]].sort();
  return sorted;
}

/**
 * The problems of a pinned list against the kit's exports: an import
 * that is not an export of its entry point, an export that is not
 * `@public`, and an import whose names cannot be checked (`*`). `tags`
 * maps `entry\tname` to the release tag of its declaration (`namespace`
 * for an `export * as`, whose members are checked as `ns.member`).
 */
export function problems(pinned, tags) {
  const out = [];
  for (const [consumer, { imports }] of Object.entries(pinned.consumers)) {
    for (const [entry, names] of Object.entries(imports)) {
      for (const name of names) {
        const where = `${consumer}: ${PKG}${entry === "" ? "" : `/${entry}`} ${name}`;
        if (name === "*") {
          out.push(`${where}: a namespace or dynamic import; name the exports`);
          continue;
        }
        const tag = tags.get(`${entry}\t${name}`);
        if (tag === undefined) out.push(`${where}: not an export`);
        else if (tag !== "public" && tag !== "namespace")
          out.push(`${where}: tagged @${tag}`);
      }
    }
  }
  return out;
}

const TAG = /@(public|beta|alpha|internal)\b/;

/** `entry\tname` -> the release tag of every exported declaration. */
export function exportTags() {
  const tags = new Map();
  for (const d of exportedDeclarations()) {
    const doc = (d.node.jsDoc ?? []).at(-1);
    const text =
      doc === undefined ? "" : d.sf.getFullText().slice(doc.pos, doc.end);
    const tag = text.match(TAG)?.[1] ?? "untagged";
    // A namespace member is reachable only as `ns.name`.
    if (d.ns !== undefined) tags.set(`${d.entry}\t${d.ns}`, "namespace");
    const key =
      d.ns === undefined
        ? `${d.entry}\t${d.name}`
        : `${d.entry}\t${d.ns}.${d.name}`;
    // A name with two declarations (a value and a type) is public when
    // either is; api-extractor fails a mismatch between them anyway.
    if (tags.get(key) !== "public") tags.set(key, tag);
  }
  return tags;
}

/** The problems of the committed list against the kit's source. */
export function check() {
  const pinned = JSON.parse(readFileSync(PINNED, "utf8"));
  return problems(pinned, exportTags());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--update");
  if (i >= 0) {
    const consumers = {};
    const tags = exportTags();
    for (const repo of process.argv.slice(i + 1)) {
      const commit = execFileSync(
        "git",
        ["-C", repo, "rev-parse", "origin/main"],
        { encoding: "utf8" },
      ).trim();
      consumers[basename(repo)] = {
        commit,
        imports: repoImports(repo, commit, tags),
      };
    }
    writeFileSync(
      PINNED,
      `${JSON.stringify({ ref: "origin/main", path: "web/", consumers }, null, 2)}\n`,
    );
    console.log(`consumer-imports: wrote ${Object.keys(consumers).join(", ")}`);
  } else {
    const pinned = JSON.parse(readFileSync(PINNED, "utf8"));
    const found = problems(pinned, exportTags());
    let count = 0;
    for (const c of Object.values(pinned.consumers))
      for (const names of Object.values(c.imports)) count += names.length;
    if (found.length > 0) {
      for (const p of found) console.error(`consumer-imports: ${p}`);
      console.error(
        `consumer-imports: ${found.length} of ${count} pinned imports are not @public exports`,
      );
      process.exit(1);
    }
    console.log(
      `consumer-imports: all ${count} pinned imports of ${Object.keys(pinned.consumers).join(", ")} are @public`,
    );
  }
}
