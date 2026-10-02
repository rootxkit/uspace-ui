// createClient against an in-process fetch stub (no network), typed by the
// `paths` generated from fixture.yaml (types.test.ts generates them and
// type-checks this file). Every refusal has its acceptance (LESSONS E-01).
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createClient, type ClientOptions } from "../client.js";
import {
  apiCounters,
  resetApiCountersForTests,
  SUNSET_NOTICE_LIMIT,
  sunsetNotices,
} from "../counters.js";
import { ApiError, fieldErrorsOf } from "../error.js";
import type { paths } from "./generated/fixture.js";

const NOW_MS = Date.UTC(2026, 9, 2, 10, 0, 0);
const PROBLEM = "application/problem+json";
// Node has no page to resolve a relative URL against; a browser uses
// "/_bff/api". The .invalid name is reserved and never resolves (RFC 6761).
const BASE_URL = "http://bff.invalid/_bff/api";

interface Stub {
  fetch: typeof fetch;
  seen: Request[];
}

function stub(answer: (req: Request) => Response | Promise<Response>): Stub {
  const seen: Request[] = [];
  const f: typeof fetch = async (input) => {
    if (!(input instanceof Request)) throw new Error("expected a Request");
    seen.push(input);
    return answer(input);
  };
  return { fetch: f, seen };
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

function problem(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": `${PROBLEM}; charset=utf-8`, ...headers },
  });
}

const ZONES = {
  cis_dataset: "zones",
  cis_version: 42,
  cis_updated_at: "2026-10-02T09:59:00Z",
  cis_age_s: 60,
  features: [{ identifier: "GEO-TEST-0001" }],
};

function client(s: Stub, opts: Partial<ClientOptions> = {}) {
  return createClient<paths>({
    baseUrl: BASE_URL,
    fetch: s.fetch,
    now: () => NOW_MS,
    ...opts,
  });
}

async function rejection(p: Promise<unknown>): Promise<ApiError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

afterEach(() => {
  resetApiCountersForTests();
});

describe("createClient: success", () => {
  it("passes 2xx data through, typed, same-origin, to the base URL", async () => {
    const s = stub(() => json(ZONES));
    const { data, response } = await client(s).GET("/v1/zones", {
      params: { query: { applies_at: "2026-10-02T10:00:00Z" } },
    });
    expect(data?.cis_version).toBe(42);
    expect(data?.features[0]?.identifier).toBe("GEO-TEST-0001");
    expect(response.status).toBe(200);
    expect(s.seen).toHaveLength(1);
    const req = s.seen[0];
    expect(req?.credentials).toBe("same-origin");
    expect(new URL(req?.url ?? "").pathname).toBe("/_bff/api/v1/zones");
    expect(new URL(req?.url ?? "").searchParams.get("applies_at")).toBe(
      "2026-10-02T10:00:00Z",
    );
  });

  it("sends a POST body through the timeout re-wrap intact", async () => {
    const s = stub(async (req) => {
      const body = (await req.json()) as { text: string };
      return json({ id: "TEST1", text: body.text }, { status: 201 });
    });
    const { data } = await client(s).POST("/v1/zones/{identifier}/notes", {
      params: { path: { identifier: "GEO-TEST-0001" } },
      body: { text: "checked" },
    });
    expect(data).toEqual({ id: "TEST1", text: "checked" });
    expect(new URL(s.seen[0]?.url ?? "").pathname).toBe(
      "/_bff/api/v1/zones/GEO-TEST-0001/notes",
    );
  });

  it("resolves a 204 without data", async () => {
    const s = stub(() => new Response(null, { status: 204 }));
    const { data, response } = await client(s).DELETE("/v1/notes/{id}", {
      params: { path: { id: "TEST1" } },
    });
    expect(data).toBeUndefined();
    expect(response.status).toBe(204);
  });
});

describe("createClient: problem errors", () => {
  it("turns a 404 problem into ApiError with field errors, slug and truncated", async () => {
    const body = {
      type: "https://schemas.uspace.ge/problems/not_found",
      title: "No such zone",
      status: 404,
      detail: "GEO-TEST-0009 is not in the dataset",
      instance: "/v1/zones/GEO-TEST-0009/notes",
      errors: [{ field: "$.identifier", reason: "unknown" }],
      truncated: true,
      extension: "ignored",
    };
    const s = stub(() => problem(body, 404, { "X-Request-Id": "TEST-REQ-1" }));
    const err = await rejection(
      client(s).POST("/v1/zones/{identifier}/notes", {
        params: { path: { identifier: "GEO-TEST-0009" } },
        body: { text: "x" },
      }),
    );
    expect(err.status).toBe(404);
    expect(err.slug).toBe("not_found");
    expect(err.requestId).toBe("TEST-REQ-1");
    expect(err.retryAfterS).toBeNull();
    expect(err.sunset).toBeNull();
    expect(err.message).toBe("request failed, status 404: No such zone");
    expect(err.problem).toEqual({
      type: body.type,
      title: body.title,
      status: 404,
      detail: body.detail,
      instance: body.instance,
      errors: [{ field: "$.identifier", reason: "unknown" }],
      truncated: true,
    });
    expect(fieldErrorsOf(err)).toEqual([
      { field: "$.identifier", reason: "unknown" },
    ]);
  });

  it("gives slug null for a type outside the problems namespace, and keeps the title", async () => {
    const s = stub(() =>
      problem(
        {
          type: "https://problems.invalid/not_found",
          title: "Gone",
          status: 404,
        },
        404,
      ),
    );
    const err = await rejection(client(s).GET("/v1/zones"));
    expect(err.slug).toBeNull();
    expect(err.problem?.title).toBe("Gone");
    expect(err.problem?.errors).toEqual([]);
    expect(err.problem).not.toHaveProperty("truncated");
  });

  it("turns a 404 with a plain body into problem null and a status message", async () => {
    const s = stub(
      () =>
        new Response("not here", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    const err = await rejection(client(s).GET("/v1/zones"));
    expect(err.problem).toBeNull();
    expect(err.slug).toBeNull();
    expect(err.requestId).toBeNull();
    expect(err.message).toBe("request failed, status 404");
    expect(fieldErrorsOf(err)).toEqual([]);
  });

  it("counts a problem body that does not parse and degrades to problem null", async () => {
    const s = stub(
      () =>
        new Response("{not json", {
          status: 500,
          headers: { "Content-Type": PROBLEM },
        }),
    );
    const err = await rejection(client(s).GET("/v1/zones"));
    expect(err.problem).toBeNull();
    expect(apiCounters().problem_malformed).toBe(1);
  });
});

describe("createClient: refusals are data, never retried (B-10)", () => {
  it("gives retryAfterS 7 for 503 + Retry-After: 7 and sends exactly once", async () => {
    const s = stub(() =>
      problem(
        {
          type: "https://schemas.uspace.ge/problems/cis_stale",
          title: "CIS stale",
          status: 503,
        },
        503,
        { "Retry-After": "7" },
      ),
    );
    const err = await rejection(client(s).GET("/v1/zones"));
    expect(err.status).toBe(503);
    expect(err.retryAfterS).toBe(7);
    expect(err.slug).toBe("cis_stale");
    expect(s.seen).toHaveLength(1);
  });

  it("converts an HTTP-date Retry-After against the fixed now", async () => {
    const s = stub(
      () =>
        new Response(null, {
          status: 503,
          headers: { "Retry-After": "Fri, 02 Oct 2026 10:00:30 GMT" },
        }),
    );
    const err = await rejection(client(s).GET("/v1/zones"));
    expect(err.retryAfterS).toBe(30);
  });

  it("does not resend an unsafe request that was refused", async () => {
    const s = stub(
      () =>
        new Response(null, { status: 503, headers: { "Retry-After": "1" } }),
    );
    await rejection(
      client(s).PUT("/v1/notes/{id}", {
        params: { path: { id: "TEST1" } },
        body: { text: "x" },
      }),
    );
    expect(s.seen).toHaveLength(1);
  });
});

describe("createClient: 401", () => {
  it("calls onUnauthorized exactly once over two failures, and again after a success", async () => {
    let status = 401;
    const s = stub(() =>
      status === 200
        ? json(ZONES)
        : problem(
            {
              type: "https://schemas.uspace.ge/problems/unauthenticated",
              title: "Sign in",
              status: 401,
            },
            401,
          ),
    );
    const onUnauthorized = vi.fn();
    const api = client(s, { onUnauthorized });

    const first = await rejection(api.GET("/v1/zones"));
    await rejection(api.GET("/v1/zones"));
    expect(first.slug).toBe("unauthenticated");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    status = 200;
    await api.GET("/v1/zones");
    status = 401;
    await rejection(api.GET("/v1/zones"));
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
    expect(apiCounters().unauthorized).toBe(3);
  });

  it("does not call onUnauthorized on a 403", async () => {
    const s = stub(() => new Response(null, { status: 403 }));
    const onUnauthorized = vi.fn();
    await rejection(client(s, { onUnauthorized }).GET("/v1/zones"));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("createClient: headers", () => {
  const csrfToken = (): string | null => "TEST-CSRF";

  it("sends X-CSRF-Token on POST, PUT, PATCH and DELETE", async () => {
    const s = stub((req) =>
      req.method === "DELETE"
        ? new Response(null, { status: 204 })
        : json({ id: "TEST1", text: "x" }),
    );
    const api = client(s, { csrfToken });
    const path = { params: { path: { id: "TEST1" } } };
    await api.POST("/v1/zones/{identifier}/notes", {
      params: { path: { identifier: "GEO-TEST-0001" } },
      body: { text: "x" },
    });
    await api.PUT("/v1/notes/{id}", { ...path, body: { text: "x" } });
    await api.PATCH("/v1/notes/{id}", { ...path, body: { text: "x" } });
    await api.DELETE("/v1/notes/{id}", path);
    expect(
      s.seen.map((r) => [r.method, r.headers.get("X-CSRF-Token")]),
    ).toEqual([
      ["POST", "TEST-CSRF"],
      ["PUT", "TEST-CSRF"],
      ["PATCH", "TEST-CSRF"],
      ["DELETE", "TEST-CSRF"],
    ]);
  });

  it("does not send X-CSRF-Token on GET", async () => {
    const s = stub(() => json(ZONES));
    await client(s, { csrfToken }).GET("/v1/zones");
    expect(s.seen[0]?.headers.has("X-CSRF-Token")).toBe(false);
  });

  it("sends no X-CSRF-Token when there is no token to send", async () => {
    const s = stub(() => new Response(null, { status: 204 }));
    await client(s, { csrfToken: () => null }).DELETE("/v1/notes/{id}", {
      params: { path: { id: "TEST1" } },
    });
    expect(s.seen[0]?.headers.has("X-CSRF-Token")).toBe(false);
  });

  it("sends Accept-Language as lang() says at each request", async () => {
    const s = stub(() => json(ZONES));
    let lang: "ka" | "en" = "ka";
    const api = client(s, { lang: () => lang });
    await api.GET("/v1/zones");
    lang = "en";
    await api.GET("/v1/zones");
    expect(s.seen.map((r) => r.headers.get("Accept-Language"))).toEqual([
      "ka",
      "en",
    ]);
  });

  it("leaves Accept-Language to the browser without lang", async () => {
    const s = stub(() => json(ZONES));
    await client(s).GET("/v1/zones");
    expect(s.seen[0]?.headers.has("Accept-Language")).toBe(false);
  });
});

describe("createClient: timeout", () => {
  function hanging(): Stub {
    return stub(
      (req) =>
        new Promise<Response>((_, reject) => {
          // As the platform's fetch does with a signal already aborted.
          if (req.signal.aborted) reject(req.signal.reason as Error);
          req.signal.addEventListener("abort", () =>
            reject(req.signal.reason as Error),
          );
        }),
    );
  }

  it("aborts a request that outlives timeoutMs", async () => {
    const err = await client(hanging(), { timeoutMs: 20 })
      .GET("/v1/zones")
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("TimeoutError");
  });

  it("still honours the caller's own signal", async () => {
    const controller = new AbortController();
    const pending = client(hanging(), { timeoutMs: 60_000 }).GET("/v1/zones", {
      signal: controller.signal,
    });
    controller.abort();
    const err = await pending.then(
      () => null,
      (e: unknown) => e,
    );
    expect((err as DOMException).name).toBe("AbortError");
  });

  it("still times out after a garbage collection (CI found a signal collected)", async () => {
    // AbortSignal.timeout and AbortSignal.any are held weakly by Node: with
    // nothing else referencing them, a collection drops the timeout and the
    // request hangs. The client's own controller must survive one.
    setFlagsFromString("--expose-gc");
    const gc = runInNewContext("gc") as () => void;
    const pending = client(hanging(), { timeoutMs: 50 })
      .GET("/v1/zones")
      .then(
        () => null,
        (e: unknown) => e,
      );
    await new Promise((r) => setTimeout(r, 10));
    gc();
    const err = await pending;
    expect((err as DOMException).name).toBe("TimeoutError");
  });

  it("answers a request that comes back within timeoutMs, and clears its timer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const s = stub(() => json(ZONES));
      const { data } = await client(s, { timeoutMs: 20 }).GET("/v1/zones");
      expect(data?.cis_version).toBe(42);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the timer of a request whose fetch fails, and passes the failure on", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const s = stub(() => Promise.reject(new TypeError("network down")));
      const err = await client(s, { timeoutMs: 20 })
        .GET("/v1/zones")
        .then(
          () => null,
          (e: unknown) => e,
        );
      expect(err).toBeInstanceOf(TypeError);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the timer running while no answer has come", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const pending = client(hanging(), { timeoutMs: 20 })
        .GET("/v1/zones")
        .then(
          () => null,
          (e: unknown) => e,
        );
      // setImmediate is not faked: it lets the request reach the stub.
      await new Promise((r) => setImmediate(r));
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(20);
      expect(((await pending) as DOMException).name).toBe("TimeoutError");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createClient: Sunset", () => {
  const SUNSET = "Thu, 01 Apr 2027 00:00:00 GMT";

  it("warns once per Sunset value and counts every sighting", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = stub(() => json(ZONES, { headers: { Sunset: SUNSET } }));
    const api = client(s);
    await api.GET("/v1/zones");
    await api.GET("/v1/zones");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(
      `GET /v1/zones answered with Sunset: ${SUNSET}`,
    );
    expect(apiCounters().sunset_seen).toBe(2);
    expect(sunsetNotices()).toEqual([
      { sunset: SUNSET, schemaPath: "/v1/zones" },
    ]);
  });

  it("does not warn or count without a Sunset header", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await client(stub(() => json(ZONES))).GET("/v1/zones");
    expect(warn).not.toHaveBeenCalled();
    expect(apiCounters().sunset_seen).toBe(0);
    expect(sunsetNotices()).toEqual([]);
  });

  it("carries Sunset on an ApiError", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const s = stub(
      () => new Response(null, { status: 410, headers: { Sunset: SUNSET } }),
    );
    const err = await rejection(client(s).GET("/v1/zones"));
    expect(err.sunset).toBe(SUNSET);
  });

  it("keeps at most SUNSET_NOTICE_LIMIT notices and counts the rest (E-10)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let n = 0;
    const s = stub(() => {
      n += 1;
      return json(ZONES, {
        headers: {
          Sunset: `Thu, ${String(n).padStart(2, "0")} Apr 2027 00:00:00 GMT`,
        },
      });
    });
    const api = client(s);
    for (let i = 0; i <= SUNSET_NOTICE_LIMIT; i += 1)
      await api.GET("/v1/zones");
    expect(sunsetNotices()).toHaveLength(SUNSET_NOTICE_LIMIT);
    expect(warn).toHaveBeenCalledTimes(SUNSET_NOTICE_LIMIT);
    expect(apiCounters().sunset_notice_dropped).toBe(1);
    expect(apiCounters().sunset_seen).toBe(SUNSET_NOTICE_LIMIT + 1);
  });
});
