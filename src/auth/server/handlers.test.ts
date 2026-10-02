// bffHandlers (WP-5): exactly three routes, sign-in against the API's own
// two steps (the authority's /v1/auth/login and /v1/auth/mfa), cookies
// set on success and never on a refusal (E-01 pairs), no credential in
// any log line, logout and the proxy's path mapping.
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

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

function handlers(
  f: typeof fetch,
  extra: Partial<BffOptions> = {},
  omit: ("apiMfaPath" | "apiLogoutPath")[] = [],
): BffHandlers {
  const all: BffOptions = {
    apiBase: API,
    apiLoginPath: LOGIN,
    apiMfaPath: MFA,
    apiLogoutPath: LOGOUT,
    session: SESSION,
    allowPaths: [/^\/v1\/zones(\/|$)/],
    timeoutMs: 1000,
    fetch: f,
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
) {
  return request("/_bff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const CREDENTIALS = { username: FIXTURE.username, password: FIXTURE.password };
const CHALLENGE = {
  mfa_token: FIXTURE.mfaToken,
  expires_at: "2099-01-01T00:00:00Z",
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

  it("asks for the one-time code without sending the challenge to the browser", async () => {
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
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(stub.calls).toHaveLength(1);
  });

  it("asks for the code without enrolment once the account has an authenticator", async () => {
    const stub = stubFetch(() => json(200, CHALLENGE));
    const res = await handlers(stub.fetch).login(loginRequest(CREDENTIALS));
    expect(await res.json()).toEqual({ status: "mfa_required" });
  });

  it("with otp runs both steps: the challenge and the code to the MFA path, then the cookies", async () => {
    const stub = stubFetch((url) =>
      url.endsWith(LOGIN)
        ? json(200, CHALLENGE)
        : json(200, { ...ISSUED, recovery_codes: ["TEST-RC-1", "TEST-RC-2"] }),
    );
    const res = await handlers(stub.fetch).login(
      loginRequest({ ...CREDENTIALS, otp: FIXTURE.otp }),
    );
    expect(stub.calls.map((c) => c.url)).toEqual([
      `${API}${LOGIN}`,
      `${API}${MFA}`,
    ]);
    expect(JSON.parse(stub.calls[1]?.body ?? "")).toEqual({
      mfa_token: FIXTURE.mfaToken,
      code: FIXTURE.otp,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "signed_in",
      recoveryCodes: ["TEST-RC-1", "TEST-RC-2"],
    });
    expect(setCookies(res).get("uspace_session")?.value).toBe(FIXTURE.jwt);
  });

  it("on a refused code passes the problem through and sets no cookie", async () => {
    const stub = stubFetch((url) =>
      url.endsWith(LOGIN) ? json(200, CHALLENGE) : problem(401, "mfa_refused"),
    );
    const res = await handlers(stub.fetch).login(
      loginRequest({ ...CREDENTIALS, otp: FIXTURE.otp }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
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

  it("accepts the origin the reverse proxy names in X-Forwarded-Host (the acceptance)", async () => {
    const stub = stubFetch(() => json(200, ISSUED));
    const res = await handlers(stub.fetch).login(
      loginRequest(CREDENTIALS, {
        Origin: ORIGIN,
        Host: "web:3000",
        "X-Forwarded-Host": HOST,
      }),
    );
    expect(res.status).toBe(200);
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
    const badOtp = await h.login(loginRequest({ ...CREDENTIALS, otp: 123456 }));
    expect(await badOtp.json()).toMatchObject({
      errors: [{ field: "otp", reason: "invalid" }],
    });
    const big = await h.login(
      loginRequest({ ...CREDENTIALS, password: "x".repeat(9000) }),
    );
    expect(big.status).toBe(413);
    expect(stub.fn).not.toHaveBeenCalled();
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
    const noMfaPath = await handlers(
      stubFetch(() => json(200, CHALLENGE)).fetch,
      {},
      ["apiMfaPath"],
    ).login(loginRequest({ ...CREDENTIALS, otp: FIXTURE.otp }));
    expect(noMfaPath.status).toBe(502);
    const badSession = await handlers(
      stubFetch((url) =>
        url.endsWith(LOGIN) ? json(200, CHALLENGE) : json(200, {}),
      ).fetch,
    ).login(loginRequest({ ...CREDENTIALS, otp: FIXTURE.otp }));
    expect(badSession.status).toBe(502);
    expect(authCounters().login_answer_invalid).toBe(5);
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
    const res2 = await handlers(mfaHang, { timeoutMs: 20 }).login(
      loginRequest({ ...CREDENTIALS, otp: FIXTURE.otp }),
    );
    expect(res2.status).toBe(504);
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
      for (const body of [CREDENTIALS, { ...CREDENTIALS, otp: FIXTURE.otp }]) {
        await handlers(stubFetch(answer).fetch).login(loginRequest(body));
      }
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
