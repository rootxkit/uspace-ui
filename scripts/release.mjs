// Release rules (WP-13a, docs/RELEASING.md): the tag must equal the
// package version, a version with a pre-release suffix is released as a
// GitHub pre-release, and the asset name and URL a consumer pins are
// derived here and nowhere else.
//
//   node scripts/release.mjs check-tag <tag>   exit 1 unless <tag> is v<version>
//   node scripts/release.mjs prerelease        prints "true" or "false"
//   node scripts/release.mjs asset             prints the tarball file name
//   node scripts/release.mjs url               prints the release asset URL
//   node scripts/release.mjs check-latest <tag> exit 1 unless the release of
//                                              <tag> carries the latest mark
//                                              its version calls for
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

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

/**
 * How long the read-back waits for the latest mark: GitHub's release
 * index can answer a moment behind the release it just created. Bounded,
 * so a mark that never comes fails the job instead of hanging it: 10
 * reads 6 s apart is under a minute of the release job's 10.
 */
export const LATEST_READ_ATTEMPTS = 10;
export const LATEST_READ_DELAY_MS = 6000;

/**
 * The one release of a tag, with its latest mark. `gh release view
 * --json` has no `isLatest` field (gh 2.102.0 answers `Unknown JSON
 * field: "isLatest"`), and `releases/latest` is 404 for an rc before any
 * plain release exists; GraphQL's `Release.isLatest` is read per tag.
 */
export const RELEASE_QUERY =
  "query($owner: String!, $name: String!, $tag: String!) { repository(owner: $owner, name: $name) { release(tagName: $tag) { tagName isLatest isPrerelease } } }";

/** The `gh` arguments that ask for the release of `tag` in `repo` (`owner/name`). */
export function releaseQueryArgs(repo, tag) {
  const [owner, name] = repo.split("/");
  return [
    "api",
    "graphql",
    "-f",
    `owner=${owner}`,
    "-f",
    `name=${name}`,
    "-f",
    `tag=${tag}`,
    "-f",
    `query=${RELEASE_QUERY}`,
  ];
}

/** The release in a GraphQL answer; null when the tag has no release (yet). */
export function parseReleaseAnswer(text) {
  const repo = JSON.parse(text)?.data?.repository;
  if (repo === null || typeof repo !== "object") {
    throw new Error("the answer has no repository");
  }
  const r = repo.release;
  if (r === null) return null;
  if (
    typeof r !== "object" ||
    typeof r.tagName !== "string" ||
    typeof r.isLatest !== "boolean" ||
    typeof r.isPrerelease !== "boolean"
  ) {
    throw new Error(`the answer is not a release: ${JSON.stringify(r)}`);
  }
  return {
    tagName: r.tagName,
    isLatest: r.isLatest,
    isPrerelease: r.isPrerelease,
  };
}

/**
 * Reads the release of `tag` back until its latest mark is the one the
 * version calls for: a plain version must be the latest release, a
 * pre-release never. A release that is not visible yet, not marked yet,
 * or a read that fails is read again, `delayMs` apart, at most
 * `attempts` times; then the check fails, naming what it last saw. It
 * passes only on a read that showed the expected mark, so it cannot pass
 * without having seen the release. A pre-release marked latest fails at
 * once: waiting does not unmark it.
 */
export async function checkLatest(opts) {
  const { tag, prerelease, attempts, delayMs, query, sleep, log } = opts;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error(
      `attempts must be a whole number of at least 1, got ${attempts}`,
    );
  }
  let last = "nothing read";
  for (let n = 1; n <= attempts; n++) {
    const at = `read ${n} of ${attempts}`;
    let seen;
    try {
      seen = await query(tag);
    } catch (err) {
      seen = undefined;
      last = `the query failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (seen === undefined) {
      log(`${at}: ${last}`);
    } else if (seen === null) {
      last = "not visible";
      log(`${at}: ${tag} is not visible yet`);
    } else if (seen.tagName !== tag) {
      last = `the answer was for ${seen.tagName}`;
      log(`${at}: ${last}`);
    } else if (seen.isPrerelease !== prerelease) {
      return {
        ok: false,
        attempts: n,
        message: `${tag} has isPrerelease=${seen.isPrerelease}, want ${prerelease}`,
      };
    } else if (prerelease) {
      if (seen.isLatest) {
        return {
          ok: false,
          attempts: n,
          message: `${tag} is a pre-release but is marked the latest release`,
        };
      }
      log(`${at}: ${tag} is a pre-release and not the latest`);
      return {
        ok: true,
        attempts: n,
        message: `${tag} is a pre-release and not the latest (${at})`,
      };
    } else if (seen.isLatest) {
      log(`${at}: ${tag} is the latest release`);
      return {
        ok: true,
        attempts: n,
        message: `${tag} is the latest release (${at})`,
      };
    } else {
      last = "not marked latest";
      log(`${at}: ${tag} is not marked latest yet`);
    }
    if (n < attempts) await sleep(delayMs);
  }
  return {
    ok: false,
    attempts,
    message: prerelease
      ? `${tag} could not be read back as a pre-release after ${attempts} reads (last: ${last})`
      : `${tag} is not the latest release after ${attempts} reads (last: ${last})`,
  };
}

async function ghReleaseQuery(repo, tag) {
  const { stdout } = await promisify(execFile)(
    "gh",
    releaseQueryArgs(repo, tag),
  );
  return parseReleaseAnswer(stdout);
}

async function main(argv) {
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
    case "check-latest": {
      if (arg === undefined || arg === "") {
        console.error("usage: release.mjs check-latest <tag>");
        return 2;
      }
      const repo = githubRepo(pkg.repository.url);
      const result = await checkLatest({
        tag: arg,
        prerelease: isPrerelease(pkg.version),
        attempts: LATEST_READ_ATTEMPTS,
        delayMs: LATEST_READ_DELAY_MS,
        query: (tag) => ghReleaseQuery(repo, tag),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        log: (line) => console.log(line),
      });
      if (!result.ok) {
        console.error(result.message);
        return 1;
      }
      console.log(result.message);
      return 0;
    }
    default:
      console.error(
        "usage: release.mjs check-tag <tag> | prerelease | asset | url | check-latest <tag>",
      );
      return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
