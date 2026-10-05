// The error a non-2xx answer becomes (docs/PLAN.md §3.7). It is data for
// the status components and the form kit, never a reason to retry: a
// `503` with `Retry-After` is a refusal the status components render as
// "refused, retry in N s" (LESSONS B-10), not an error of the console.
import type { FieldError, Problem } from "../model/index.js";

import { countApi } from "./counters.js";
import { problemSlug } from "./problem.js";

const DELAY_SECONDS = /^\d+$/;
// Every HTTP-date form (IMF-fixdate, RFC 850, asctime) starts with the day
// name; without this, Date.parse would take "-5" or "7.5" for a year.
const HTTP_DATE = /^[A-Za-z]{3,9},? /;

/**
 * `Retry-After` in seconds from now (RFC 9110 §10.2.3): delay-seconds as
 * they are, an HTTP-date as the whole seconds from `nowMs` to it (0 when it
 * has passed). `null` when the header is absent; `null` and a count when it
 * is neither form.
 *
 * @beta
 */
export function retryAfterSOf(
  value: string | null,
  nowMs: number,
): number | null {
  if (value === null) return null;
  const v = value.trim();
  if (DELAY_SECONDS.test(v)) return Number(v);
  const atMs = HTTP_DATE.test(v) ? Date.parse(v) : Number.NaN;
  if (Number.isNaN(atMs)) {
    countApi("retry_after_malformed");
    return null;
  }
  return Math.max(0, Math.ceil((atMs - nowMs) / 1000));
}

/** @public */
export interface ApiErrorInit {
  status: number;
  problem: Problem | null;
  retryAfterS: number | null;
  requestId: string | null;
  sunset: string | null;
}

/**
 * A non-2xx answer from an API, with what it said about itself.
 *
 * @public
 */
export class ApiError extends Error {
  override readonly name = "ApiError";
  /** The HTTP status of the answer. */
  readonly status: number;
  /** The problem body when the answer was `application/problem+json`. */
  readonly problem: Problem | null;
  /** The refusal name off `problem.type` (`cis_stale`, ...), else `null`. */
  readonly slug: string | null;
  /** Seconds the API asked the client to wait (B-10); never acted on here. */
  readonly retryAfterS: number | null;
  /** `X-Request-Id` of the answer, for a support ticket. */
  readonly requestId: string | null;
  /** The `Sunset` header of the answer: the API major is deprecated. */
  readonly sunset: string | null;

  constructor(init: ApiErrorInit) {
    super(
      init.problem === null
        ? `request failed, status ${init.status}`
        : `request failed, status ${init.status}: ${init.problem.title}`,
    );
    this.status = init.status;
    this.problem = init.problem;
    this.slug = init.problem === null ? null : problemSlug(init.problem.type);
    this.retryAfterS = init.retryAfterS;
    this.requestId = init.requestId;
    this.sunset = init.sunset;
  }
}

/**
 * The field errors of a problem, for the form kit (WP-10): from an
 * `ApiError` carrying a problem, `[]` for anything else.
 *
 * @public
 */
export function fieldErrorsOf(err: unknown): FieldError[] {
  if (err instanceof ApiError && err.problem !== null)
    return [...err.problem.errors];
  return [];
}
