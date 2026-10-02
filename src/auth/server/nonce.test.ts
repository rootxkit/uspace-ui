// issueCspNonce: 128 random bits, base64, fresh each time.
import { describe, expect, it } from "vitest";

import { CSP_NONCE_HEADER, issueCspNonce } from "./nonce.js";

describe("issueCspNonce", () => {
  it("is 16 random bytes in base64, different every call", () => {
    const a = issueCspNonce();
    const b = issueCspNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(atob(a)).toHaveLength(16);
    expect(a).not.toBe(b);
  });

  it("travels in the x-nonce request header", () => {
    expect(CSP_NONCE_HEADER).toBe("x-nonce");
  });
});
