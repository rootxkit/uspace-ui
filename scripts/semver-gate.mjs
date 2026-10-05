// The semver gate (docs/PLAN.md §12, WP-14): what a pull request changes
// in the published contract, and what it must carry for that.
//
//   1. docs/api/uspace-ui.api.md: a removed or changed line of a @public
//      declaration (an added line is additive) needs a new version
//      heading in CHANGELOG.md, the next major from v1 (the next minor or
//      higher before v1), and the PR label `breaking`. A @beta
//      declaration is outside the gate; documentation comments are too.
//   2. styles/tokens.css: a removed or changed `--us-severity-*`,
//      `--us-trust-*`, `--us-ident-*`, `--us-zone-*` or `--us-age-*`
//      value needs the label `legend-change` and a CHANGELOG line added
//      by the PR that cites a LESSONS id or a spec row.
//   3. src/symbology/: a removed or changed code line inside a
//      `*Token`, `*Shape` or `*Pattern` function needs the same.
//
// It prints every rule, whether it fired, why, and what it found (E-04),
// and exits 1 when a fired rule is not satisfied, 2 on a usage error.
//
//   node scripts/semver-gate.mjs --base <commit> [--labels '["breaking"]']
//
// The labels default to the PR_LABELS environment variable (a JSON array
// of names, as CI writes it from the event).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export const API_REPORT = "docs/api/uspace-ui.api.md";
export const TOKENS = "styles/tokens.css";
export const CHANGELOG = "CHANGELOG.md";
export const SYMBOLOGY_DIR = "src/symbology/";

// --- a line diff (Myers, with the common prefix and suffix trimmed) ------

/**
 * The lines of `a` that `b` removed and the lines of `b` it added, as
 * 0-based indices, by a shortest edit script.
 */
export function diffLines(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start])
    start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const A = a.slice(start, endA);
  const B = b.slice(start, endB);
  const n = A.length;
  const m = B.length;
  const removed = [];
  const added = [];
  if (n === 0 || m === 0) {
    for (let i = 0; i < n; i++) removed.push(start + i);
    for (let j = 0; j < m; j++) added.push(start + j);
    return { removed, added };
  }
  const max = n + m;
  const offset = max;
  let v = new Int32Array(2 * max + 2);
  const trace = [];
  let found = -1;
  for (let d = 0; d <= max && found < 0; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
          ? v[offset + k + 1]
          : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && A[x] === B[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  trace.push(v.slice());
  // Walk back through the trace.
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const pv = trace[d];
    const k = x - y;
    const prevK =
      k === -d || (k !== d && pv[offset + k - 1] < pv[offset + k + 1])
        ? k + 1
        : k - 1;
    const prevX = pv[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x -= 1;
      y -= 1;
    }
    if (x === prevX) added.push(start + prevY);
    else removed.push(start + prevX);
    x = prevX;
    y = prevY;
  }
  removed.sort((p, q) => p - q);
  added.sort((p, q) => p - q);
  return { removed, added };
}

const lines = (text) => text.replace(/\r\n/g, "\n").split("\n");

// --- rule 1: the API report ----------------------------------------------

const TAG = /^\/\/ @(public|beta|alpha|internal)\b/;
const DECL =
  /^(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(?:function|interface|class|const|let|var|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/;

/**
 * Each line of an API report with what it belongs to: `ignore` (the
 * header, imports, comments, the warnings at the end), a declaration's
 * line with its release tag, or a namespace member with its name.
 */
export function classifyReport(text) {
  const ls = lines(text);
  const out = [];
  const tags = new Map();
  let tag = null;
  let decl = null;
  let ns = false;
  let tail = false;
  for (const line of ls) {
    if (line.startsWith("// Warnings were encountered")) tail = true;
    if (tail || line === "" || line.startsWith("```")) {
      if (line === "") decl = null;
      out.push({ kind: "ignore" });
      continue;
    }
    if (ns) {
      if (line === "}") {
        ns = false;
        out.push({ kind: "ignore" });
        continue;
      }
      const m = /^\s+([A-Za-z_$][\w$]*)(?:\s+as\s+[\w$]+)?,?\s*$/.exec(line);
      out.push(
        m === null ? { kind: "ignore" } : { kind: "member", name: m[1] },
      );
      continue;
    }
    const t = TAG.exec(line);
    if (t !== null) {
      tag = t[1];
      out.push({ kind: "tag", tag });
      continue;
    }
    const nsm = /^declare namespace ([\w$]+) \{$/.exec(line);
    if (nsm !== null) {
      ns = true;
      out.push({ kind: "namespace", name: nsm[1] });
      continue;
    }
    if (decl === null) {
      const d = DECL.exec(line);
      if (d !== null && tag !== null) {
        decl = { name: d[1], tag };
        tags.set(d[1], tag);
        tag = null;
      }
    }
    if (/^\s*\/\//.test(line) || decl === null) {
      out.push({ kind: "ignore" });
      continue;
    }
    out.push({ kind: "decl", name: decl.name, tag: decl.tag });
  }
  // A tag line belongs to the declaration after it.
  for (let i = out.length - 1, next = null; i >= 0; i--) {
    const c = out[i];
    if (c.kind === "decl") next = c;
    else if (c.kind === "tag")
      out[i] = next === null ? { kind: "ignore" } : { ...next };
    else if (c.kind !== "ignore") next = null;
  }
  return { lines: ls, classes: out, tags };
}

/** The public lines of the base report that the head removed or changed. */
export function apiReportChanges(baseText, headText) {
  const base = classifyReport(baseText);
  // A trailing comma is not a change: removing the last member of a
  // namespace's export list takes the comma off the member before it.
  const bare = (l) => l.replace(/,\s*$/, "");
  const { removed } = diffLines(
    base.lines.map(bare),
    lines(headText).map(bare),
  );
  const breaking = [];
  const beta = [];
  for (const i of removed) {
    const c = base.classes[i];
    const text = base.lines[i];
    if (c.kind === "ignore") continue;
    const tag =
      c.kind === "member"
        ? (base.tags.get(c.name) ?? "public")
        : c.kind === "namespace"
          ? "public"
          : c.tag;
    const entry = { line: i + 1, text, name: c.name };
    if (tag === "public") breaking.push(entry);
    else beta.push(entry);
  }
  return { breaking, beta };
}

// --- rule 2: the semantic tokens ------------------------------------------

export const LEGEND_TOKEN =
  /^\s*--us-(?:severity|trust|ident|zone|age)-[\w-]+\s*:/;

/** The legend token declarations of the base the head removed or changed. */
export function tokenChanges(baseText, headText) {
  const base = lines(baseText);
  const { removed } = diffLines(base, lines(headText));
  return removed
    .filter((i) => LEGEND_TOKEN.test(base[i]))
    .map((i) => ({ line: i + 1, text: base[i].trim() }));
}

// --- rule 3: the symbology mappings ---------------------------------------

export const LEGEND_FUNCTION = /(?:Token|Shape|Pattern)$/;

/** 1-based line ranges of every `*Token`/`*Shape`/`*Pattern` function. */
export function legendFunctionRanges(source, fileName = "x.ts") {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const ranges = [];
  const add = (name, node) => {
    if (!LEGEND_FUNCTION.test(name)) return;
    const from = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    const to = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    ranges.push({ name, from, to });
  };
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name !== undefined)
      add(node.name.text, node);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    )
      add(node.name.text, node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return ranges;
}

const isCommentOrBlank = (line) => {
  const t = line.trim();
  return (
    t === "" || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")
  );
};

/**
 * The code lines inside a legend function of the base that the head
 * removed or changed. A comment or a blank line is not a change of what
 * the legend means; an added line alone (a new enumeration value given
 * its look) is additive.
 */
export function symbologyChanges(path, baseText, headText) {
  const base = lines(baseText);
  const ranges = legendFunctionRanges(baseText, path);
  const { removed } = diffLines(base, lines(headText));
  const out = [];
  for (const i of removed) {
    if (isCommentOrBlank(base[i])) continue;
    const r = ranges.find((g) => i + 1 >= g.from && i + 1 <= g.to);
    if (r !== undefined)
      out.push({ path, fn: r.name, line: i + 1, text: base[i].trim() });
  }
  return out;
}

// --- the CHANGELOG ----------------------------------------------------------

const HEADING = /^##\s+\[?v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?\]?/;

/** The version headings of a CHANGELOG, as "x.y.z" strings in order. */
export function versionHeadings(text) {
  const out = [];
  for (const line of lines(text)) {
    const m = HEADING.exec(line);
    if (m !== null) out.push({ major: +m[1], minor: +m[2], patch: +m[3] });
  }
  return out;
}

const key = (v) => `${v.major}.${v.minor}.${v.patch}`;

/**
 * What a breaking change needs: a version heading the base did not have,
 * the next major from v1, the next minor (or a major) before it.
 */
export function breakingHeading(baseVersion, baseChangelog, headChangelog) {
  const [major, minor] = baseVersion.split(".").map(Number);
  const had = new Set(versionHeadings(baseChangelog).map(key));
  const fresh = versionHeadings(headChangelog).filter((v) => !had.has(key(v)));
  const enough = fresh.find((v) =>
    major >= 1 ? v.major > major : v.major > major || v.minor > minor,
  );
  const need = major >= 1 ? `${major + 1}.0.0` : `0.${minor + 1}.0`;
  return {
    need,
    found: enough === undefined ? null : key(enough),
    fresh: fresh.map(key),
  };
}

export const CITATION =
  /\b(?:INV-\d{2}|[A-Z]{1,2}\d?-\d{2})\b|\bspec\s+`?0\d|\b0\d\s?§\s?\d/;

/** CHANGELOG lines the PR added that cite a LESSONS id or a spec row. */
export function citations(baseChangelog, headChangelog) {
  const head = lines(headChangelog);
  const { added } = diffLines(lines(baseChangelog), head);
  return added.map((i) => head[i]).filter((l) => CITATION.test(l));
}

// --- the verdict ------------------------------------------------------------

/**
 * Applies the three rules. `input`: { baseVersion, base: { report,
 * tokens, changelog }, head: { report, tokens, changelog }, symbology:
 * [{ path, base, head }], labels: string[] }. Returns { ok, report:
 * string[] } with one block per rule.
 */
export function evaluate(input) {
  const labels = new Set(input.labels);
  const out = [];
  let ok = true;
  const show = (items, fmt) =>
    items
      .slice(0, 20)
      .map((e) => `    ${fmt(e)}`)
      .concat(
        items.length > 20 ? [`    ... and ${items.length - 20} more`] : [],
      );

  const api = apiReportChanges(input.base.report, input.head.report);
  if (api.breaking.length === 0) {
    out.push(
      `rule 1 (API report, PLAN §12): not fired: no @public line removed or changed in ${API_REPORT}` +
        (api.beta.length > 0
          ? ` (${api.beta.length} @beta line(s) changed, outside the gate)`
          : ""),
    );
  } else {
    const h = breakingHeading(
      input.baseVersion,
      input.base.changelog,
      input.head.changelog,
    );
    const hasLabel = labels.has("breaking");
    const pass = hasLabel && h.found !== null;
    ok &&= pass;
    out.push(
      `rule 1 (API report, PLAN §12): FIRED: ${api.breaking.length} @public line(s) removed or changed in ${API_REPORT}:`,
      ...show(
        api.breaking,
        (e) => `line ${e.line} (${e.name ?? "?"}): ${e.text.trim()}`,
      ),
      `  needs: the label "breaking": ${hasLabel ? "present" : "MISSING"}`,
      `  needs: a new CHANGELOG heading of ${h.need} or later (from ${input.baseVersion}): ${h.found === null ? `MISSING (new headings: ${h.fresh.join(", ") || "none"})` : `found ${h.found}`}`,
      `  ${pass ? "satisfied" : "NOT satisfied"}`,
    );
  }

  const legend = [
    ...tokenChanges(input.base.tokens, input.head.tokens).map(
      (e) => `${TOKENS}:${e.line}: ${e.text}`,
    ),
    ...input.symbology.flatMap((f) =>
      symbologyChanges(f.path, f.base, f.head).map(
        (e) => `${e.path}:${e.line} in ${e.fn}: ${e.text}`,
      ),
    ),
  ];
  if (legend.length === 0) {
    out.push(
      `rule 2 (legend, PLAN §12): not fired: no semantic token value in ${TOKENS} and no *Token/*Shape/*Pattern code in ${SYMBOLOGY_DIR} removed or changed`,
    );
  } else {
    const hasLabel = labels.has("legend-change");
    const cites = citations(input.base.changelog, input.head.changelog);
    const pass = hasLabel && cites.length > 0;
    ok &&= pass;
    out.push(
      `rule 2 (legend, PLAN §12): FIRED: ${legend.length} legend line(s) removed or changed:`,
      ...show(legend, (e) => e),
      `  needs: the label "legend-change": ${hasLabel ? "present" : "MISSING"}`,
      `  needs: a CHANGELOG line added by this PR citing a LESSONS id or a spec row: ${cites.length === 0 ? "MISSING" : `found: ${cites[0].trim()}`}`,
      `  ${pass ? "satisfied" : "NOT satisfied"}`,
    );
  }
  out.push(ok ? "semver gate: pass" : "semver gate: FAIL");
  return { ok, report: out };
}

// --- the command line --------------------------------------------------------

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function atBase(base, path) {
  try {
    return git(["show", `${base}:${path}`]);
  } catch {
    // The file does not exist at the base (a new file).
    return "";
  }
}

function main(argv) {
  const at = argv.indexOf("--base");
  const base = at >= 0 ? argv[at + 1] : undefined;
  if (base === undefined || base === "") {
    console.error("semver-gate: --base <commit> is required");
    return 2;
  }
  // Fails loudly when the base is not in the clone (a shallow checkout).
  git(["rev-parse", "--verify", `${base}^{commit}`]);
  const li = argv.indexOf("--labels");
  const rawLabels = li >= 0 ? argv[li + 1] : (process.env.PR_LABELS ?? "[]");
  let labels;
  try {
    labels = JSON.parse(rawLabels ?? "[]");
    if (!Array.isArray(labels) || !labels.every((l) => typeof l === "string"))
      throw new Error("not an array of strings");
  } catch (e) {
    console.error(
      `semver-gate: labels must be a JSON array of names (${e.message})`,
    );
    return 2;
  }
  const changed = git(["diff", "--name-only", base, "--", SYMBOLOGY_DIR])
    .split("\n")
    .filter(
      (p) =>
        p.endsWith(".ts") &&
        !p.endsWith(".test.ts") &&
        !p.includes("__snapshots__"),
    );
  const read = (p) => readFileSync(p, "utf8");
  const safeRead = (p) => {
    try {
      return read(p);
    } catch {
      return "";
    }
  };
  const result = evaluate({
    baseVersion: JSON.parse(atBase(base, "package.json")).version,
    base: {
      report: atBase(base, API_REPORT),
      tokens: atBase(base, TOKENS),
      changelog: atBase(base, CHANGELOG),
    },
    head: {
      report: read(API_REPORT),
      tokens: read(TOKENS),
      changelog: read(CHANGELOG),
    },
    symbology: changed.map((p) => ({
      path: p,
      base: atBase(base, p),
      head: safeRead(p),
    })),
    labels,
  });
  console.log(`semver gate against ${base}, labels: ${JSON.stringify(labels)}`);
  for (const l of result.report) console.log(l);
  return result.ok ? 0 : 1;
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  process.exitCode = main(process.argv.slice(2));
}
