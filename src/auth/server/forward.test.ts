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
    // No trusted hops configured: the client's header does not pass.
    expect(h?.get("x-forwarded-for")).toBeNull();
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

describe("forward: X-Forwarded-For", () => {
  const xff = async (
    chain: string | null,
    hops: number | undefined,
  ): Promise<string | null | undefined> => {
    const stub = stubFetch(() => json(200, {}));
    const req = request("/_bff/api/v1/zones", {
      cookies: signedIn,
      headers: chain === null ? {} : { "X-Forwarded-For": chain },
    });
    await forward(
      req,
      target("/v1/zones"),
      opts(stub.fetch, hops === undefined ? {} : { trustedProxyHops: hops }),
    );
    return stub.calls[0]?.headers.get("x-forwarded-for");
  };

  it("never passes a client-supplied X-Forwarded-For without trusted hops", async () => {
    expect(await xff("203.0.113.66", undefined)).toBeNull();
    expect(await xff("203.0.113.66, 192.0.2.10", undefined)).toBeNull();
  });

  it("sends the address the trusted proxy recorded, and drops what the client wrote to its left", async () => {
    // The client wrote 203.0.113.66; one Caddy appended the peer it saw.
    expect(await xff("203.0.113.66, 192.0.2.10", 1)).toBe("192.0.2.10");
    expect(await xff("192.0.2.10", 1)).toBe("192.0.2.10");
  });

  it("counts back as many hops as there are trusted proxies", async () => {
    expect(await xff("203.0.113.66, 192.0.2.10, 10.0.0.5", 2)).toBe(
      "192.0.2.10",
    );
    expect(await xff("2001:db8::7", 1)).toBe("2001:db8::7");
  });

  it("sends none, and counts it, when the chain is shorter than the hops or not an address", async () => {
    expect(await xff("192.0.2.10", 2)).toBeNull();
    expect(await xff(null, 1)).toBeNull();
    expect(await xff("unknown", 1)).toBeNull();
    expect(await xff("192.0.2.300", 1)).toBeNull();
    expect(await xff("[::1]:443", 1)).toBeNull();
    expect(authCounters().client_address_unknown).toBe(5);
  });

  it("refuses a hop count that is not a whole number of at least 1", async () => {
    await expect(xff("192.0.2.10", 0)).rejects.toThrow(RangeError);
    await expect(xff("192.0.2.10", 1.5)).rejects.toThrow(RangeError);
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

  it("refuses an encoded slash or dot segment that the allow-list would match raw (retro-audit N7)", async () => {
    for (const path of [
      "/v1/zones/..%2F..%2Fadmin",
      "/v1/zones/..%2fadmin",
      "/v1/zones/x%5C..%5Cadmin",
      "/v1/zones/%E0%A4%A",
    ]) {
      resetAuthCountersForTests();
      const stub = stubFetch(() => json(200, {}));
      const t = target(path);
      // The raw pathname still matches the allow-list...
      expect(
        ALLOW.some((re) => re.test(t.pathname)),
        path,
      ).toBe(true);
      const res = await forward(
        request("/_bff/api/v1/zones", { cookies: signedIn }),
        t,
        opts(stub.fetch),
      );
      // ...and is refused anyway.
      expect(res.status, path).toBe(404);
      expect(stub.fn, path).not.toHaveBeenCalled();
      expect(authCounters().proxy_path_refused, path).toBe(1);
    }
  });

  it("forwards an identifier with other percent-encoding (the twin)", async () => {
    const stub = stubFetch(() => json(200, {}));
    const res = await forward(
      request("/_bff/api/v1/zones", { cookies: signedIn }),
      target("/v1/zones/GEO-TEST%200001"),
      opts(stub.fetch),
    );
    expect(res.status).toBe(200);
    expect(stub.calls[0]?.url).toBe(`${API}/v1/zones/GEO-TEST%200001`);
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
  it("never passes a redirect on: a 3xx becomes a 502 problem without Location", async () => {
    for (const status of [301, 302, 303, 307, 308]) {
      const stub = stubFetch(
        () =>
          new Response(null, {
            status,
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
      expect(res.status, String(status)).toBe(502);
      expect(res.headers.get("location")).toBeNull();
      expect(await res.json()).toMatchObject({
        type: "https://schemas.uspace.ge/problems/upstream_redirect",
      });
    }
    expect(authCounters().upstream_redirect).toBe(5);
  });

  it("passes a 304 Not Modified through with its ETag (the twin: not a redirect)", async () => {
    const stub = stubFetch(
      () => new Response(null, { status: 304, headers: { ETag: '"v7"' } }),
    );
    const res = await forward(
      request("/_bff/api/v1/zones", {
        cookies: signedIn,
        headers: { "If-None-Match": '"v7"' },
      }),
      target("/v1/zones"),
      opts(stub.fetch),
    );
    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe('"v7"');
    expect(authCounters().upstream_redirect).toBe(0);
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

  it("drops the API's absolute Location and server-identifying headers (retro-audit S5)", async () => {
    for (const location of [
      "http://api:8080/v1/zones/123",
      "//api:8080/v1/zones/123",
      "HTTPS://api.internal/v1/zones/123",
      // Browsers read a backslash as a slash in a special URL.
      "\\\\api:8080/v1/zones/123",
      "/\\api:8080/v1/zones/123",
    ]) {
      const stub = stubFetch(
        () =>
          new Response("{}", {
            status: 201,
            headers: {
              Location: location,
              Server: "TEST-server/1.0",
              Via: "1.1 TEST-proxy",
              "X-Powered-By": "TEST-framework",
              "Access-Control-Allow-Origin": "http://api:8080",
              "Access-Control-Allow-Credentials": "true",
              "Access-Control-Expose-Headers": "ETag",
              ETag: '"v1"',
            },
          }),
      );
      const res = await forward(
        request("/_bff/api/v1/zones", {
          method: "POST",
          cookies: signedIn,
          headers: { "X-CSRF-Token": FIXTURE.csrf },
        }),
        target("/v1/zones"),
        opts(stub.fetch),
      );
      expect(res.status).toBe(201);
      for (const h of [
        "location",
        "server",
        "via",
        "x-powered-by",
        "access-control-allow-origin",
        "access-control-allow-credentials",
        "access-control-expose-headers",
      ]) {
        expect(res.headers.get(h), `${location} ${h}`).toBeNull();
      }
      expect(res.headers.get("etag")).toBe('"v1"');
    }
  });

  it("passes a relative Location on a 201 through (the twin)", async () => {
    const stub = stubFetch(
      () =>
        new Response("{}", {
          status: 201,
          headers: { Location: "/v1/zones/123" },
        }),
    );
    const res = await forward(
      request("/_bff/api/v1/zones", {
        method: "POST",
        cookies: signedIn,
        headers: { "X-CSRF-Token": FIXTURE.csrf },
      }),
      target("/v1/zones"),
      opts(stub.fetch),
    );
    expect(res.headers.get("location")).toBe("/v1/zones/123");
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

describe("forward: a body that stalls after the headers (retro-audit S4)", () => {
  // The API answers its headers and one chunk, then nothing; the body does
  // not watch the signal, so only the BFF's own bound can end it.
  function stalled(): { fetch: typeof fetch; signal: () => AbortSignal } {
    let seen: AbortSignal | undefined;
    const f = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(ctrl) {
              ctrl.enqueue(new TextEncoder().encode('{"features":['));
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    return {
      fetch: f as unknown as typeof fetch,
      signal: () => {
        if (seen === undefined) throw new Error("fetch was not called");
        return seen;
      },
    };
  }

  it("errors the body after timeoutMs of silence, aborts upstream and counts it", async () => {
    const up = stalled();
    const res = await forward(
      request("/_bff/api/v1/zones", { cookies: signedIn }),
      target("/v1/zones"),
      opts(up.fetch, { timeoutMs: 30 }),
    );
    expect(res.status).toBe(200);
    const read = await res.text().then(
      () => "read",
      () => "errored",
    );
    expect(read).toBe("errored");
    expect(up.signal().aborted).toBe(true);
    expect(authCounters().upstream_timeout).toBe(1);
  });

  it("streams a slow body whose chunks each come within timeoutMs (the twin)", async () => {
    const parts = ['{"a":', "1,", '"b":', "2}"];
    const slow = stubFetch(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            async start(ctrl) {
              for (const p of parts) {
                await new Promise((r) => setTimeout(r, 15));
                ctrl.enqueue(new TextEncoder().encode(p));
              }
              ctrl.close();
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    // 60 ms in all, more than timeoutMs, but never 40 ms of silence.
    const res = await forward(
      request("/_bff/api/v1/zones", { cookies: signedIn }),
      target("/v1/zones"),
      opts(slow.fetch, { timeoutMs: 40 }),
    );
    expect(await res.json()).toEqual({ a: 1, b: 2 });
    expect(authCounters().upstream_timeout).toBe(0);
  });
});
