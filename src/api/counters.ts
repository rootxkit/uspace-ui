// What the API adapter met and could not use is counted as well as handled
// (CLAUDE.md rule 9, LESSONS E-09); WP-8's status components read these.

/** @beta */
export type ApiCounter =
  /** A response that carried a `Sunset` header: its API major is deprecated. */
  | "sunset_seen"
  /** A distinct `Sunset` value past the notice bound: counted, not kept. */
  | "sunset_notice_dropped"
  /** An `application/problem+json` body that was not a problem (RFC 9457). */
  | "problem_malformed"
  /** An entry of a problem's `errors` that was not `{field, reason}`. */
  | "field_error_malformed"
  /** A `Retry-After` that was neither delay-seconds nor an HTTP-date. */
  | "retry_after_malformed"
  /** A `401` answer; `onUnauthorized` is called on the first of a run. */
  | "unauthorized";

const counts: Record<ApiCounter, number> = {
  sunset_seen: 0,
  sunset_notice_dropped: 0,
  problem_malformed: 0,
  field_error_malformed: 0,
  retry_after_malformed: 0,
  unauthorized: 0,
};

export function countApi(counter: ApiCounter, by = 1): void {
  counts[counter] += by;
}

/**
 * A snapshot of the API counters since the page loaded.
 *
 * @beta
 */
export function apiCounters(): Readonly<Record<ApiCounter, number>> {
  return { ...counts };
}

/**
 * A deprecated API major, noticed through its `Sunset` header (00 §7).
 *
 * @beta
 */
export interface SunsetNotice {
  /** The `Sunset` header as the API sent it (an HTTP-date, RFC 8594). */
  sunset: string;
  /** The OpenAPI path template of the first request that saw it (no ids). */
  schemaPath: string;
}

// A store bound, not a threshold: an app talks to one API, which has at
// most a few majors in sunset at once.
/** @beta */
export const SUNSET_NOTICE_LIMIT = 16;

const notices = new Map<string, SunsetNotice>();

/**
 * Records a `Sunset` header. Returns true the first time a value is seen,
 * which is when the caller warns; every sighting is counted.
 */
export function noteSunset(sunset: string, schemaPath: string): boolean {
  countApi("sunset_seen");
  if (notices.has(sunset)) return false;
  if (notices.size >= SUNSET_NOTICE_LIMIT) {
    countApi("sunset_notice_dropped");
    return false;
  }
  notices.set(sunset, { sunset, schemaPath });
  return true;
}

/**
 * The distinct `Sunset` values seen since the page loaded, oldest first.
 *
 * @beta
 */
export function sunsetNotices(): readonly SunsetNotice[] {
  return [...notices.values()];
}

/**
 * Tests only: start the counters and notices again (LESSONS E-11).
 *
 * @beta
 */
export function resetApiCountersForTests(): void {
  for (const k of Object.keys(counts) as ApiCounter[]) counts[k] = 0;
  notices.clear();
}
