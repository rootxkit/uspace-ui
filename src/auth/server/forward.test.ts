// forward (WP-5): the bearer from the cookie, no cookie upstream, the
// allow-list and CSRF refusals before any upstream call (each with its
// acceptance, E-01), no redirect following, the API's answer passed
// through, and the BFF's own timeout (E-14).
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authCounters, resetAuthCountersForTests } from "./counters.js";
import { forward, type ForwardOptions } from "./forward.js";
import {
  API,
  FIXTURE,
  SESSION,
  json,
  problem,
  request,
  setCookies,
  stubFetch,
} from "./testing.testing.js";

const ALLOW = [/^\/v1\/zones(\/|$)/];
const target = (path: string): URL => new URL(path, API);

function opts(
  f: typeof fetch,
  extra: Partial<ForwardOptions> = {},
): ForwardOptions {
  return {
    session: SESSION,
    allowPaths: ALLOW,
    timeoutMs: 1000,
    fetch: f,
    ...extra,
  };
}

const signedIn = {
  uspace_session: FIXTURE.jwt,
  uspace_csrf: FIXTURE.csrf,
  other: "TEST-other-cookie",
};

beforeEach(() => {
  resetAuthCountersForTests();
});

describe("forward: headers", () => {
  it("adds the bearer from the session cookie and strips Cookie", async () => {
    const stub = stubFetch(() => json(200, {}));
    const req = request("/_bff/api/v1/zones", {
      cookies: signedIn,
      headers: {
        "Accept-Language": "ka",
        Accept: "application/json",
        "If-None-Match": '"v1"',
        "X-Forwarded-For": "192.0.2.10",
        Authorization: "Bearer TEST-from-browser",
        "X-CSRF-Token": FIXTURE.csrf,
        "X-Other": "1",
      },
    });
    await forward(req, target("/v1/zones"), opts(stub.fetch));
    expect(stub.calls).toHaveLength(1);
    const h = stub.calls[0]?.headers;
    expect(h?.get("authorization")).toBe(`Bearer ${FIXTURE.jwt}`);
    expect(h?.get("cookie")).toBeNull();
    expect(h?.get("x-csrf-token")).toBeNull();
    expect(h?.get("x-other")).toBeNull();
    expect(h?.get("accept-language")).toBe("ka");
    expect(h?.get("accept")).toBe("application/json");
    expect(h?.get("if-none-match")).toBe('"v1"');
    expect(h?.get("x-forwarded-for")).toBe("192.0.2.10");
  });

  it("sends no Authorization without a session cookie, not even the browser's", async () => {
    const stub = stubFetch(() => json(401, {}));
    const req = request("/_bff/api/v1/zones", {
      headers: { Authorization: "Bearer TEST-from-browser" },
    });
    await forward(req, target("/v1/zones"), opts(stub.fetch));
    expect(stub.calls[0]?.headers.get("authorization")).toBeNull();
  });

  it("streams the body and copies Content-Type on an unsafe method", async () => {
    const stub = stubFetch(() => json(201, { id: "TEST-1" }));
    const req = request("/_bff/api/v1/zones", {
      method: "POST",
      cookies: signedIn,
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": FIXTURE.csrf,
      },
      body: '{"name":"TEST zone"}',
    });
    const res = await forward(req, target("/v1/zones"), opts(stub.fetch));
    expect(res.status).toBe(201);
    expect(stub.calls[0]?.init.method).toBe("POST");
    expect(stub.calls[0]?.headers.get("content-type")).toBe("application/json");
    expect(stub.calls[0]?.body).toBe('{"name":"TEST zone"}');
    expect(await res.json()).toEqual({ id: "TEST-1" });
  });
});

describe("forward: refusals before upstream", () => {
  it("refuses a path outside allowPaths with 404 and never calls upstream", async () => {
    const stub = stubFetch(() => json(200, {}));
    const req = request("/_bff/api/v1/users", { cookies: signedIn });
    const res = await forward(req, target("/v1/users"), opts(stub.fetch));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toMatchObject({
      type: "https://schemas.uspace.ge/problems/not_found",
      status: 404,
      errors: [],
    });
    expect(stub.fn).not.toHaveBeenCalled();
    expect(authCounters().proxy_path_refused).toBe(1);
  });

  it("forwards a path inside allowPaths (the acceptance)", async () => {
    const stub = stubFetch(() => json(200, {}));
    const req = request("/_bff/api/v1/zones/TEST-Z1", { cookies: signedIn });
    const res = await forward(
      req,
      target("/v1/zones/TEST-Z1"),
      opts(stub.fetch),
    );
    expect(res.status).toBe(200);
    expect(stub.calls[0]?.url).toBe(`${API}/v1/zones/TEST-Z1`);
  });

  it("refuses an unsafe method without the CSRF header with 403 and never calls upstream", async () => {
    const stub = stubFetch(() => json(200, {}));
    const req = request("/_bff/api/v1/zones", {
      method: "DELETE",
      cookies: signedIn,
    });
    const res = await forward(req, target("/v1/zones"), opts(stub.fetch));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      type: "https://schemas.uspace.ge/problems/csrf_refused",
    });
    expect(stub.fn).not.toHaveBeenCalled();
    expect(authCounters().csrf_refused).toBe(1);
  });

  it("forwards the same method with the CSRF pair (the acceptance)", async () => {
    const stub = stubFetch(() => new Response(null, { status: 204 }));
    const req = request("/_bff/api/v1/zones", {
      method: "DELETE",
      cookies: signedIn,
      headers: { "X-CSRF-Token": FIXTURE.csrf },
    });
    const res = await forward(req, target("/v1/zones"), opts(stub.fetch));
    expect(res.status).toBe(204);
    expect(stub.calls[0]?.init.method).toBe("DELETE");
  });
});

describe("forward: the API's answer", () => {
  it("does not follow a 302: asks fetch for manual redirects and passes it through", async () => {
    const stub = stubFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: `${API}/elsewhere` },
        }),
    );
    const res = await forward(
      request("/_bff/api/v1/zones", { cookies: signedIn }),
      target("/v1/zones"),
      opts(stub.fetch),
    );
    expect(stub.calls[0]?.init.redirect).toBe("manual");
    expect(stub.calls).toHaveLength(1);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${API}/elsewhere`);
  });

  it("passes Retry-After, ETag, Sunset and a problem body through unchanged", async () => {
    const upstream = problem(429, "rate_limited", {
      "Retry-After": "30",
      ETag: '"v7"',
      Sunset: "Sat, 01 May 2027 00:00:00 GMT",
    });
    const body = await upstream.clone().text();
    const stub = stubFetch(() => upstream);
    const res = await forward(
      request("/_bff/api/v1/zones", { cookies: signedIn }),
      target("/v1/zones"),
      opts(stub.fetch),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.get("etag")).toBe('"v7"');
    expect(res.headers.get("sunset")).toBe("Sat, 01 May 2027 00:00:00 GMT");
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.text()).toBe(body);
  });

  it("removes hop-by-hop headers, cookies and the encoding fetch already undid", async () => {
    const stub = stubFetch(
      () =>
        new Response("{}", {
          status: 200,
          headers: {
            Connection: "keep-alive",
            "Keep-Alive": "timeout=5",
            Trailer: "x",
            Upgrade: "h2c",
            "Proxy-Authenticate": "Basic",
            "Set-Cookie": "upstream=TEST; Path=/",
            "Content-Encoding": "gzip",
            "X-Request-Id": "TEST-req-1",
          },
        }),
    );
    const res = await forward(
      request("/_bff/api/v1/zones", { cookies: signedIn }),
      target("/v1/zones"),
      opts(stub.fetch),
    );
    for (const h of [
      "connection",
      "keep-alive",
      "trailer",
      "upgrade",
      "proxy-authenticate",
      "content-encoding",
    ]) {
      expect(res.headers.get(h), h).toBeNull();
    }
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(res.headers.get("x-request-id")).toBe("TEST-req-1");
  });

  it("clears both cookies on a 401: the session is gone", async () => {
    const stub = stubFetch(() => problem(401, "unauthenticated"));
    const res = await forward(
      request("/_bff/api/v1/zones", { cookies: signedIn }),
      target("/v1/zones"),
      opts(stub.fetch),
    );
    expect(res.status).toBe(401);
    const jar = setCookies(res);
    expect(jar.get("uspace_session")?.attrs["max-age"]).toBe("0");
    expect(jar.get("uspace_csrf")?.attrs["max-age"]).toBe("0");
  });

  it("leaves the cookies alone on any other answer (the twin)", async () => {
    for (const status of [200, 403, 500]) {
      const stub = stubFetch(() => json(status, {}));
      const res = await forward(
        request("/_bff/api/v1/zones", { cookies: signedIn }),
        target("/v1/zones"),
        opts(stub.fetch),
      );
      expect(res.headers.getSetCookie(), String(status)).toEqual([]);
    }
  });
});

describe("forward: upstream failures", () => {
  it("times out with its own controller and answers 504 with a problem body", async () => {
    let signal: AbortSignal | undefined;
    const hang = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const req = request("/_bff/api/v1/zones", { cookies: signedIn });
    const res = await forward(
      req,
      target("/v1/zones"),
      opts(hang as unknown as typeof fetch, { timeoutMs: 20 }),
    );
    expect(res.status).toBe(504);
    expect(await res.json()).toMatchObject({
      type: "https://schemas.uspace.ge/problems/upstream_timeout",
      status: 504,
    });
    // Its own controller, not the browser request's signal (E-14).
    expect(signal).toBeDefined();
    expect(signal).not.toBe(req.signal);
    expect(signal?.aborted).toBe(true);
    expect(req.signal.aborted).toBe(false);
    expect(authCounters().upstream_timeout).toBe(1);
  });

  it("answers 502 with a problem body when the API cannot be reached", async () => {
    const down = vi.fn(() => Promise.reject(new TypeError("fetch failed")));
    const res = await forward(
      request("/_bff/api/v1/zones", { cookies: signedIn }),
      target("/v1/zones"),
      opts(down as unknown as typeof fetch),
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      type: "https://schemas.uspace.ge/problems/upstream_unreachable",
    });
    expect(authCounters().upstream_unreachable).toBe(1);
  });

  it("answers before the timeout and leaves no timer behind (the twin)", async () => {
    vi.useFakeTimers();
    try {
      const stub = stubFetch(() => json(200, {}));
      const res = await forward(
        request("/_bff/api/v1/zones", { cookies: signedIn }),
        target("/v1/zones"),
        opts(stub.fetch, { timeoutMs: 50 }),
      );
      expect(res.status).toBe(200);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
