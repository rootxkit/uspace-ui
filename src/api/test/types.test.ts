// The typing of createClient is proven, not assumed (WP-4): the fixture and
// three real system files are generated into `paths` here, then tsc checks
// typing.testing.ts (whose `@ts-expect-error` lines must each be an error)
// and client.test.ts against them.
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { genApi, tsc } from "./run.testing.js";

const DIR = "src/api/test";
const OUT = join(DIR, "generated");
const INPUTS: Record<string, string> = {
  fixture: join(DIR, "fixture.yaml"),
  cisp: join(DIR, "systems", "cisp.yaml"),
  authority: join(DIR, "systems", "authority.yaml"),
  ussp: join(DIR, "systems", "ussp.yaml"),
};

beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  for (const [name, input] of Object.entries(INPUTS)) {
    const r = genApi(input, join(OUT, `${name}.d.ts`));
    if (r.status !== 0)
      throw new Error(`uspace-ui-gen-api ${input}: ${r.stderr}`);
  }
}, 60_000);

describe("generated paths type the client", () => {
  it.each(Object.entries(INPUTS))(
    "generates %s, and --check finds it current",
    (name, input) => {
      const r = genApi(input, join(OUT, `${name}.d.ts`), "--check");
      expect(r.stderr).toBe("");
      expect(r.status).toBe(0);
    },
  );

  it("checks the typing file and the client tests (the program is not empty)", () => {
    const r = tsc(join(DIR, "tsconfig.json"), "--listFilesOnly");
    expect(r.status).toBe(0);
    for (const file of [
      "typing.testing.ts",
      "client.test.ts",
      "generated/fixture.d.ts",
      "generated/authority.d.ts",
    ])
      expect(r.stdout).toContain(`src/api/test/${file}`);
  }, 120_000);

  it("compiles the accepted calls and errors on every @ts-expect-error line", () => {
    const r = tsc(join(DIR, "tsconfig.json"));
    expect(r.stdout + r.stderr).toBe("");
    expect(r.status).toBe(0);
  }, 120_000);

  it("fails on a wrong call without the directive (the check is not vacuous)", () => {
    writeFileSync(
      join(OUT, "probe.ts"),
      [
        'import type { paths } from "./fixture.js";',
        'import { createClient } from "../../client.js";',
        'const api = createClient<paths>({ baseUrl: "/_bff/api" });',
        'export const p = api.GET("/v1/zone");',
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(OUT, "tsconfig.probe.json"),
      JSON.stringify({
        extends: "../tsconfig.json",
        include: ["probe.ts"],
        exclude: [],
      }),
    );
    const r = tsc(join(OUT, "tsconfig.probe.json"));
    expect(r.status).not.toBe(0);
    expect(r.stdout).toMatch(/probe\.ts\(4,\d+\): error TS\d+/);
    expect(r.stdout).toContain('"/v1/zone"');
  }, 120_000);
});
