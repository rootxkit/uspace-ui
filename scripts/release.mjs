// Release rules (WP-13a, docs/RELEASING.md): the tag must equal the
// package version, a version with a pre-release suffix is released as a
// GitHub pre-release, and the asset name and URL a consumer pins are
// derived here and nowhere else.
//
//   node scripts/release.mjs check-tag <tag>   exit 1 unless <tag> is v<version>
//   node scripts/release.mjs prerelease        prints "true" or "false"
//   node scripts/release.mjs asset             prints the tarball file name
//   node scripts/release.mjs url               prints the release asset URL
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** True when `version` has a semver pre-release suffix (`0.1.0-rc.1`). */
export function isPrerelease(version) {
  return /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+$/.test(version);
}

/** Returns an error message, or null when `tag` is exactly `v<version>`. */
export function tagMismatch(tag, version) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    return `package.json version "${version}" is not a semver version`;
  }
  if (tag !== `v${version}`) {
    return `tag "${tag}" does not match package.json version "${version}" (expected "v${version}")`;
  }
  return null;
}

/** The file name `pnpm pack` writes: `@scope/name` -> `scope-name-<version>.tgz`. */
export function tarballName(name, version) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

/** `git+https://github.com/<owner>/<repo>.git` -> `<owner>/<repo>`. */
export function githubRepo(repositoryUrl) {
  const m = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/.exec(repositoryUrl);
  if (!m?.[1]) throw new Error(`not a GitHub repository URL: ${repositoryUrl}`);
  return m[1];
}

/** The GitHub release asset URL a consumer puts in its dependencies. */
export function assetUrl(pkg) {
  const repo = githubRepo(pkg.repository.url);
  return `https://github.com/${repo}/releases/download/v${pkg.version}/${tarballName(pkg.name, pkg.version)}`;
}

function main(argv) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const [command, arg] = argv;
  switch (command) {
    case "check-tag": {
      const problem = tagMismatch(arg ?? "", pkg.version);
      if (problem) {
        console.error(problem);
        return 1;
      }
      console.log(`tag ${arg} matches package.json version ${pkg.version}`);
      return 0;
    }
    case "prerelease":
      console.log(String(isPrerelease(pkg.version)));
      return 0;
    case "asset":
      console.log(tarballName(pkg.name, pkg.version));
      return 0;
    case "url":
      console.log(assetUrl(pkg));
      return 0;
    default:
      console.error(
        "usage: release.mjs check-tag <tag> | prerelease | asset | url",
      );
      return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
