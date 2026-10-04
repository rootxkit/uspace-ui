import { describe, expect, it } from "vitest";

import {
  RELEASE_QUERY,
  assetUrl,
  checkLatest,
  githubRepo,
  isPrerelease,
  parseReleaseAnswer,
  releaseQueryArgs,
  tagMismatch,
  tarballName,
  type ReleaseSeen,
} from "./release.mjs";

describe("isPrerelease (the GitHub pre-release rule)", () => {
  it.each([
    ["0.1.0-rc.1", true],
    ["1.0.0-beta.2", true],
    ["0.1.0", false],
    ["1.0.0", false],
  ])("%s -> %s", (version, expected) => {
    expect(isPrerelease(version)).toBe(expected);
  });
});

describe("tagMismatch (tag = version)", () => {
  it("accepts v<version>", () => {
    expect(tagMismatch("v0.1.0-rc.1", "0.1.0-rc.1")).toBeNull();
    expect(tagMismatch("v0.1.0", "0.1.0")).toBeNull();
  });

  it("refuses an rc tag on a release version and the reverse", () => {
    expect(tagMismatch("v0.1.0-rc.1", "0.1.0")).toBe(
      'tag "v0.1.0-rc.1" does not match package.json version "0.1.0" (expected "v0.1.0")',
    );
    expect(tagMismatch("v0.1.0", "0.1.0-rc.1")).toMatch(/does not match/);
  });

  it("refuses a tag without the v and a version that is not semver", () => {
    expect(tagMismatch("0.1.0", "0.1.0")).toMatch(/does not match/);
    expect(tagMismatch("v0.1", "0.1")).toMatch(/not a semver version/);
  });
});

describe("the release asset a consumer pins", () => {
  const pkg = {
    name: "@rootxkit/uspace-ui",
    version: "0.1.0-rc.1",
    repository: { url: "git+https://github.com/rootxkit/uspace-ui.git" },
  };

  it("is named the way pnpm pack names a scoped package", () => {
    expect(tarballName(pkg.name, pkg.version)).toBe(
      "rootxkit-uspace-ui-0.1.0-rc.1.tgz",
    );
    expect(tarballName("plain", "1.0.0")).toBe("plain-1.0.0.tgz");
  });

  it("is downloaded from the release of the version's tag", () => {
    expect(assetUrl(pkg)).toBe(
      "https://github.com/rootxkit/uspace-ui/releases/download/v0.1.0-rc.1/rootxkit-uspace-ui-0.1.0-rc.1.tgz",
    );
  });

  it("needs a GitHub repository URL", () => {
    expect(githubRepo("https://github.com/a/b")).toBe("a/b");
    expect(() => githubRepo("https://example.test/a/b.git")).toThrow(
      /not a GitHub repository URL/,
    );
  });
});

describe("checkLatest (the latest mark, read back per tag)", () => {
  type Seen = ReleaseSeen;
  const plain = (isLatest: boolean): Seen => ({
    tagName: "v0.1.0",
    isLatest,
    isPrerelease: false,
  });
  const rc = (isLatest: boolean): Seen => ({
    tagName: "v0.1.0-rc.2",
    isLatest,
    isPrerelease: true,
  });

  /** A query that answers each call from `answers` (an Error is thrown). */
  function run(
    tag: string,
    prerelease: boolean,
    answers: (Seen | null | Error)[],
    attempts = 5,
  ) {
    const calls: string[] = [];
    const sleeps: number[] = [];
    const log: string[] = [];
    let i = 0;
    const result = checkLatest({
      tag,
      prerelease,
      attempts,
      delayMs: 1000,
      query: (t) => {
        calls.push(t);
        const a = answers[Math.min(i++, answers.length - 1)];
        if (a instanceof Error) return Promise.reject(a);
        return Promise.resolve(a ?? null);
      },
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      log: (line) => log.push(line),
    });
    return { result, calls, sleeps, log };
  }

  it("passes a plain version that is the latest on the first read", async () => {
    const r = run("v0.1.0", false, [plain(true)]);
    await expect(r.result).resolves.toEqual({
      ok: true,
      attempts: 1,
      message: "v0.1.0 is the latest release (read 1 of 5)",
    });
    expect(r.calls).toEqual(["v0.1.0"]);
    expect(r.sleeps).toEqual([]);
  });

  it("waits for a slow index: not visible, then not yet latest, then latest", async () => {
    const r = run("v0.1.0", false, [null, plain(false), plain(true)]);
    await expect(r.result).resolves.toMatchObject({ ok: true, attempts: 3 });
    expect(r.sleeps).toEqual([1000, 1000]);
    expect(r.log).toEqual([
      "read 1 of 5: v0.1.0 is not visible yet",
      "read 2 of 5: v0.1.0 is not marked latest yet",
      "read 3 of 5: v0.1.0 is the latest release",
    ]);
  });

  it("retries a failed read and passes when a later one succeeds", async () => {
    const r = run("v0.1.0", false, [new Error("HTTP 502"), plain(true)]);
    await expect(r.result).resolves.toMatchObject({ ok: true, attempts: 2 });
    expect(r.log[0]).toBe("read 1 of 5: the query failed: HTTP 502");
  });

  it("fails a plain version that never becomes the latest, after the bound", async () => {
    const r = run("v0.1.0", false, [plain(false)], 4);
    await expect(r.result).resolves.toEqual({
      ok: false,
      attempts: 4,
      message:
        "v0.1.0 is not the latest release after 4 reads (last: not marked latest)",
    });
    expect(r.calls).toHaveLength(4);
    // No sleep after the last read.
    expect(r.sleeps).toEqual([1000, 1000, 1000]);
  });

  it("fails when the release never becomes visible, and when every read fails", async () => {
    await expect(run("v0.1.0", false, [null], 3).result).resolves.toEqual({
      ok: false,
      attempts: 3,
      message:
        "v0.1.0 is not the latest release after 3 reads (last: not visible)",
    });
    await expect(
      run("v0.1.0", false, [new Error("HTTP 401")], 2).result,
    ).resolves.toMatchObject({
      ok: false,
      message:
        "v0.1.0 is not the latest release after 2 reads (last: the query failed: HTTP 401)",
    });
  });

  it("passes a pre-release that is not the latest", async () => {
    const r = run("v0.1.0-rc.2", true, [null, rc(false)]);
    await expect(r.result).resolves.toEqual({
      ok: true,
      attempts: 2,
      message: "v0.1.0-rc.2 is a pre-release and not the latest (read 2 of 5)",
    });
  });

  it("fails a pre-release marked latest at once: waiting does not unmark it", async () => {
    const r = run("v0.1.0-rc.2", true, [rc(true)]);
    await expect(r.result).resolves.toEqual({
      ok: false,
      attempts: 1,
      message: "v0.1.0-rc.2 is a pre-release but is marked the latest release",
    });
    expect(r.sleeps).toEqual([]);
  });

  it("fails a release whose pre-release flag is not the version's", async () => {
    const r = run("v0.1.0", false, [{ ...plain(true), isPrerelease: true }]);
    await expect(r.result).resolves.toEqual({
      ok: false,
      attempts: 1,
      message: "v0.1.0 has isPrerelease=true, want false",
    });
  });

  it("refuses an answer for another tag", async () => {
    const r = run("v0.1.0", false, [{ ...plain(true), tagName: "v0.0.9" }], 2);
    await expect(r.result).resolves.toMatchObject({
      ok: false,
      message:
        "v0.1.0 is not the latest release after 2 reads (last: the answer was for v0.0.9)",
    });
  });

  it("needs at least one read", async () => {
    await expect(run("v0.1.0", false, [plain(true)], 0).result).rejects.toThrow(
      /attempts must be a whole number of at least 1/,
    );
  });
});

describe("releaseQuery (what gh is asked)", () => {
  it("asks GraphQL for the one release of the tag, by owner and name", () => {
    expect(releaseQueryArgs("rootxkit/uspace-ui", "v0.1.0")).toEqual([
      "api",
      "graphql",
      "-f",
      "owner=rootxkit",
      "-f",
      "name=uspace-ui",
      "-f",
      "tag=v0.1.0",
      "-f",
      `query=${RELEASE_QUERY}`,
    ]);
    expect(RELEASE_QUERY).toContain("release(tagName: $tag)");
    expect(RELEASE_QUERY).toMatch(/tagName\s+isLatest\s+isPrerelease/);
  });

  it("reads the release, or null when the tag has none yet", () => {
    expect(
      parseReleaseAnswer(
        '{"data":{"repository":{"release":{"tagName":"v0.1.0","isLatest":true,"isPrerelease":false}}}}',
      ),
    ).toEqual({ tagName: "v0.1.0", isLatest: true, isPrerelease: false });
    expect(
      parseReleaseAnswer('{"data":{"repository":{"release":null}}}'),
    ).toBeNull();
    expect(() => parseReleaseAnswer('{"data":{"repository":null}}')).toThrow(
      /no repository/,
    );
    expect(() =>
      parseReleaseAnswer(
        '{"data":{"repository":{"release":{"tagName":"v0.1.0","isLatest":"yes","isPrerelease":false}}}}',
      ),
    ).toThrow(/not a release/);
  });
});
