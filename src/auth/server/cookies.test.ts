// The session and CSRF cookies (WP-5): exact attributes, parsed from the
// Set-Cookie strings, and the CSRF pair with each refusal and its
// acceptance (E-01).
import { NextResponse } from "next/server.js";
import { describe, expect, it } from "vitest";

import {
  checkCsrf,
  clearSession,
  constantTimeEqual,
  issueCsrf,
  readSessionToken,
  setSession,
} from "./cookies.js";
import {
  FIXTURE,
  SESSION,
  request,
  setCookies,
  type ParsedCookie,
} from "./testing.testing.js";

/**
 * The attributes without `Expires`, after checking it: Next.js writes an
 * `Expires` equal to now + `Max-Age` beside `Max-Age` (which wins, RFC
 * 6265bis §5.6.2), so it must agree with it.
 */
function attrs(c: ParsedCookie | undefined): Record<string, string | true> {
  expect(c).toBeDefined();
  const { expires, ...rest } = c?.attrs ?? {};
  const maxAgeS = Number(rest["max-age"]);
  expect(typeof expires).toBe("string");
  const deltaS = (Date.parse(String(expires)) - Date.now()) / 1000;
  expect(Math.abs(deltaS - maxAgeS)).toBeLessThan(3);
  return rest;
}

describe("setSession", () => {
  it("sets exactly HttpOnly, Secure, SameSite=Strict, Path=/ and Max-Age", () => {
    const res = new NextResponse(null);
    setSession(res, FIXTURE.jwt, SESSION);
    expect(res.headers.getSetCookie()).toHaveLength(1);
    const c = setCookies(res).get("uspace_session");
    expect(c?.value).toBe(FIXTURE.jwt);
    expect(attrs(c)).toEqual({
      path: "/",
      "max-age": "3600",
      httponly: true,
      secure: true,
      samesite: "strict",
    });
  });

  it("omits Secure when secure is false, and nothing else changes", () => {
    const res = new NextResponse(null);
    setSession(res, FIXTURE.jwt, { secure: false, maxAgeS: 60 });
    expect(attrs(setCookies(res).get("uspace_session"))).toEqual({
      path: "/",
      "max-age": "60",
      httponly: true,
      samesite: "strict",
    });
  });

  it("uses the name, domain and path given", () => {
    const res = new NextResponse(null);
    setSession(res, FIXTURE.jwt, {
      ...SESSION,
      name: "other_session",
      domain: "console.test",
      path: "/app",
    });
    const c = setCookies(res).get("other_session");
    expect(c?.attrs["domain"]).toBe("console.test");
    expect(c?.attrs["path"]).toBe("/app");
  });
});

describe("clearSession", () => {
  it("expires both cookies with the attributes they were set with", () => {
    const res = new NextResponse(null);
    clearSession(res, SESSION);
    const jar = setCookies(res);
    expect([...jar.keys()].sort()).toEqual(["uspace_csrf", "uspace_session"]);
    const session = jar.get("uspace_session");
    const csrf = jar.get("uspace_csrf");
    expect(session?.value).toBe("");
    expect(session?.attrs["max-age"]).toBe("0");
    expect(session?.attrs["httponly"]).toBe(true);
    expect(session?.attrs["samesite"]).toBe("strict");
    expect(session?.attrs["secure"]).toBe(true);
    expect(csrf?.value).toBe("");
    expect(csrf?.attrs["max-age"]).toBe("0");
    expect(csrf?.attrs["httponly"]).toBeUndefined();
  });
});

describe("issueCsrf", () => {
  it("sets 32 random bytes as base64url, readable by the page (not HttpOnly)", () => {
    const res = new NextResponse(null);
    const value = issueCsrf(res, SESSION);
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const c = setCookies(res).get("uspace_csrf");
    expect(c?.value).toBe(value);
    expect(attrs(c)).toEqual({
      path: "/",
      "max-age": "3600",
      secure: true,
      samesite: "strict",
    });
  });

  it("chooses a new value every time", () => {
    const a = issueCsrf(new NextResponse(null), SESSION);
    const b = issueCsrf(new NextResponse(null), SESSION);
    expect(a).not.toBe(b);
  });
});

describe("readSessionToken", () => {
  it("reads the session cookie of a request", () => {
    const req = request("/", { cookies: { uspace_session: FIXTURE.jwt } });
    expect(readSessionToken(req)).toBe(FIXTURE.jwt);
  });

  it("reads a cookie store such as cookies()", () => {
    const store = {
      get: (n: string) => (n === "s" ? { value: "v" } : undefined),
    };
    expect(readSessionToken(store, { name: "s" })).toBe("v");
  });

  it("is null without the cookie, and for an empty one", () => {
    expect(readSessionToken(request("/"))).toBeNull();
    expect(
      readSessionToken(request("/", { cookies: { uspace_session: "" } })),
    ).toBeNull();
  });
});

describe("checkCsrf", () => {
  const post = (
    headers: Record<string, string>,
    cookies: Record<string, string>,
  ) => request("/_bff/api/v1/x", { method: "POST", headers, cookies });

  it("passes a matching cookie and header", () => {
    expect(
      checkCsrf(
        post({ "X-CSRF-Token": FIXTURE.csrf }, { uspace_csrf: FIXTURE.csrf }),
      ),
    ).toBe(true);
  });

  it("fails a missing header", () => {
    expect(checkCsrf(post({}, { uspace_csrf: FIXTURE.csrf }))).toBe(false);
  });

  it("fails a mismatched header", () => {
    expect(
      checkCsrf(
        post(
          { "X-CSRF-Token": `${FIXTURE.csrf}x` },
          { uspace_csrf: FIXTURE.csrf },
        ),
      ),
    ).toBe(false);
    expect(
      checkCsrf(
        post(
          { "X-CSRF-Token": "TEST-csrf-value-02" },
          { uspace_csrf: FIXTURE.csrf },
        ),
      ),
    ).toBe(false);
  });

  it("fails a missing cookie", () => {
    expect(checkCsrf(post({ "X-CSRF-Token": FIXTURE.csrf }, {}))).toBe(false);
  });

  it("fails an empty pair, which would otherwise compare equal", () => {
    expect(checkCsrf(post({ "X-CSRF-Token": "" }, { uspace_csrf: "" }))).toBe(
      false,
    );
  });

  it("checks every unsafe method and passes the safe ones without a pair", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(checkCsrf(request("/", { method })), method).toBe(false);
    }
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(checkCsrf(request("/", { method })), method).toBe(true);
    }
  });

  it("reads the CSRF cookie name given", () => {
    const req = post(
      { "X-CSRF-Token": FIXTURE.csrf },
      { other_csrf: FIXTURE.csrf },
    );
    expect(checkCsrf(req)).toBe(false);
    expect(checkCsrf(req, { csrfName: "other_csrf" })).toBe(true);
  });
});

describe("constantTimeEqual", () => {
  it("is true for equal strings and false for any difference", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });
});
