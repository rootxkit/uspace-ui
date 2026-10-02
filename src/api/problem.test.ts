// Problem parsing (RFC 9457 in the M28 shape), the slug, Retry-After and
// fieldErrorsOf, without a client.
import { afterEach, describe, expect, it } from "vitest";

import { apiCounters, resetApiCountersForTests } from "./counters.js";
import { ApiError, fieldErrorsOf, retryAfterSOf } from "./error.js";
import {
  parseProblem,
  PROBLEM_TYPE_PREFIX,
  problemSlug,
  toProblem,
} from "./problem.js";

const NOW_MS = Date.UTC(2026, 9, 2, 10, 0, 0);

function body(
  value: unknown,
  type = "application/problem+json",
  status = 400,
): Response {
  return new Response(
    typeof value === "string" ? value : JSON.stringify(value),
    {
      status,
      headers: { "Content-Type": type },
    },
  );
}

afterEach(() => {
  resetApiCountersForTests();
});

describe("problemSlug", () => {
  it("reads the slug off a problems type", () => {
    expect(problemSlug(`${PROBLEM_TYPE_PREFIX}cis_stale`)).toBe("cis_stale");
    expect(problemSlug(`${PROBLEM_TYPE_PREFIX}not_a_publisher`)).toBe(
      "not_a_publisher",
    );
  });

  it("gives null outside the namespace or for a slug that is not a name", () => {
    expect(problemSlug("about:blank")).toBeNull();
    expect(problemSlug("https://problems.invalid/cis_stale")).toBeNull();
    expect(problemSlug(PROBLEM_TYPE_PREFIX)).toBeNull();
    expect(problemSlug(`${PROBLEM_TYPE_PREFIX}cis_stale/extra`)).toBeNull();
    expect(problemSlug(`${PROBLEM_TYPE_PREFIX}CIS_STALE`)).toBeNull();
  });
});

describe("parseProblem", () => {
  it("parses application/problem+json, with a charset parameter", async () => {
    const p = await parseProblem(
      body(
        {
          type: `${PROBLEM_TYPE_PREFIX}validation`,
          title: "Invalid",
          status: 422,
          errors: [],
        },
        "Application/Problem+JSON; charset=utf-8",
      ),
    );
    expect(p).toEqual({
      type: `${PROBLEM_TYPE_PREFIX}validation`,
      title: "Invalid",
      status: 422,
      detail: null,
      instance: null,
      errors: [],
    });
  });

  it("gives null for another content type, without counting", async () => {
    expect(
      await parseProblem(body({ title: "x" }, "application/json")),
    ).toBeNull();
    expect(await parseProblem(new Response("x", { status: 500 }))).toBeNull();
    expect(apiCounters().problem_malformed).toBe(0);
  });

  it("gives null and counts a body that is not JSON or not a problem", async () => {
    expect(await parseProblem(body("{"))).toBeNull();
    expect(await parseProblem(body([1, 2]))).toBeNull();
    expect(await parseProblem(body({ type: "about:blank" }))).toBeNull();
    expect(await parseProblem(body({ type: 7, title: "x" }))).toBeNull();
    expect(apiCounters().problem_malformed).toBe(4);
  });
});

describe("toProblem", () => {
  it("takes about:blank for an absent type and the response status for an absent one", () => {
    expect(toProblem({ title: "Bad" }, 400)).toEqual({
      type: "about:blank",
      title: "Bad",
      status: 400,
      detail: null,
      instance: null,
      errors: [],
    });
    expect(toProblem({ title: "Bad", status: "400" }, 418)?.status).toBe(418);
  });

  it("drops and counts a malformed errors entry, keeping the good ones", () => {
    const p = toProblem(
      {
        title: "Invalid",
        errors: [
          { field: "$.a", reason: "required" },
          { field: "$.b" },
          "x",
          { field: "$.c", reason: "range" },
        ],
      },
      422,
    );
    expect(p?.errors).toEqual([
      { field: "$.a", reason: "required" },
      { field: "$.c", reason: "range" },
    ]);
    expect(apiCounters().field_error_malformed).toBe(2);
  });

  it("counts an errors member that is not a list", () => {
    expect(toProblem({ title: "Invalid", errors: {} }, 422)?.errors).toEqual(
      [],
    );
    expect(apiCounters().field_error_malformed).toBe(1);
  });

  it("keeps truncated as sent, false included, and leaves it out when absent", () => {
    expect(toProblem({ title: "x", truncated: false }, 422)?.truncated).toBe(
      false,
    );
    expect(toProblem({ title: "x", truncated: "yes" }, 422)).not.toHaveProperty(
      "truncated",
    );
  });
});

describe("retryAfterSOf", () => {
  it("reads delay-seconds", () => {
    expect(retryAfterSOf("7", NOW_MS)).toBe(7);
    expect(retryAfterSOf(" 0 ", NOW_MS)).toBe(0);
  });

  it("converts an HTTP-date against now, rounding up, 0 once passed", () => {
    expect(retryAfterSOf("Fri, 02 Oct 2026 10:00:30 GMT", NOW_MS)).toBe(30);
    expect(retryAfterSOf("Fri, 02 Oct 2026 10:00:30 GMT", NOW_MS + 500)).toBe(
      30,
    );
    expect(retryAfterSOf("Fri, 02 Oct 2026 09:59:00 GMT", NOW_MS)).toBe(0);
  });

  it("gives null for an absent header without counting, and counts a malformed one", () => {
    expect(retryAfterSOf(null, NOW_MS)).toBeNull();
    expect(apiCounters().retry_after_malformed).toBe(0);
    expect(retryAfterSOf("soon", NOW_MS)).toBeNull();
    expect(retryAfterSOf("-5", NOW_MS)).toBeNull();
    expect(apiCounters().retry_after_malformed).toBe(2);
  });
});

describe("fieldErrorsOf", () => {
  const problem = {
    type: `${PROBLEM_TYPE_PREFIX}validation`,
    title: "Invalid",
    status: 422,
    detail: null,
    instance: null,
    errors: [{ field: "$.text", reason: "required" }],
  };

  it("gives the field errors of an ApiError with a problem, as a copy", () => {
    const err = new ApiError({
      status: 422,
      problem,
      retryAfterS: null,
      requestId: null,
      sunset: null,
    });
    const errors = fieldErrorsOf(err);
    expect(errors).toEqual([{ field: "$.text", reason: "required" }]);
    errors.pop();
    expect(err.problem?.errors).toHaveLength(1);
  });

  it("gives [] for anything else", () => {
    expect(
      fieldErrorsOf(
        new ApiError({
          status: 500,
          problem: null,
          retryAfterS: null,
          requestId: null,
          sunset: null,
        }),
      ),
    ).toEqual([]);
    expect(fieldErrorsOf(new Error("x"))).toEqual([]);
    expect(fieldErrorsOf(problem)).toEqual([]);
    expect(fieldErrorsOf(null)).toEqual([]);
  });
});

describe("ApiError", () => {
  it("names itself and its status", () => {
    const err = new ApiError({
      status: 503,
      problem: null,
      retryAfterS: 7,
      requestId: "TEST-REQ",
      sunset: null,
    });
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("request failed, status 503");
  });
});
