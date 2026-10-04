// The example app (WP-13) resolves the kit two ways, and both are pinned
// here: in this repository's workspace it is linked to the current source
// (so CI builds the example against what is being changed), and in its
// Docker build it is the GitHub Release asset its package.json names,
// with the integrity in docker/pnpm-lock.yaml (so the image is what a
// system's image is). CI's `example` job builds, lints and smokes it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string =>
  readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

interface Manifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  packageManager: string;
}
const example = JSON.parse(read("examples/next-app/package.json")) as Manifest;
const kit = JSON.parse(read("package.json")) as { packageManager: string };
const KIT = "@rootxkit/uspace-ui";

/** The `importers.<name>` block of a pnpm lockfile, as text. */
function importer(lock: string, name: string): string {
  const start = lock.indexOf(`\n  ${name}:\n`);
  if (start === -1) return "";
  const rest = lock.slice(start + name.length + 5);
  const end = rest.search(/\n {2}\S|\n\S/);
  return end === -1 ? rest : rest.slice(0, end);
}

/** `name` -> `specifier` of every dependency in an importer block. */
function specifiers(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(
    /\n {6}'?([^':\n]+)'?:\n {8}specifier: (\S+)/g,
  )) {
    out[m[1] ?? ""] = m[2] ?? "";
  }
  return out;
}

describe("examples/next-app pins the kit as a system's web/ does", () => {
  it("by the exact asset URL of a release of this repository", () => {
    const pin = example.dependencies[KIT] ?? "";
    const m =
      /^https:\/\/github\.com\/rootxkit\/uspace-ui\/releases\/download\/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\/rootxkit-uspace-ui-(.+)\.tgz$/.exec(
        pin,
      );
    expect(m, pin).not.toBeNull();
    expect(m?.[2]).toBe(m?.[1]);
  });

  it("with pnpm pinned the way the kit pins it", () => {
    expect(example.packageManager).toBe(kit.packageManager);
  });
});

describe("in this repository: linked to the current source", () => {
  it("is a workspace package with the kit overridden to the root", () => {
    const ws = read("pnpm-workspace.yaml");
    expect(ws).toMatch(/^packages:\n {2}- examples\/next-app$/m);
    expect(ws).toMatch(/^overrides:\n {2}"@rootxkit\/uspace-ui": "link:\."$/m);
  });

  it("resolves to link:../.. in the root lockfile, never a download", () => {
    const lock = read("pnpm-lock.yaml");
    const block = importer(lock, "examples/next-app");
    expect(block).toContain(
      `'${KIT}':\n        specifier: link:../..\n        version: link:../..`,
    );
    expect(lock).not.toContain("releases/download/");
  });
});

describe("in the Docker build: the release asset, integrity pinned", () => {
  const lock = read("examples/next-app/docker/pnpm-lock.yaml");
  const pin = example.dependencies[KIT] ?? "";

  it("records the same specifiers as package.json, so --frozen-lockfile accepts it", () => {
    const block = importer(lock, ".");
    expect(specifiers(block)).toEqual({
      ...example.dependencies,
      ...example.devDependencies,
    });
  });

  it("records the asset's sha512 integrity next to its URL", () => {
    const entry = lock.indexOf(`\n  '${KIT}@${pin}':\n`);
    expect(entry).toBeGreaterThan(0);
    expect(lock.slice(entry, entry + 400)).toMatch(
      new RegExp(
        `resolution: \\{integrity: sha512-[A-Za-z0-9+/]{86}==, tarball: ${pin.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\}`,
      ),
    );
  });

  it("is what the Dockerfile installs from, frozen, with no npm and no kit build", () => {
    const dockerfile = read("examples/next-app/Dockerfile");
    expect(dockerfile).toContain(
      "COPY docker/pnpm-lock.yaml docker/pnpm-workspace.yaml ./",
    );
    expect(dockerfile).toMatch(/^RUN pnpm install --frozen-lockfile$/m);
    const instructions = dockerfile.replace(/^\s*#.*$/gm, "");
    expect(instructions).not.toMatch(/\bnpm (ci|install)\b|\bprepare\b/);
    // The pattern does find one (presence, E-01).
    expect("RUN npm ci").toMatch(/\bnpm (ci|install)\b|\bprepare\b/);
    expect(dockerfile).toMatch(/^FROM node:22-alpine@sha256:[0-9a-f]{64} /m);
  });
});

describe("the example's catalogues", () => {
  const en = JSON.parse(read("examples/next-app/src/i18n/en.json")) as Record<
    string,
    string
  >;
  const ka = JSON.parse(read("examples/next-app/src/i18n/ka.json")) as Record<
    string,
    string
  >;

  it("carry the same keys in ka and en, each non-empty", () => {
    expect(Object.keys(ka).sort()).toEqual(Object.keys(en).sort());
    for (const v of [...Object.values(en), ...Object.values(ka)]) {
      expect(v.trim()).not.toBe("");
    }
  });

  it("put Georgian in ka where en has English", () => {
    expect(ka["example.map.heading"]).toMatch(/[ა-ჿ]/);
    expect(en["example.map.heading"]).toBe("Zones");
  });
});

describe("CI's example job", () => {
  const ci = read(".github/workflows/ci.yml");
  const job = ci.slice(
    ci.indexOf("\n  example:\n"),
    ci.indexOf("\n  gitleaks:\n"),
  );

  it("builds the kit, then checks, lints, builds, type-checks and smokes the example", () => {
    const steps = [
      "pnpm build",
      "pnpm --dir examples/next-app check:api",
      "pnpm --dir examples/next-app lint",
      "pnpm --dir examples/next-app build",
      "pnpm --dir examples/next-app typecheck",
      "pnpm --dir examples/next-app smoke",
    ];
    let at = 0;
    for (const s of steps) {
      const i = job.indexOf(`run: ${s}\n`, at);
      expect(i, s).toBeGreaterThan(at);
      at = i;
    }
    expect(job).toContain("EXAMPLE_BASEMAP_ORIGIN: http://127.0.0.1:4599");
    expect(job).not.toContain("SKIPPED");
  });
});
