// csrfToken during server rendering: there is no document, so no token.
import { describe, expect, it } from "vitest";

import { csrfToken } from "./csrf.js";

describe("csrfToken without a document", () => {
  it("is null", () => {
    expect(typeof document).toBe("undefined");
    expect(csrfToken()).toBeNull();
  });
});
