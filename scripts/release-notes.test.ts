import { describe, expect, it } from "vitest";

import { extractSection } from "./release-notes.mjs";

const CHANGELOG = `# Changelog

## Unreleased

- next thing

## 0.1.0-rc.2 - 2026-10-09

- rc.2 line

## 0.1.0-rc.1 - 2026-10-02

### Ships

- rc.1 line one
- rc.1 line two

## 0.0.1

- old
`;

describe("extractSection", () => {
  it("returns exactly the section of the version, without its neighbours", () => {
    expect(extractSection(CHANGELOG, "0.1.0-rc.1")).toBe(
      "### Ships\n\n- rc.1 line one\n- rc.1 line two",
    );
    expect(extractSection(CHANGELOG, "0.1.0-rc.2")).toBe("- rc.2 line");
  });

  it("reads the last section up to the end of the file", () => {
    expect(extractSection(CHANGELOG, "0.0.1")).toBe("- old");
  });

  it("returns null for a missing version and for a prefix of one", () => {
    expect(extractSection(CHANGELOG, "0.1.0")).toBeNull();
    expect(extractSection(CHANGELOG, "0.1.0-rc")).toBeNull();
  });

  it("returns null for an empty section", () => {
    expect(extractSection("## 1.0.0\n\n## 0.9.0\n- x\n", "1.0.0")).toBeNull();
  });
});
