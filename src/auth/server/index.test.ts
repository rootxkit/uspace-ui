// `auth/server` cannot reach browser code (WP-5 done-when; 06 §3): its
// first statement imports `server-only`, which throws outside the
// `react-server` condition, and `auth/client` never imports it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth/server is server-only", () => {
  it('imports "server-only" before anything else', () => {
    const source = readFileSync("src/auth/server/index.ts", "utf8");
    const code = source
      .split("\n")
      .filter((l) => l.trim() !== "" && !l.trim().startsWith("//"));
    expect(code[0]).toBe('import "server-only";');
  });

  it("server-only throws by default and is empty for react-server", () => {
    const pkg = JSON.parse(
      readFileSync("node_modules/server-only/package.json", "utf8"),
    ) as { exports: Record<string, Record<string, string>> };
    expect(pkg.exports["."]).toEqual({
      "react-server": "./empty.js",
      default: "./index.js",
    });
  });

  it("the entry point throws when imported outside a server component", async () => {
    await expect(import("./index.js")).rejects.toThrow(/Server Component/);
  });

  it("its modules load on their own (the twin: the guard is the only thing that throws)", async () => {
    const mod = await import("./handlers.js");
    expect(typeof mod.bffHandlers).toBe("function");
  });

  it("auth/client never imports auth/server, and neither imports a token store", () => {
    const dir = "src/auth/client";
    for (const name of readdirSync(dir)) {
      const text = readFileSync(join(dir, name), "utf8");
      expect(text, name).not.toMatch(/from "\.\.\/server/);
      expect(text, name).not.toMatch(/localStorage|sessionStorage/);
    }
  });
});
