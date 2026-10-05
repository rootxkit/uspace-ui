// A reader of Go string constants (WP-14: the hardened enumeration check,
// PLAN §10 job 7). scripts/check-enums.sh used awk over `const (` lines;
// this tokenizes the Go source instead, so a comment, a raw string, a
// constant on one line (`const X T = "v"`), several names in one spec
// (`A, B T = "a", "b"`), an implicit repetition or a `)` inside a string
// cannot shift or drop a value. It reads typed string constants and the
// fields of a struct; nothing else of Go.
//
//   node scripts/go-consts.mjs <checkout> <pkg>...   writes TSV to stdout:
//     <pkg>.<Type>\t<value>     one line per typed string constant
//     FieldError\t<Field>       the fields of core.FieldError
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The tokens of a Go source: identifiers, string literals (interpreted
 * and raw, unquoted), numbers, punctuation, and the newlines Go turns into
 * semicolons (spec "Semicolons": after an identifier, a literal, `)`,
 * `]` or `}`). Comments are dropped; a line comment ends in a newline.
 */
export function tokenize(src) {
  const out = [];
  let i = 0;
  const push = (t) => out.push(t);
  const lastEnds = () => {
    const t = out.at(-1);
    return (
      t !== undefined &&
      (t.kind === "ident" ||
        t.kind === "string" ||
        t.kind === "number" ||
        (t.kind === "punct" && [")", "]", "}"].includes(t.value)))
    );
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") {
      if (lastEnds()) push({ kind: "punct", value: ";" });
      i += 1;
    } else if (c === " " || c === "\t" || c === "\r") {
      i += 1;
    } else if (src.startsWith("//", i)) {
      const end = src.indexOf("\n", i);
      i = end < 0 ? src.length : end;
    } else if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) throw new Error("go-consts: unterminated comment");
      // A comment spanning a newline acts like a newline.
      if (src.slice(i, end).includes("\n") && lastEnds())
        push({ kind: "punct", value: ";" });
      i = end + 2;
    } else if (c === '"') {
      let v = "";
      i += 1;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\n") throw new Error("go-consts: newline in string");
        if (src[i] === "\\") {
          const e = src[i + 1];
          const simple = { n: "\n", t: "\t", r: "\r", '"': '"', "\\": "\\" };
          if (e !== undefined && e in simple) {
            v += simple[e];
            i += 2;
            continue;
          }
          throw new Error(`go-consts: escape \\${e} not supported`);
        }
        v += src[i];
        i += 1;
      }
      if (src[i] !== '"') throw new Error("go-consts: unterminated string");
      i += 1;
      push({ kind: "string", value: v });
    } else if (c === "`") {
      const end = src.indexOf("`", i + 1);
      if (end < 0) throw new Error("go-consts: unterminated raw string");
      push({ kind: "string", value: src.slice(i + 1, end).replace(/\r/g, "") });
      i = end + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i, i + 256));
      push({ kind: "ident", value: m[0] });
      i += m[0].length;
    } else if (/[0-9]/.test(c)) {
      const m = /^[0-9][0-9A-Za-z_.]*/.exec(src.slice(i, i + 256));
      push({ kind: "number", value: m[0] });
      i += m[0].length;
    } else if (c === "'") {
      // A rune literal: skipped as a number-like token.
      const end = src.indexOf("'", i + 1);
      push({ kind: "number", value: src.slice(i, end + 1) });
      i = end + 1;
    } else {
      push({ kind: "punct", value: c });
      i += 1;
    }
  }
  if (lastEnds()) push({ kind: "punct", value: ";" });
  return out;
}

/** One expression of a const spec: a string literal, or anything else. */
function readExpr(toks, at) {
  let depth = 0;
  const start = at;
  for (; at < toks.length; at++) {
    const t = toks[at];
    if (t.kind === "punct") {
      if (["(", "[", "{"].includes(t.value)) depth += 1;
      else if ([")", "]", "}"].includes(t.value)) {
        if (depth === 0) break;
        depth -= 1;
      } else if (depth === 0 && (t.value === "," || t.value === ";")) break;
    }
  }
  const span = toks.slice(start, at);
  const value =
    span.length === 1 && span[0].kind === "string" ? span[0].value : null;
  return { value, next: at };
}

/**
 * Every typed string constant of a Go source: `{ name, type, value }`,
 * from `const (...)` blocks and single `const` declarations at the top
 * level, with Go's implicit repetition of the previous spec. Untyped
 * constants and non-string values are left out.
 */
export function parseConsts(src) {
  const toks = tokenize(src);
  const out = [];
  let depth = 0;
  const spec = (at, prev) => {
    const names = [];
    while (toks[at]?.kind === "ident") {
      names.push(toks[at].value);
      at += 1;
      if (toks[at]?.value === ",") at += 1;
      else break;
    }
    let type = null;
    if (toks[at]?.kind === "ident") {
      type = toks[at].value;
      at += 1;
      if (toks[at]?.value === ".") {
        type = `${type}.${toks[at + 1]?.value ?? ""}`;
        at += 2;
      }
    }
    let values = null;
    if (toks[at]?.value === "=") {
      at += 1;
      values = [];
      for (;;) {
        const e = readExpr(toks, at);
        values.push(e.value);
        at = e.next;
        if (toks[at]?.value === ",") at += 1;
        else break;
      }
    }
    // Implicit repetition: no type and no values repeat the previous spec.
    if (type === null && values === null && prev !== null) {
      type = prev.type;
      values = prev.values;
    }
    names.forEach((name, k) => {
      const value = values?.[k] ?? null;
      if (type !== null && value !== null) out.push({ name, type, value });
    });
    return { at, prev: { type, values } };
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === "punct" && ["(", "[", "{"].includes(t.value)) depth += 1;
    if (t.kind === "punct" && [")", "]", "}"].includes(t.value)) depth -= 1;
    if (depth !== 0 || t.kind !== "ident" || t.value !== "const") continue;
    let at = i + 1;
    let prev = null;
    if (toks[at]?.value === "(") {
      at += 1;
      while (at < toks.length && toks[at].value !== ")") {
        if (toks[at].value === ";") {
          at += 1;
          continue;
        }
        const r = spec(at, prev);
        prev = r.prev;
        at = r.at;
        // Skip to the end of the spec.
        while (
          at < toks.length &&
          toks[at].value !== ";" &&
          toks[at].value !== ")"
        )
          at += 1;
      }
    } else {
      at = spec(at, null).at;
    }
    i = at;
  }
  return out;
}

/** The field names of `type <name> struct { ... }`, in order. */
export function structFields(src, name) {
  const toks = tokenize(src);
  for (let i = 0; i + 3 < toks.length; i++) {
    if (
      toks[i].value === "type" &&
      toks[i + 1].value === name &&
      toks[i + 2].value === "struct" &&
      toks[i + 3].value === "{"
    ) {
      const fields = [];
      let at = i + 4;
      let lineStart = true;
      for (; at < toks.length && toks[at].value !== "}"; at++) {
        const t = toks[at];
        if (t.value === ";") lineStart = true;
        else {
          if (lineStart && t.kind === "ident") fields.push(t.value);
          lineStart = false;
        }
      }
      return fields;
    }
  }
  return [];
}

/** The non-test .go files of a package directory, sorted. */
function goFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".go") && !f.endsWith("_test.go"))
    .sort()
    .map((f) => join(dir, f));
}

/** The TSV lines of the given packages of a checkout. */
export function extract(checkout, packages) {
  const lines = [];
  for (const pkg of packages) {
    for (const file of goFiles(join(checkout, pkg))) {
      const src = readFileSync(file, "utf8");
      for (const c of parseConsts(src)) {
        // A type from another package keeps its qualifier (core.Trust).
        const type = c.type.includes(".") ? c.type : `${pkg}.${c.type}`;
        lines.push(`${type}\t${c.value}`);
      }
      if (pkg === "core")
        for (const f of structFields(src, "FieldError"))
          lines.push(`FieldError\t${f}`);
    }
  }
  return lines;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [checkout, ...packages] = process.argv.slice(2);
  if (checkout === undefined || packages.length === 0) {
    console.error("usage: node scripts/go-consts.mjs <checkout> <pkg>...");
    process.exitCode = 2;
  } else {
    process.stdout.write(`${extract(checkout, packages).join("\n")}\n`);
  }
}
