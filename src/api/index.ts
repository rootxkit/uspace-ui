// `@rootxkit/uspace-ui/api`: the typed fetch client, RFC 9457 problem
// errors and freshness (docs/PLAN.md §3.7). The generator that writes the
// app's `paths` is the `uspace-ui-gen-api` bin of this package.
export {
  createClient,
  DEFAULT_TIMEOUT_MS,
  type Client,
  type ClientOptions,
} from "./client.js";
export {
  apiCounters,
  resetApiCountersForTests,
  SUNSET_NOTICE_LIMIT,
  sunsetNotices,
  type ApiCounter,
  type SunsetNotice,
} from "./counters.js";
export {
  ApiError,
  fieldErrorsOf,
  retryAfterSOf,
  type ApiErrorInit,
} from "./error.js";
export { parseProblem, PROBLEM_TYPE_PREFIX, problemSlug } from "./problem.js";
