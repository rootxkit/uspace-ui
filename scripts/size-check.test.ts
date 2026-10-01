import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { measure, report } from "./size-check.mjs";

let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "size-check-"));
  mkdirSync(join(root, "dist", "map", "nested"), { recursive: true });
  writeFileSync(join(root, "dist", "map", "index.js"), "export const a = 1;\n");
  writeFileSync(
    join(root, "dist", "map", "nested", "x.js"),
    "export const b = 2;\n",
  );
  writeFileSync(
    join(root, "dist", "map", "index.d.ts"),
    "export declare const a: 1;\n",
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("size-check", () => {
  it("passes a budget the built files fit in, counting nested .js only", () => {
    const rows = measure(
      { map: { paths: ["dist/map"], maxGzipBytes: 10_000 } },
      root,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("ok");
    expect(rows[0]?.files).toBe(2);
    expect(rows[0]?.gzipBytes).toBeGreaterThan(0);
    const [text, failed] = report(rows);
    expect(failed).toBe(false);
    expect(text).toMatch(/^ok\s+map\s+\d+ \/\s+10000 B gz {2}\(2 files\)$/);
  });

  it("fails a budget the built files exceed", () => {
    const rows = measure(
      { map: { paths: ["dist/map"], maxGzipBytes: 10 } },
      root,
    );
    expect(rows[0]?.status).toBe("over");
    expect(report(rows)[1]).toBe(true);
  });

  it("reports a budget with nothing built as empty, not as a pass", () => {
    const rows = measure(
      { table: { paths: ["dist/table"], maxGzipBytes: 10 } },
      root,
    );
    expect(rows[0]).toMatchObject({ status: "empty", files: 0, gzipBytes: 0 });
    expect(report(rows)[1]).toBe(false);
  });
});
