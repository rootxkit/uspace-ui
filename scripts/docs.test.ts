// The documents that ship in the tarball (`files`: README.md and
// CHANGELOG.md) and the plan describe the same release: the version in
// package.json, its asset URL, and the entry points its CHANGELOG section
// says ship. A README that still pins the last rc, or says an entry point
// that ships "follows" in a later version, sends a consumer to the wrong
// asset or away from a component that is there.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { extractSection } from "./release-notes.mjs";
import { assetUrl } from "./release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string =>
  readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

const pkg = JSON.parse(read("package.json")) as {
  name: string;
  version: string;
  repository: { url: string };
  exports: Record<string, unknown>;
};

/** The JS entry points of `exports`: `./map` -> `map`, `./auth/server` -> `auth/server`. */
const ENTRY_POINTS = Object.keys(pkg.exports)
  .map((k) => k.replace(/^\.\//, ""))
  .filter((k) => !/[.*]/.test(k));

/** The text under a `## ` / `### ` heading, up to the next heading of that level or higher. */
function sectionOf(text: string, heading: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l === heading);
  if (start === -1) return "";
  const level = /^#+/.exec(heading)?.[0].length ?? 2;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => {
    const m = /^(#+) /.exec(l);
    return m !== null && (m[1]?.length ?? 0) <= level;
  });
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/** Every entry point named in backticks in `text`. */
function entryPointsIn(text: string): string[] {
  const named = new Set(
    [...text.matchAll(/`([a-z0-9/]+)`/g)].map((m) => m[1] ?? ""),
  );
  return ENTRY_POINTS.filter((e) => named.has(e));
}

const changelogSection = extractSection(read("CHANGELOG.md"), pkg.version);
const shipped = entryPointsIn(
  sectionOf(changelogSection ?? "", "### Entry points that ship"),
);

describe("CHANGELOG.md, the reference", () => {
  it("has a section for the version that lists the entry points it ships", () => {
    expect(changelogSection).not.toBeNull();
    // Every JS entry point of `exports` ships in 0.1.0.
    expect(shipped).toEqual(ENTRY_POINTS);
  });
});

describe("README.md describes the version in package.json", () => {
  const readme = read("README.md");

  it("pins the release asset of this version, and no other", () => {
    const urls = [
      ...readme.matchAll(
        /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/releases\/download\/[^\s"`)]+/g,
      ),
    ].map((m) => m[0]);
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls)).toEqual(new Set([assetUrl(pkg)]));
  });

  it("names the version, not an rc, where it says what it describes", () => {
    const status = sectionOf(readme, "## Status");
    expect(status).toContain(`\`${pkg.version}\``);
    expect(readme).toMatch(
      new RegExp(
        `^## Consuming \\(\`${pkg.version.replace(/\./g, "\\.")}\`\\)$`,
        "m",
      ),
    );
    expect(status).not.toMatch(/^Planning\./m);
  });

  it("says that every entry point the CHANGELOG ships is in it", () => {
    const status = sectionOf(readme, "## Status");
    expect(entryPointsIn(status)).toEqual(shipped);
    // And does not put one of them in a later version.
    for (const sentence of status.replace(/\n/g, " ").split(/(?<=\.)\s+/)) {
      if (/\bfollows?\b|\bnot (yet )?included\b|\blater\b/i.test(sentence)) {
        expect(entryPointsIn(sentence), sentence).toEqual([]);
      }
    }
  });
});

describe("docs/PLAN.md §12 says what 0.1.0 shipped", () => {
  const plan = read("docs/PLAN.md");
  const versioning = sectionOf(plan, "## 12. Versioning and release");
  /** The top-level bullets of §12, by the version they open with. */
  const bullets = new Map(
    versioning
      .split(/\n(?=- )/)
      .map((b) => [/^- `(v[^`]+)`/.exec(b)?.[1] ?? "", b] as const)
      .filter(([v]) => v !== ""),
  );
  const shipParagraph = sectionOf(
    changelogSection ?? "",
    "### Entry points that ship",
  );
  /** Every backticked name the CHANGELOG ships: entry points and components. */
  const shippedNames = new Set(
    [...shipParagraph.matchAll(/`([A-Za-z0-9/]+)`/g)].map((m) => m[1] ?? ""),
  );

  it("has a bullet for v0.1.0 that names every entry point it shipped", () => {
    const b = bullets.get(`v${pkg.version}`) ?? "";
    expect(b).not.toBe("");
    expect(entryPointsIn(b)).toEqual(shipped);
  });

  it("puts nothing that shipped in 0.1.0 in a later version's bullet", () => {
    for (const [version, b] of bullets) {
      if (!/^v0\.[2-9]\./.test(version)) continue;
      const named = [...b.matchAll(/`([A-Za-z0-9/]+)`/g)]
        .map((m) => m[1] ?? "")
        .filter((n) => shippedNames.has(n));
      expect(named, `${version}: ${b}`).toEqual([]);
    }
  });
});

describe("docs/CONSUMING.md, the step list for a web/", () => {
  const consuming = (() => {
    try {
      return read("docs/CONSUMING.md");
    } catch {
      return "";
    }
  })();

  it("exists and installs this version from its GitHub Release asset", () => {
    expect(consuming).not.toBe("");
    const urls = [
      ...consuming.matchAll(
        /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/releases\/download\/[^\s"`)]+/g,
      ),
    ].map((m) => m[0]);
    expect(new Set(urls)).toEqual(new Set([assetUrl(pkg)]));
    expect(consuming).toContain("gh attestation verify");
    expect(consuming).not.toMatch(/npmjs\.com|"next" dist-tag|npm ci/);
  });

  it.each([
    ["pnpm pinned", /"packageManager": "pnpm@/],
    ["frozen lockfile", /pnpm install --frozen-lockfile/],
    ["the CSS", /@source "\.\.\/node_modules\/@rootxkit\/uspace-ui\/dist"/],
    ["the fonts", /fontClassName/],
    ["the lint config", /@rootxkit\/uspace-ui\/eslint/],
    [
      "the BFF routes",
      /\/_bff\/login[\s\S]*\/_bff\/logout[\s\S]*\/_bff\/api\/\*/,
    ],
    ["the cookies", /uspace_session[\s\S]*uspace_csrf[\s\S]*X-CSRF-Token/],
    ["the WebSocket", /same-origin[\s\S]*no ticket/i],
    ["generated types", /uspace-ui-gen-api/],
    ["the applicability adapter", /cis_applicability/],
    ["the basemap", /\/basemap\//],
    ["the CSP", /connect-src 'self'[\s\S]*worker-src blob:/],
    [
      "the Docker recipe",
      /output: "standalone"[\s\S]*RUN pnpm install --frozen-lockfile/,
    ],
    ["the upgrade policy", /## Upgrading/],
    ["the minimum versions", /## Minimum version per consumer/],
    ["the example", /examples\/next-app/],
  ])("covers %s", (_name, pattern) => {
    expect(consuming).toMatch(pattern);
  });

  it("is linked from README.md and no longer listed as missing", () => {
    expect(read("README.md")).toContain("](docs/CONSUMING.md)");
    expect(changelogSection ?? "").not.toMatch(/no `docs\/CONSUMING\.md`/);
  });
});
