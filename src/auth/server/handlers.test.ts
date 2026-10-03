// bffHandlers (WP-5): exactly three routes, sign-in against the API's own
// two steps (the authority's /v1/auth/login and /v1/auth/mfa) with the
// challenge sealed in a cookie between them and the password sent once,
// cookies set on success and never on a refusal (E-01 pairs), no
// credential in any log line, logout and the proxy's path mapping.
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import { NextRequest } from "next/server.js";

import { challengeKey, openChallenge } from "./challenge.js";
import { authCounters, resetAuthCountersForTests } from "./counters.js";
import {
  bffHandlers,
  type BffHandlers,
  type BffOptions,
  type RouteHandler,
} from "./handlers.js";
import {
  API,
  FIXTURE,
  ORIGIN,
  SESSION,
  json,
  problem,
  request,
  setCookies,
  stubFetch,
} from "./testing.testing.js";

const LOGIN = "/v1/auth/login";
const MFA = "/v1/auth/mfa";
const LOGOUT = "/v1/auth/logout";
/** A fixture of the BFF secret: 32 bytes, never a real one. */
const BFF_SECRET = "TEST".repeat(8);

function handlers(
  f: typeof fetch,
  extra: Partial<BffOptions> = {},
  omit: ("apiMfaPath" | "apiLogoutPath")[] = [],
): BffHandlers {
  const all: BffOptions = {
    apiBase: API,
    apiLoginPath: LOGIN,
    apiMfaPath: MFA,
    mfaChallengeSecret: BFF_SECRET,
    apiLogoutPath: LOGOUT,
    session: SESSION,
    allowPaths: [/^\/v1\/zones(\/|$)/],
    timeoutMs: 1000,
    fetch: f,
    // SESSION is secure, which needs one of the two said (retro-audit S6).
    ...("trustedProxyHops" in extra ? {} : { noTrustedProxy: true as const }),
    ...extra,
  };
  const opts = Object.fromEntries(
    Object.entries(all).filter(([k]) => !(omit as string[]).includes(k)),
  ) as unknown as BffOptions;
  return bffHandlers(opts);
}

const HOST = new URL(ORIGIN).host;

function loginRequest(
  body: unknown,
  headers: Record<string, string> = { Origin: ORIGIN, Host: HOST },
  cookies?: Record<string, string>,
) {
  return request("/_bff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    ...(cookies === undefined ? {} : { cookies }),
  });
}

/** The second step as the form sends it: username and code, with the sealed challenge. */
function otpRequest(
  sealed: string | null,
  otp: string = FIXTURE.otp,
  username: string = FIXTURE.username,
) {
  return loginRequest(
    { username, otp },
    { Origin: ORIGIN, Host: HOST },
    sealed === null ? {} : { uspace_mfa: sealed },
  );
}

/** Runs the password step and returns the sealed challenge it set. */
async function passwordStep(h: BffHandlers): Promise<string> {
  const res = await h.login(loginRequest(CREDENTIALS));
  expect(await res.json()).toMatchObject({ status: "mfa_required" });
  const sealed = setCookies(res).get("uspace_mfa")?.value;
  expect(sealed).toBeTruthy();
  return sealed ?? "";
}

const CREDENTIALS = { username: FIXTURE.username, password: FIXTURE.password };
const CHALLENGE_TTL_S = 300;
const CHALLENGE = {
  mfa_token: FIXTURE.mfaToken,
  expires_at: new Date(Date.now() + CHALLENGE_TTL_S * 1000).toISOString(),
};
const FAR = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
const ISSUED = {
  token: FIXTURE.jwt,
  token_type: "Bearer",
  expires_at: FAR,
  idle_timeout_s: 1800,
  session: {
    sub: "TEST-account-01",
    roles: [],
    realm: "console",
    jti: "TEST-s1",
    expires_at: FAR,
    idle_expires_at: FAR,
  },
};

beforeEach(() => {
  resetAuthCountersForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("bffHandlers: the route set", () => {
  it("returns exactly login, logout and proxy", () => {
    const h = handlers(stubFetch(() => json(200, {})).fetch);
    expect(Object.keys(h).sort()).toEqual(["login", "logout", "proxy"]);
    expect(h).not.toHaveProperty("wsTicket");
  });

  it("has no wsTicket at the type level: a fourth route does not compile (M22)", () => {
    const h = handlers(stubFetch(() => json(200, {})).fetch);
    expectTypeOf(h).toEqualTypeOf<BffHandlers>();
    expectTypeOf<keyof BffHandlers>().toEqualTypeOf<
      "login" | "logout" | "proxy"
    >();
    expectTypeOf(h.login).toEqualTypeOf<RouteHandler>();
    // @ts-expect-error -- there is no WebSocket ticket route (M22).
    expect(h.wsTicket).toBeUndefined();
  });
});

describe("login", () => {
  it("on a 2xx session answer sets both cookies and never returns the token", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ status: "signed_in" });
    expect(text).not.toContain(FIXTURE.jwt);
    const jar = setCookies(res);
    expect(jar.get("uspace_session")?.value).toBe(FIXTURE.jwt);
    expect(jar.get("uspace_session")?.attrs["httponly"]).toBe(true);
    expect(jar.get("uspace_csrf")?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(stub.calls[0]?.url).toBe(`${API}${LOGIN}`);
    expect(JSON.parse(stub.calls[0]?.body ?? "")).toEqual(CREDENTIALS);
  });

  it("on a 401 passes the problem through and sets no cookie", async () => {
    const stub = stubFetch(() => problem(401, "invalid_credentials"));
    const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await res.json()).toMatchObject({
      type: "https://schemas.uspace.ge/problems/invalid_credentials",
      detail: "invalid_credentials detail",
    });
  });

  it("turns a redirect from either sign-in step into a 502 without Location or cookies", async () => {
    const redirect = () =>
      new Response(null, {
        status: 302,
        headers: { Location: "http://api.test:8080/sso" },
      });
    const first = await handlers(stubFetch(redirect).fetch).login(
      loginRequest(CREDENTIALS),
    );
    expect(first.status).toBe(502);
    expect(first.headers.get("location")).toBeNull();
    expect(first.headers.getSetCookie()).toEqual([]);
    const stub = stubFetch((url) =>
      url.endsWith(LOGIN) ? json(200, CHALLENGE) : redirect(),
    );
    const h = handlers(stub.fetch);
    const second = await h.login(otpRequest(await passwordStep(h)));
    expect(second.status).toBe(502);
    expect(second.headers.get("location")).toBeNull();
    expect(authCounters().upstream_redirect).toBe(2);
  });

  it("on a 429 passes Retry-After and the problem through, and sets no cookie", async () => {
    const stub = stubFetch(() =>
      problem(429, "rate_limited", { "Retry-After": "30" }),
    );
    const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("asks for the code, sealing the challenge in an HttpOnly cookie on /_bff for its lifetime", async () => {
    const stub = stubFetch(() =>
      json(200, {
        ...CHALLENGE,
        enrolment: {
          secret: "TESTSECRETBASE32",
          otpauth_uri: "otpauth://totp/TEST",
        },
      }),
    );
    const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(FIXTURE.mfaToken);
    expect(JSON.parse(text)).toEqual({
      status: "mfa_required",
      enrolment: {
        secret: "TESTSECRETBASE32",
        otpauthUri: "otpauth://totp/TEST",
      },
    });
    const jar = setCookies(res);
    expect([...jar.keys()]).toEqual(["uspace_mfa"]);
    const c = jar.get("uspace_mfa");
    expect(c?.attrs["httponly"]).toBe(true);
    expect(c?.attrs["secure"]).toBe(true);
    expect(c?.attrs["samesite"]).toBe("strict");
    expect(c?.attrs["path"]).toBe("/_bff");
    const maxAge = Number(c?.attrs["max-age"]);
    expect(maxAge).toBeGreaterThan(CHALLENGE_TTL_S - 5);
    expect(maxAge).toBeLessThanOrEqual(CHALLENGE_TTL_S);
    expect(stub.calls).toHaveLength(1);
  });

  it("seals the challenge: the cookie value hides it, and only the BFF secret opens it", async () => {
    const sealed = await passwordStep(
      handlers(stubFetch(() => json(200, CHALLENGE)).fetch),
    );
    expect(sealed).not.toContain(FIXTURE.mfaToken);
    expect(sealed).not.toContain(btoa(FIXTURE.mfaToken).slice(0, 12));
    const now = Date.now() / 1000;
    expect(
      await openChallenge(
        await challengeKey(BFF_SECRET),
        sealed,
        FIXTURE.username,
        now,
      ),
    ).toBe(FIXTURE.mfaToken);
    expect(
      await openChallenge(
        await challengeKey("OTHER".repeat(8)),
        sealed,
        FIXTURE.username,
        now,
      ),
    ).toBeNull();
  });

  it("asks for the code without enrolment once the account has an authenticator", async () => {
    const stub = stubFetch(() => json(200, CHALLENGE));
    const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
    expect(await res.json()).toEqual({ status: "mfa_required" });
  });

  it("sends the password once: the second step carries only the code and the sealed challenge", async () => {
    const stub = stubFetch((url) =>
      url.endsWith(LOGIN)
        ? json(200, CHALLENGE)
        : json(200, { ...ISSUED, recovery_codes: ["TEST-RC-1", "TEST-RC-2"] }),
    );
    const h = handlers(stub.fetch);
    const sealed = await passwordStep(h);
    const res = await h.login(otpRequest(sealed));
    expect(stub.calls.map((c) => c.url)).toEqual([
      `${API}${LOGIN}`,
      `${API}${MFA}`,
    ]);
    expect(JSON.parse(stub.calls[0]?.body ?? "")).toEqual(CREDENTIALS);
    expect(JSON.parse(stub.calls[1]?.body ?? "")).toEqual({
      mfa_token: FIXTURE.mfaToken,
      code: FIXTURE.otp,
    });
    // The password reached the API in the first call and in no other.
    const withPassword = stub.calls.filter((c) =>
      (c.body ?? "").includes(FIXTURE.password),
    );
    expect(withPassword).toHaveLength(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "signed_in",
      recoveryCodes: ["TEST-RC-1", "TEST-RC-2"],
    });
    const jar = setCookies(res);
    expect(jar.get("uspace_session")?.value).toBe(FIXTURE.jwt);
    // The used challenge is cleared.
    expect(jar.get("uspace_mfa")?.attrs["max-age"]).toBe("0");
    expect(jar.get("uspace_mfa")?.attrs["path"]).toBe("/_bff");
  });

  it("refuses the password and the code together: the password goes in the first step only", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch).login(
      loginRequest({ ...CREDENTIALS, otp: FIXTURE.otp }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      errors: [{ field: "password", reason: "unexpected" }],
    });
    expect(stub.fn).not.toHaveBeenCalled();
  });

  it("keeps single-step sign-in when the API wants no code: no challenge cookie", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
    expect(await res.json()).toEqual({ status: "signed_in" });
    const jar = setCookies(res);
    expect(jar.get("uspace_session")?.value).toBe(FIXTURE.jwt);
    expect(jar.has("uspace_mfa")).toBe(false);
    expect(stub.calls).toHaveLength(1);
  });

  it("works without apiMfaPath and a secret for an API that has no MFA step", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const h = handlers(stub.fetch, {}, ["apiMfaPath"]);
    expect((await h.login(loginRequest(CREDENTIALS))).status).toBe(200);
  });

  it("refuses a code without a live challenge with 401, and never calls the API", async () => {
    const stub = stubFetch((url) =>
      url.endsWith(LOGIN) ? json(200, CHALLENGE) : json(200, ISSUED),
    );
    const h = handlers(stub.fetch);
    const sealed = await passwordStep(h);
    const tampered = `${sealed.slice(0, -2)}${sealed.endsWith("AA") ? "BB" : "AA"}`;
    const foreign = await passwordStep(
      handlers(stubFetch(() => json(200, CHALLENGE)).fetch, {
        mfaChallengeSecret: "OTHER".repeat(8),
      }),
    );
    const calls = stub.calls.length;
    for (const cookie of [null, "", "garbage", "a.b.c", tampered, foreign]) {
      const res = await h.login(otpRequest(cookie));
      expect(res.status, String(cookie)).toBe(401);
      expect(await res.json()).toMatchObject({
        type: "https://schemas.uspace.ge/problems/mfa_challenge_missing",
      });
      expect(setCookies(res).has("uspace_session")).toBe(false);
    }
    expect(stub.calls).toHaveLength(calls);
    expect(authCounters().mfa_challenge_invalid).toBe(6);
  });

  it("binds the challenge to the username: another username cannot use it", async () => {
    const stub = stubFetch((url) =>
      url.endsWith(LOGIN) ? json(200, CHALLENGE) : json(200, ISSUED),
    );
    const h = handlers(stub.fetch);
    const sealed = await passwordStep(h);
    const other = await h.login(
      otpRequest(sealed, FIXTURE.otp, "TEST-user-02"),
    );
    expect(other.status).toBe(401);
    expect(await other.json()).toMatchObject({
      type: "https://schemas.uspace.ge/problems/mfa_challenge_missing",
    });
    expect(stub.calls).toHaveLength(1);
    const noUser = await h.login(
      loginRequest({ otp: FIXTURE.otp }, undefined, { uspace_mfa: sealed }),
    );
    expect(noUser.status).toBe(400);
    expect(await noUser.json()).toMatchObject({
      errors: [{ field: "username", reason: "required" }],
    });
    // The twin: the username of the password step opens it.
    const same = await h.login(otpRequest(sealed));
    expect(same.status).toBe(200);
    expect(stub.calls).toHaveLength(2);
    const key = await challengeKey(BFF_SECRET);
    const now = Date.now() / 1000;
    expect(await openChallenge(key, sealed, "TEST-user-02", now)).toBeNull();
    expect(await openChallenge(key, sealed, FIXTURE.username, now)).toBe(
      FIXTURE.mfaToken,
    );
  });

  it("refuses a challenge past its expiry even if the browser still sends the cookie", async () => {
    const stub = stubFetch((url) =>
      url.endsWith(LOGIN) ? json(200, CHALLENGE) : json(200, ISSUED),
    );
    const h = handlers(stub.fetch);
    const sealed = await passwordStep(h);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (CHALLENGE_TTL_S + 1) * 1000);
    const late = await h.login(otpRequest(sealed));
    expect(late.status).toBe(401);
    expect(setCookies(late).get("uspace_mfa")?.attrs["max-age"]).toBe("0");
    vi.useRealTimers();
    // The twin: the same cookie inside its lifetime is accepted.
    const inTime = await h.login(otpRequest(sealed));
    expect(inTime.status).toBe(200);
    expect(stub.calls.map((c) => c.url)).toEqual([
      `${API}${LOGIN}`,
      `${API}${MFA}`,
    ]);
  });

  it("on a refused code passes the problem through, sets no session and keeps the challenge", async () => {
    const stub = stubFetch((url) =>
      url.endsWith(LOGIN) ? json(200, CHALLENGE) : problem(401, "mfa_refused"),
    );
    const h = handlers(stub.fetch);
    const res = await h.login(otpRequest(await passwordStep(h)));
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("refuses to build with apiMfaPath but no secret, or a short one", () => {
    const f = stubFetch(() => json(200, {})).fetch;
    expect(() => handlers(f, {}, ["mfaChallengeSecret"] as never)).toThrow(
      RangeError,
    );
    expect(() => handlers(f, { mfaChallengeSecret: "TEST".repeat(7) })).toThrow(
      /at least 32 bytes/,
    );
    expect(() =>
      handlers(f, { mfaChallengeSecret: "TEST".repeat(8) }),
    ).not.toThrow();
  });

  it("keeps the cookie no longer than the session the API issued", async () => {
    const soon = new Date(Date.now() + 600 * 1000).toISOString();
    const stub = stubFetch(() => json(200, { ...ISSUED, expires_at: soon }));
    const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
    const maxAge = Number(
      setCookies(res).get("uspace_session")?.attrs["max-age"],
    );
    expect(maxAge).toBeGreaterThan(590);
    expect(maxAge).toBeLessThanOrEqual(600);
    expect(setCookies(res).get("uspace_csrf")?.attrs["max-age"]).toBe(
      String(maxAge),
    );
  });

  it("does not answer signed_in for a session that has already expired (retro-audit N10)", async () => {
    for (const expires_at of [
      new Date(Date.now() - 60 * 1000).toISOString(),
      new Date(Date.now()).toISOString(),
    ]) {
      resetAuthCountersForTests();
      const stub = stubFetch(() => json(200, { ...ISSUED, expires_at }));
      const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
      expect(res.status, expires_at).toBe(502);
      expect(await res.json()).toMatchObject({
        type: "https://schemas.uspace.ge/problems/upstream_invalid",
      });
      expect(res.headers.getSetCookie(), expires_at).toEqual([]);
      expect(authCounters().login_answer_invalid).toBe(1);
    }
    // The same through the code step.
    const second = stubFetch((url) =>
      url.endsWith(LOGIN)
        ? json(200, CHALLENGE)
        : json(200, {
            ...ISSUED,
            expires_at: new Date(Date.now() - 1000).toISOString(),
          }),
    );
    const h = handlers(second.fetch);
    const res = await h.login(otpRequest(await passwordStep(h)));
    expect(res.status).toBe(502);
    expect(setCookies(res).has("uspace_session")).toBe(false);
  });

  it("refuses a sign-in without Origin, or from another origin, and never calls the API", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const h = handlers(stub.fetch);
    const none = await h.login(loginRequest(CREDENTIALS, { Host: HOST }));
    const foreign = await h.login(
      loginRequest(CREDENTIALS, {
        Origin: "https://elsewhere.test",
        Host: HOST,
      }),
    );
    expect(none.status).toBe(403);
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toMatchObject({
      type: "https://schemas.uspace.ge/problems/origin_refused",
    });
    expect(stub.fn).not.toHaveBeenCalled();
    expect(authCounters().origin_refused).toBe(2);
  });

  it("accepts the origin the trusted reverse proxy names in X-Forwarded-Host and -Proto (the acceptance)", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch, { trustedProxyHops: 1 }).login(
      loginRequest(CREDENTIALS, {
        Origin: ORIGIN,
        Host: "web:3000",
        "X-Forwarded-Host": HOST,
        "X-Forwarded-Proto": "https",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("ignores X-Forwarded-Host and -Proto without a trusted hop", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch).login(
      loginRequest(CREDENTIALS, {
        Origin: ORIGIN,
        Host: "web:3000",
        "X-Forwarded-Host": HOST,
      }),
    );
    expect(res.status).toBe(403);
    expect(stub.fn).not.toHaveBeenCalled();
  });

  it("compares the whole origin: another scheme or port on the same host is refused", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const h = handlers(stub.fetch);
    for (const origin of [
      `http://${HOST}`,
      `https://${HOST}:8443`,
      `https://${HOST}.elsewhere.test`,
      "null",
    ]) {
      const res = await h.login(
        loginRequest(CREDENTIALS, { Origin: origin, Host: HOST }),
      );
      expect(res.status, origin).toBe(403);
    }
    // A forwarded http scheme from a trusted proxy refuses an https page.
    const proxied = await handlers(stub.fetch, { trustedProxyHops: 1 }).login(
      loginRequest(CREDENTIALS, {
        Origin: ORIGIN,
        Host: HOST,
        "X-Forwarded-Proto": "http",
      }),
    );
    expect(proxied.status).toBe(403);
    expect(stub.fn).not.toHaveBeenCalled();
  });

  it("matches scheme and port exactly: a default port is the same origin, http with secure: false", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const ok1 = await handlers(stub.fetch).login(
      loginRequest(CREDENTIALS, { Origin: `https://${HOST}:443`, Host: HOST }),
    );
    expect(ok1.status).toBe(200);
    const ok2 = await handlers(stub.fetch, {
      session: { secure: false, maxAgeS: 3600 },
    }).login(
      loginRequest(CREDENTIALS, {
        Origin: "http://localhost:3000",
        Host: "localhost:3000",
      }),
    );
    expect(ok2.status).toBe(200);
    const badPort = await handlers(stub.fetch, {
      session: { secure: false, maxAgeS: 3600 },
    }).login(
      loginRequest(CREDENTIALS, {
        Origin: "http://localhost:3001",
        Host: "localhost:3000",
      }),
    );
    expect(badPort.status).toBe(403);
  });

  it("refuses a body without username or password with field errors, and never calls the API", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const h = handlers(stub.fetch);
    const res = await h.login(loginRequest({ username: FIXTURE.username }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      errors: [{ field: "password", reason: "required" }],
    });
    const notJson = await h.login(
      request("/_bff/login", {
        method: "POST",
        headers: { Origin: ORIGIN, Host: HOST },
        body: "username=x",
      }),
    );
    expect(notJson.status).toBe(400);
    const badOtp = await h.login(
      loginRequest({ username: FIXTURE.username, otp: 123456 }),
    );
    expect(await badOtp.json()).toMatchObject({
      errors: [{ field: "otp", reason: "invalid" }],
    });
    const big = await h.login(
      loginRequest({ ...CREDENTIALS, password: "x".repeat(9000) }),
    );
    expect(big.status).toBe(413);
    expect(stub.fn).not.toHaveBeenCalled();
  });

  it("refuses a body Content-Length announces over 8 KiB before reading a byte", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const req = loginRequest(CREDENTIALS, {
      Origin: ORIGIN,
      Host: HOST,
      "Content-Length": "100000",
    });
    const res = await handlers(stub.fetch).login(req);
    expect(res.status).toBe(413);
    expect(req.bodyUsed).toBe(false);
    expect(stub.fn).not.toHaveBeenCalled();
  });

  it("stops reading an endless body at the bound and cancels the stream", async () => {
    let pulled = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024).fill(0x20));
      },
      cancel() {
        cancelled = true;
      },
    });
    const req = new NextRequest(new URL("/_bff/login", ORIGIN), {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        Host: HOST,
        "Content-Type": "application/json",
      },
      body: endless,
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1]);
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch).login(req);
    expect(res.status).toBe(413);
    expect(cancelled).toBe(true);
    // 8 KiB in 1 KiB chunks: the ninth passes the bound and ends the read.
    expect(pulled).toBeLessThanOrEqual(11);
    expect(stub.fn).not.toHaveBeenCalled();
  });

  it("reads a body of exactly 8 KiB (the bound is inclusive)", async () => {
    const base = JSON.stringify({ ...CREDENTIALS, pad: "" });
    const body = JSON.stringify({
      ...CREDENTIALS,
      pad: "x".repeat(8192 - base.length),
    });
    expect(new TextEncoder().encode(body).length).toBe(8192);
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch).login(
      request("/_bff/login", {
        method: "POST",
        headers: {
          Origin: ORIGIN,
          Host: HOST,
          "Content-Length": "8192",
        },
        body,
      }),
    );
    expect(res.status).toBe(200);
    const over = await handlers(stub.fetch).login(
      request("/_bff/login", {
        method: "POST",
        headers: { Origin: ORIGIN, Host: HOST },
        body: `${body} `,
      }),
    );
    expect(over.status).toBe(413);
  });

  it("refuses a Content-Length that is not a number", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch).login(
      loginRequest(CREDENTIALS, {
        Origin: ORIGIN,
        Host: HOST,
        "Content-Length": "1e3",
      }),
    );
    expect(res.status).toBe(413);
  });

  it("answers 502 for a 2xx without a token or a challenge, and sets no cookie", async () => {
    for (const body of [{}, { token: "" }]) {
      const res = await handlers(stubFetch(() => json(200, body)).fetch).login(
        loginRequest(CREDENTIALS),
      );
      expect(res.status).toBe(502);
      expect(res.headers.getSetCookie()).toEqual([]);
    }
    const notJson = await handlers(
      stubFetch(() => new Response("ok")).fetch,
    ).login(loginRequest(CREDENTIALS));
    expect(notJson.status).toBe(502);
    // A challenge to an API configured without an MFA step.
    const noMfaPath = await handlers(
      stubFetch(() => json(200, CHALLENGE)).fetch,
      {},
      ["apiMfaPath"],
    ).login(loginRequest(CREDENTIALS));
    expect(noMfaPath.status).toBe(502);
    // A challenge without, or past, its expiry.
    for (const expires_at of [undefined, "soon", "2000-01-01T00:00:00Z"]) {
      const res = await handlers(
        stubFetch(() => json(200, { mfa_token: FIXTURE.mfaToken, expires_at }))
          .fetch,
      ).login(loginRequest(CREDENTIALS));
      expect(res.status).toBe(502);
      expect(res.headers.getSetCookie()).toEqual([]);
    }
    const badStub = stubFetch((url) =>
      url.endsWith(LOGIN) ? json(200, CHALLENGE) : json(200, {}),
    );
    const bad = handlers(badStub.fetch);
    const badSession = await bad.login(otpRequest(await passwordStep(bad)));
    expect(badSession.status).toBe(502);
    expect(authCounters().login_answer_invalid).toBe(8);
  });

  it("answers 504 when the API does not answer, and sets no cookie", async () => {
    const hang = ((_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_r, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      })) as typeof fetch;
    const res = await handlers(hang, { timeoutMs: 20 }).login(
      loginRequest(CREDENTIALS),
    );
    expect(res.status).toBe(504);
    expect(res.headers.getSetCookie()).toEqual([]);
    const mfaHang = ((u: RequestInfo | URL, init?: RequestInit) =>
      String(u).endsWith(LOGIN)
        ? Promise.resolve(json(200, CHALLENGE))
        : hang(u, init)) as typeof fetch;
    const h2 = handlers(mfaHang, { timeoutMs: 20 });
    const res2 = await h2.login(otpRequest(await passwordStep(h2)));
    expect(res2.status).toBe(504);
  });

  it("gives up on a sign-in answer whose body stalls after the headers (retro-audit S4)", async () => {
    const stall = (() =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(ctrl) {
              ctrl.enqueue(new TextEncoder().encode('{"token":'));
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )) as typeof fetch;
    const res = await handlers(stall, { timeoutMs: 30 }).login(
      loginRequest(CREDENTIALS),
    );
    expect(res.status).toBe(502);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(authCounters().upstream_timeout).toBe(1);
  });

  it("sends the API the client address its trusted proxy recorded, not the client's header", async () => {
    const chain = { "X-Forwarded-For": "203.0.113.66, 192.0.2.10" };
    const trusted = stubFetch(() => json(200, ISSUED));
    await handlers(trusted.fetch, { trustedProxyHops: 1 }).login(
      loginRequest(CREDENTIALS, { Origin: ORIGIN, Host: HOST, ...chain }),
    );
    expect(trusted.calls[0]?.headers.get("x-forwarded-for")).toBe("192.0.2.10");
    const untrusted = stubFetch(() => json(200, ISSUED));
    await handlers(untrusted.fetch).login(
      loginRequest(CREDENTIALS, { Origin: ORIGIN, Host: HOST, ...chain }),
    );
    expect(untrusted.calls[0]?.headers.get("x-forwarded-for")).toBeNull();
  });

  it("refuses an invalid trustedProxyHops when the handlers are built", () => {
    const f = stubFetch(() => json(200, {})).fetch;
    expect(() => handlers(f, { trustedProxyHops: 0 })).toThrow(RangeError);
    expect(() => handlers(f, { trustedProxyHops: 1 })).not.toThrow();
  });

  it("refuses a secure build that says nothing about proxies (retro-audit S6)", () => {
    const f = stubFetch(() => json(200, {})).fetch;
    const base: BffOptions = {
      apiBase: API,
      apiLoginPath: LOGIN,
      session: { secure: true, maxAgeS: 3600 },
      allowPaths: [],
      timeoutMs: 1000,
      fetch: f,
    };
    // Behind an unconfigured proxy the API would see one address for every
    // user, so its per-address lockout would lock them all out together.
    expect(() => bffHandlers(base)).toThrow(/trustedProxyHops/);
    // Both at once contradict each other.
    expect(() =>
      bffHandlers({ ...base, trustedProxyHops: 1, noTrustedProxy: true }),
    ).toThrow(/trustedProxyHops/);
    // The acceptances: either one said, or a plain-HTTP development build.
    expect(() => bffHandlers({ ...base, trustedProxyHops: 1 })).not.toThrow();
    expect(() => bffHandlers({ ...base, noTrustedProxy: true })).not.toThrow();
    expect(() =>
      bffHandlers({ ...base, session: { secure: false, maxAgeS: 3600 } }),
    ).not.toThrow();
  });

  it("with noTrustedProxy sends the API no X-Forwarded-For, whatever the client wrote", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    await handlers(stub.fetch, { noTrustedProxy: true }).login(
      loginRequest(CREDENTIALS, {
        Origin: ORIGIN,
        Host: HOST,
        "X-Forwarded-For": "203.0.113.66",
      }),
    );
    expect(stub.calls[0]?.headers.get("x-forwarded-for")).toBeNull();
  });

  it("never writes the credentials, the challenge or the token to any log", async () => {
    const methods = ["log", "info", "warn", "error", "debug", "trace"] as const;
    const spies = methods.map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const answers = [
      () => json(200, ISSUED),
      () => problem(401, "invalid_credentials"),
      () => problem(429, "rate_limited", { "Retry-After": "5" }),
      () => json(200, CHALLENGE),
      () => json(200, {}),
      () => Promise.reject(new TypeError("fetch failed")),
    ];
    for (const answer of answers) {
      const h = handlers(stubFetch(answer).fetch);
      const first = await h.login(loginRequest(CREDENTIALS));
      const sealed = setCookies(first).get("uspace_mfa")?.value ?? null;
      await h.login(otpRequest(sealed));
    }
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const secret of [
      FIXTURE.username,
      FIXTURE.password,
      FIXTURE.otp,
      FIXTURE.mfaToken,
      FIXTURE.jwt,
    ]) {
      expect(logged).not.toContain(secret);
    }
    // The spies did see the console: a direct call lands (the presence twin).
    console.warn("TEST-probe");
    expect(JSON.stringify(spies[2]?.mock.calls)).toContain("TEST-probe");
  });
});

describe("logout", () => {
  const signedIn = { uspace_session: FIXTURE.jwt, uspace_csrf: FIXTURE.csrf };

  it("with the CSRF pair tells the API with the bearer and clears both cookies", async () => {
    const stub = stubFetch(() => new Response(null, { status: 204 }));
    const res = await handlers(stub.fetch).logout(
      request("/_bff/logout", {
        method: "POST",
        cookies: signedIn,
        headers: { "X-CSRF-Token": FIXTURE.csrf },
      }),
    );
    expect(res.status).toBe(204);
    expect(stub.calls[0]?.url).toBe(`${API}${LOGOUT}`);
    expect(stub.calls[0]?.headers.get("authorization")).toBe(
      `Bearer ${FIXTURE.jwt}`,
    );
    expect(stub.calls[0]?.headers.get("cookie")).toBeNull();
    const jar = setCookies(res);
    expect(jar.get("uspace_session")?.attrs["max-age"]).toBe("0");
    expect(jar.get("uspace_csrf")?.attrs["max-age"]).toBe("0");
  });

  it("without the CSRF header refuses with 403, clears nothing and tells nobody", async () => {
    const stub = stubFetch(() => new Response(null, { status: 204 }));
    const res = await handlers(stub.fetch).logout(
      request("/_bff/logout", { method: "POST", cookies: signedIn }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(stub.fn).not.toHaveBeenCalled();
  });

  it("clears the cookies even when the API is down", async () => {
    const down = (() =>
      Promise.reject(new TypeError("fetch failed"))) as typeof fetch;
    const res = await handlers(down).logout(
      request("/_bff/logout", {
        method: "POST",
        cookies: signedIn,
        headers: { "X-CSRF-Token": FIXTURE.csrf },
      }),
    );
    expect(res.status).toBe(204);
    expect(setCookies(res).get("uspace_session")?.attrs["max-age"]).toBe("0");
  });

  it("does not call the API without apiLogoutPath, or without a session", async () => {
    const stub = stubFetch(() => new Response(null, { status: 204 }));
    const req = () =>
      request("/_bff/logout", {
        method: "POST",
        cookies: signedIn,
        headers: { "X-CSRF-Token": FIXTURE.csrf },
      });
    await handlers(stub.fetch, {}, ["apiLogoutPath"]).logout(req());
    await handlers(stub.fetch).logout(
      request("/_bff/logout", {
        method: "POST",
        cookies: { uspace_csrf: FIXTURE.csrf },
        headers: { "X-CSRF-Token": FIXTURE.csrf },
      }),
    );
    expect(stub.fn).not.toHaveBeenCalled();
  });
});

describe("proxy", () => {
  const cookies = { uspace_session: FIXTURE.jwt };

  it("passes the trusted hops to forward", async () => {
    const stub = stubFetch(() => json(200, []));
    await handlers(stub.fetch, { trustedProxyHops: 1 }).proxy(
      request("/_bff/api/v1/zones", {
        cookies,
        headers: { "X-Forwarded-For": "203.0.113.66, 192.0.2.10" },
      }),
    );
    expect(stub.calls[0]?.headers.get("x-forwarded-for")).toBe("192.0.2.10");
  });

  it("maps /_bff/api/<path>?<query> onto apiBase/<path>?<query>", async () => {
    const stub = stubFetch(() => json(200, []));
    const res = await handlers(stub.fetch).proxy(
      request("/_bff/api/v1/zones?at=2026-10-02T00:00:00Z", { cookies }),
    );
    expect(res.status).toBe(200);
    expect(stub.calls[0]?.url).toBe(`${API}/v1/zones?at=2026-10-02T00:00:00Z`);
    expect(stub.calls[0]?.headers.get("authorization")).toBe(
      `Bearer ${FIXTURE.jwt}`,
    );
  });

  it("keeps an apiBase path prefix", async () => {
    const stub = stubFetch(() => json(200, []));
    await handlers(stub.fetch, {
      apiBase: `${API}/api/`,
      allowPaths: [/^\/api\/v1\/zones$/],
    }).proxy(request("/_bff/api/v1/zones", { cookies }));
    expect(stub.calls[0]?.url).toBe(`${API}/api/v1/zones`);
  });

  it("refuses a path outside the BFF prefix, or one that would leave the API's origin", async () => {
    const stub = stubFetch(() => json(200, []));
    const h = handlers(stub.fetch);
    expect(
      (await h.proxy(request("/_bff/other/v1/zones", { cookies }))).status,
    ).toBe(404);
    expect(
      (
        await h.proxy(
          request("/_bff/api//elsewhere.test/v1/zones", { cookies }),
        )
      ).status,
    ).toBe(404);
    expect(
      (await h.proxy(request("/_bff/api/v1/zones/../../v1/users", { cookies })))
        .status,
    ).toBe(404);
    expect(stub.fn).not.toHaveBeenCalled();
    expect(authCounters().proxy_path_refused).toBe(3);
  });
});
