// sessionClaimsUnverified (WP-5, M20): display only, so a bad signature
// still decodes; the roles claim is an array or nothing.
import { beforeEach, describe, expect, it } from "vitest";

import { sessionClaimsUnverified, sessionDisplay } from "./claims.js";
import { base64url } from "./cookies.js";
import { authCounters, resetAuthCountersForTests } from "./counters.js";

const enc = (v: unknown): string =>
  base64url(new TextEncoder().encode(JSON.stringify(v)));

/** A token with a header, the payload and a signature nobody made. */
function token(payload: unknown): string {
  return `${enc({ alg: "RS256", kid: "TEST-kid" })}.${enc(payload)}.bad-signature`;
}

const CLAIMS = {
  iss: "https://issuer.test",
  aud: "console.test",
  sub: "TEST-account-01",
  scope: "session",
  roles: ["supervisor", "incident_officer"],
  realm: "console",
  jti: "TEST-session-01",
  exp: 1_900_000_000,
};

function without<K extends keyof typeof CLAIMS>(key: K) {
  return Object.fromEntries(
    Object.entries(CLAIMS).filter(([k]) => k !== key),
  ) as Partial<typeof CLAIMS>;
}

beforeEach(() => {
  resetAuthCountersForTests();
});

describe("sessionClaimsUnverified", () => {
  it("decodes a token with a bad signature: that is the point, nothing is verified", () => {
    expect(sessionClaimsUnverified(token(CLAIMS))).toEqual({
      sub: "TEST-account-01",
      roles: ["supervisor", "incident_officer"],
      realm: "console",
      exp: 1_900_000_000,
    });
  });

  it("returns both roles in order", () => {
    expect(sessionClaimsUnverified(token(CLAIMS))?.roles).toEqual([
      "supervisor",
      "incident_officer",
    ]);
  });

  it("is null for a malformed token, and counts it", () => {
    const bad = [
      "",
      "a.b",
      "a.b.c.d",
      "x.!!!.y",
      `${enc({})}.${enc([1])}.s`,
      `x.${enc("str")}.s`,
      "x.bm90IGpzb24.s",
    ];
    for (const b of bad) expect(sessionClaimsUnverified(b), b).toBeNull();
    expect(authCounters().claims_malformed).toBe(bad.length);
  });

  it("returns an exp in the past: display decides, not the decoder", () => {
    expect(sessionClaimsUnverified(token({ ...CLAIMS, exp: 1 }))?.exp).toBe(1);
  });

  it("gives [] when there is no roles claim, without a count", () => {
    expect(sessionClaimsUnverified(token(without("roles")))?.roles).toEqual([]);
    expect(authCounters().roles_not_array).toBe(0);
  });

  it('gives [] for the pre-reconciliation string roles, never ["supervisor"], and counts it', () => {
    const c = sessionClaimsUnverified(
      token({ ...CLAIMS, roles: "supervisor" }),
    );
    expect(c?.roles).toEqual([]);
    expect(authCounters().roles_not_array).toBe(1);
  });

  it("never derives roles from scope", () => {
    const c = sessionClaimsUnverified(
      token({ ...without("roles"), scope: "session:supervisor" }),
    );
    expect(c?.roles).toEqual([]);
  });

  it("drops a role that is not a string, and counts it", () => {
    const c = sessionClaimsUnverified(
      token({ ...CLAIMS, roles: ["supervisor", 7] }),
    );
    expect(c?.roles).toEqual(["supervisor"]);
    expect(authCounters().role_not_string).toBe(1);
  });

  it("passes realm through, and gives null when it is absent", () => {
    expect(
      sessionClaimsUnverified(token({ ...CLAIMS, realm: "police" }))?.realm,
    ).toBe("police");
    expect(sessionClaimsUnverified(token(without("realm")))?.realm).toBeNull();
  });

  it("gives null sub and exp when they are absent or of the wrong type", () => {
    expect(sessionClaimsUnverified(token({ sub: 1, exp: "soon" }))).toEqual({
      sub: null,
      roles: [],
      realm: null,
      exp: null,
    });
  });

  it("decodes UTF-8 in the payload", () => {
    expect(
      sessionClaimsUnverified(token({ ...CLAIMS, sub: "ტესტი" }))?.sub,
    ).toBe("ტესტი");
  });
});

describe("sessionDisplay", () => {
  it("is the SessionDisplay of a complete token", () => {
    expect(sessionDisplay(token(CLAIMS))).toEqual({
      sub: "TEST-account-01",
      roles: ["supervisor", "incident_officer"],
      realm: "console",
      exp: 1_900_000_000,
    });
  });

  it("is null without a token and for a malformed one", () => {
    expect(sessionDisplay(null)).toBeNull();
    expect(sessionDisplay("x")).toBeNull();
  });

  it("is null for a token without realm, and counts it", () => {
    expect(sessionDisplay(token(without("realm")))).toBeNull();
    expect(authCounters().claims_incomplete).toBe(1);
  });
});
