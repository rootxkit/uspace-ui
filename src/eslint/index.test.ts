// The shipped config, run through ESLint as a consumer would use it: the
// kit's rules are on and report, and a clean file passes.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

import config, { plugin, rules } from "./index.js";

function lint(code: string, filePath: string) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: config,
  });
  return eslint.lintText(code, { filePath });
}

describe("@rootxkit/uspace-ui/eslint", () => {
  it("exports the four rules of PLAN §3.17", () => {
    expect(Object.keys(rules).sort()).toEqual([
      "noBusinessLogicInRoutes",
      "noGeometryImports",
      "noHandWrittenApiTypes",
      "noServerClientsInWeb",
    ]);
    expect(Object.keys(plugin.rules ?? {})).toHaveLength(4);
  });

  it("passes a clean file", async () => {
    const [result] = await lint(
      'import maplibregl from "maplibre-gl";\nexport const m = maplibregl;\n',
      "web/src/map.ts",
    );
    expect(result?.messages).toEqual([]);
  });

  it("reports a geometry import and a bus client", async () => {
    const [result] = await lint(
      'import area from "@turf/area";\nimport { connect } from "nats";\nexport { area, connect };\n',
      "web/src/map.ts",
    );
    expect(result?.messages.map((m) => m.ruleId)).toEqual([
      "uspace-ui/no-geometry-imports",
      "uspace-ui/no-server-clients-in-web",
    ]);
  });

  it("reports business logic in a route and a hand-written generated file", async () => {
    const [route] = await lint(
      'import { inZone } from "../../lib/zones";\nexport const GET = inZone;\n',
      "web/app/api/x/route.ts",
    );
    expect(route?.messages.map((m) => m.ruleId)).toEqual([
      "uspace-ui/no-business-logic-in-routes",
    ]);
    const [generated] = await lint(
      "export interface Track { id: string }\n",
      "web/src/api/generated/extra.ts",
    );
    expect(generated?.messages.map((m) => m.ruleId)).toEqual([
      "uspace-ui/no-hand-written-api-types",
    ]);
  });

  it("carries typescript-eslint strict, react-hooks and jsx-a11y", async () => {
    const [result] = await lint(
      'import { useState } from "react";\nexport function C(p: { on: boolean }) {\n  if (p.on) { const [s] = useState(0); return <img src={String(s)} />; }\n  return null;\n}\n',
      "web/src/c.tsx",
    );
    const ids = result?.messages.map((m) => m.ruleId) ?? [];
    expect(ids).toContain("react-hooks/rules-of-hooks");
    expect(ids).toContain("jsx-a11y/alt-text");
    const [ts] = await lint("export const x: any = 1;\n", "web/src/x.ts");
    expect(ts?.messages.map((m) => m.ruleId)).toEqual([
      "@typescript-eslint/no-explicit-any",
    ]);
  });
});
