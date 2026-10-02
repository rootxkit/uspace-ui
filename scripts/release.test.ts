import { describe, expect, it } from "vitest";

import {
  assetUrl,
  githubRepo,
  isPrerelease,
  tagMismatch,
  tarballName,
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
