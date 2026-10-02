// Release notes (WP-13a): prints the CHANGELOG.md section of a version,
// without its heading and without its neighbours, for the GitHub release
// body. Exits 1 when the section is missing, so a tag without notes fails
// before anything is released.
//
//   node scripts/release-notes.mjs [version]   (default: package.json version)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The body of the `## <version>` section (a heading may carry a date after
 * the version: `## 0.1.0-rc.1 - 2026-10-02`), trimmed; null when absent.
 */
export function extractSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const m = /^## \[?([^\]\s]+)\]?(\s|$)/.exec(line);
    return m?.[1] === version;
  });
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^## /.test(line));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return body === "" ? null : body;
}

function main(argv) {
  const version =
    argv[0] ?? JSON.parse(readFileSync("package.json", "utf8")).version;
  const body = extractSection(readFileSync("CHANGELOG.md", "utf8"), version);
  if (body === null) {
    console.error(`CHANGELOG.md has no non-empty "## ${version}" section`);
    return 1;
  }
  console.log(body);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
