// The consoles' imports and the API freeze (WP-14; PLAN §3): what the
// four `web/` apps import, pinned in scripts/consumer-imports.json, is
// @public, and every name PLAN §3 makes public is tagged so. Each check
// is shown failing on a beta, a missing and an unreadable import (E-01).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  check,
  exportTags,
  kitImports,
  problems,
} from "./consumer-imports.mjs";
import { decide, planNames } from "./release-tags.mjs";

describe("kitImports", () => {
  it("reads named, aliased, type, re-exported and member imports of the kit", () => {
    const found = kitImports(
      "web/src/a.tsx",
      [
        'import { AlertList, type AlertListProps } from "@rootxkit/uspace-ui/alerts";',
        'import type { Key as K } from "@rootxkit/uspace-ui/i18n";',
        'import cfg from "@rootxkit/uspace-ui/eslint";',
        'import { shapes } from "@rootxkit/uspace-ui/form";',
        'export { fixtures } from "@rootxkit/uspace-ui/test";',
        'import { z } from "zod";',
        'import "@rootxkit/uspace-ui/styles/tokens.css";',
        "const s = shapes.utcTime();",
      ].join("\n"),
    );
    expect(found).toEqual([
      { entry: "alerts", name: "AlertList" },
      { entry: "alerts", name: "AlertListProps" },
      { entry: "i18n", name: "Key" },
      { entry: "eslint", name: "default" },
      { entry: "form", name: "shapes" },
      { entry: "test", name: "fixtures" },
      { entry: "form", name: "shapes.utcTime" },
    ]);
  });

  it("returns a namespace, export-star or dynamic import as *", () => {
    const found = kitImports(
      "web/src/b.ts",
      [
        'import * as live from "@rootxkit/uspace-ui/live";',
        'export * from "@rootxkit/uspace-ui/map";',
        'const m = await import("@rootxkit/uspace-ui/layers");',
      ].join("\n"),
    );
    expect(found).toEqual([
      { entry: "live", name: "*" },
      { entry: "map", name: "*" },
      { entry: "layers", name: "*" },
    ]);
  });
});

describe("problems", () => {
  const tags = new Map([
    ["live\tsubscribeFrame", "beta"],
    ["live\tparseFrame", "public"],
    ["form\tshapes", "namespace"],
    ["form\tshapes.bbox", "public"],
    ["form\tshapes.utcTime", "beta"],
  ]);
  const pinned = (imports: Record<string, string[]>) => ({
    consumers: { "uspace-x": { commit: "0", imports } },
  });

  it("reports a beta export, a missing one and an unreadable import", () => {
    expect(
      problems(
        pinned({
          live: ["subscribeFrame", "gone", "*"],
          form: ["shapes", "shapes.utcTime"],
        }),
        tags,
      ),
    ).toEqual([
      "uspace-x: @rootxkit/uspace-ui/live subscribeFrame: tagged @beta",
      "uspace-x: @rootxkit/uspace-ui/live gone: not an export",
      "uspace-x: @rootxkit/uspace-ui/live *: a namespace or dynamic import; name the exports",
      "uspace-x: @rootxkit/uspace-ui/form shapes.utcTime: tagged @beta",
    ]);
  });

  it("passes public exports and a namespace read through public members (the twin)", () => {
    expect(
      problems(
        pinned({ live: ["parseFrame"], form: ["shapes", "shapes.bbox"] }),
        tags,
      ),
    ).toEqual([]);
  });
});

describe("the kit's source", () => {
  it("makes every pinned import of the four consoles a @public export", () => {
    const pinned = JSON.parse(
      readFileSync("scripts/consumer-imports.json", "utf8"),
    ) as { consumers: Record<string, { commit: string }> };
    expect(Object.keys(pinned.consumers).sort()).toEqual([
      "uspace-ansp",
      "uspace-authority",
      "uspace-cisp",
      "uspace-ussp",
    ]);
    for (const c of Object.values(pinned.consumers))
      expect(c.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(check()).toEqual([]);
  }, 120_000);

  it("tags @public every export PLAN §3 makes public", () => {
    const names = planNames(readFileSync("docs/PLAN.md", "utf8"));
    const tags = exportTags();
    const wrong: string[] = [];
    for (const [key, tag] of tags) {
      const [entry = "", name = ""] = key.split("\t");
      if (tag === "namespace" || name.includes(".")) continue;
      // `decide` reads the file only for model, ui and the adapters; the
      // names of the other entries are decided by PLAN §3 alone.
      if (entry === "model" || entry === "ui" || entry === "test") continue;
      if (decide(entry, name, "", names) === "public" && tag !== "public")
        wrong.push(`${entry} ${name}: @${tag}`);
    }
    expect(wrong).toEqual([]);
  }, 120_000);
});
