// Size budget check (PLAN §8 "Initial JS"): gzipped bytes of the built
// JavaScript under each budget's paths, against `sizeBudgets` in
// package.json. A budget whose paths are all empty or missing is reported
// as such, not as a pass at zero.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

/** Every .js file under `dir`, recursively; [] when `dir` does not exist. */
export function jsFiles(dir) {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return dir.endsWith(".js") ? [dir] : [];
  return readdirSync(dir).flatMap((name) => jsFiles(join(dir, name)));
}

/**
 * Measures each budget under `root`. Returns one row per budget:
 * { name, files, gzipBytes, maxGzipBytes, status } with status
 * "ok" | "over" | "empty".
 */
export function measure(budgets, root) {
  return Object.entries(budgets).map(([name, budget]) => {
    const files = budget.paths.flatMap((p) => jsFiles(join(root, p)));
    const gzipBytes = files.reduce(
      (sum, f) => sum + gzipSync(readFileSync(f), { level: 9 }).length,
      0,
    );
    const status =
      files.length === 0
        ? "empty"
        : gzipBytes > budget.maxGzipBytes
          ? "over"
          : "ok";
    return {
      name,
      files: files.length,
      gzipBytes,
      maxGzipBytes: budget.maxGzipBytes,
      status,
    };
  });
}

/** Formats the rows as a table; returns [text, failed]. */
export function report(rows) {
  const lines = rows.map(
    (r) =>
      `${r.status.padEnd(5)} ${r.name.padEnd(30)} ${String(r.gzipBytes).padStart(7)} / ${String(r.maxGzipBytes).padStart(7)} B gz  (${r.files} files)`,
  );
  return [lines.join("\n"), rows.some((r) => r.status === "over")];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  if (!existsSync(join(root, "dist"))) {
    console.error("size-check: no dist/; run pnpm build first");
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const rows = measure(pkg.sizeBudgets ?? {}, root);
  const [text, failed] = report(rows);
  console.log(text);
  if (rows.some((r) => r.status === "empty")) {
    console.log(
      "size-check: 'empty' = no built JavaScript under that budget's paths",
    );
  }
  if (failed) {
    console.error("size-check: over budget");
    process.exit(1);
  }
}
