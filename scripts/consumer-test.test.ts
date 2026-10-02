import { describe, expect, it } from "vitest";

import { tscErrors } from "./consumer-test.mjs";

describe("tscErrors (consumer test)", () => {
  it("keeps the kit's and the consumer's errors, sets third-party ones aside", () => {
    const out = [
      "consumer.ts(3,7): error TS2322: Type 'x' is not assignable.",
      "node_modules/.pnpm/@rootxkit+uspace-ui@http+++x/node_modules/@rootxkit/uspace-ui/dist/map/index.d.ts(1,1): error TS2307: Cannot find module.",
      "node_modules/.pnpm/next@16/node_modules/next/dist/x.d.ts(2,2): error TS2304: Cannot find name 'URLPattern'.",
      "error TS5058: The specified path does not exist.",
      "Found 4 errors.",
    ].join("\n");
    const { kit, other } = tscErrors(out);
    expect(kit).toHaveLength(3);
    expect(other).toEqual([expect.stringContaining("next/dist/x.d.ts")]);
  });
});
