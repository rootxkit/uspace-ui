// The typed fetch client every web/ talks to its BFF with (docs/PLAN.md
// §3.7, §11): openapi-fetch typed by the app's generated `paths`, plus the
// session contract of §6.3 (same-origin cookie, `X-CSRF-Token` on unsafe
// methods), `Accept-Language`, a per-request timeout, and every non-2xx
// turned into an `ApiError`.
//
// There is no retry here, of any kind: a publication, a switch or an
// acknowledgement sent twice is an audit problem (utm "do not add retry
// loops around commands that have side effects"). `retryAfterS` is data
// for the status components (B-10).
import createFetchClient, {
  type Client as FetchClient,
  type Middleware,
} from "openapi-fetch";

import type { Lang } from "../i18n/lang.js";

import { countApi, noteSunset } from "./counters.js";
import { ApiError, retryAfterSOf } from "./error.js";
import { parseProblem } from "./problem.js";

/**
 * A display-only constant, not a threshold: how long a console waits for
 * one answer before it gives up and shows the failure. An app overrides it
 * with `timeoutMs`.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface ClientOptions {
  /** Where the API is, as the browser sees it (the BFF: `/_bff/api`). */
  baseUrl: string;
  /** The fetch to use; the platform's by default. */
  fetch?: typeof fetch;
  /** The `uspace_csrf` cookie's value, sent as `X-CSRF-Token` on unsafe methods. */
  csrfToken?: () => string | null;
  /** Called on the first `401` of a run; again only after a 2xx in between. */
  onUnauthorized?(): void;
  /** The console's language, sent as `Accept-Language`. */
  lang?: () => Lang;
  /** Per-request timeout; `DEFAULT_TIMEOUT_MS` when absent. */
  timeoutMs?: number;
  /** The clock an HTTP-date `Retry-After` is measured from; `Date.now` by default. */
  now?: () => number;
}

/** The client: openapi-fetch's, typed by the app's generated `paths`. */
// `Paths extends {}` is openapi-fetch's own constraint (PLAN §3.7).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type Client<Paths extends {}> = FetchClient<Paths>;

/**
 * A client for one system's API. `Paths` is the app's `paths`, generated
 * with `uspace-ui-gen-api` from the system's `api/openapi.yaml`; never
 * written by hand (CLAUDE.md rule 8). A non-2xx answer rejects with an
 * `ApiError`; a 2xx resolves with `{ data, response }`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function createClient<Paths extends {}>(
  opts: ClientOptions,
): Client<Paths> {
  const client = createFetchClient<Paths>({
    baseUrl: opts.baseUrl,
    credentials: "same-origin",
    ...(opts.fetch === undefined ? {} : { fetch: opts.fetch }),
  });
  client.use(kitMiddleware(opts));
  return client;
}

function kitMiddleware(opts: ClientOptions): Middleware {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = opts.now ?? Date.now;
  // One call per run of 401s: a page of ten requests that all find the
  // session gone asks for one re-login, not ten.
  let unauthorizedArmed = true;
  // What ends a request's timeout once its answer, or its failure, is in.
  const settle = new WeakMap<Request, () => void>();
  const settled = (request: Request): void => {
    settle.get(request)?.();
    settle.delete(request);
  };

  return {
    onRequest({ request }) {
      if (opts.lang !== undefined)
        request.headers.set("Accept-Language", opts.lang());
      if (UNSAFE_METHODS.has(request.method) && opts.csrfToken !== undefined) {
        const token = opts.csrfToken();
        if (token !== null) request.headers.set("X-CSRF-Token", token);
      }
      // One controller per request, held by its timer and by the caller's
      // signal until the answer comes. Not AbortSignal.timeout or
      // AbortSignal.any: the platform holds those weakly, so an unreferenced
      // one can be collected and its timeout never fires.
      const controller = new AbortController();
      const abort = (): void => controller.abort(request.signal.reason);
      if (request.signal.aborted) abort();
      else request.signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => {
        controller.abort(
          new DOMException(`no answer within ${timeoutMs} ms`, "TimeoutError"),
        );
      }, timeoutMs);
      const timed = new Request(request, { signal: controller.signal });
      settle.set(timed, () => {
        clearTimeout(timer);
        request.signal.removeEventListener("abort", abort);
      });
      return timed;
    },

    onError({ request }) {
      settled(request);
      return undefined;
    },

    async onResponse({ request, response, schemaPath }) {
      settled(request);
      const sunset = response.headers.get("Sunset");
      if (sunset !== null && noteSunset(sunset, schemaPath)) {
        console.warn(
          `uspace-ui api: ${request.method} ${schemaPath} answered with Sunset: ${sunset}; this API major is deprecated`,
        );
      }
      if (response.ok) {
        unauthorizedArmed = true;
        return undefined;
      }
      if (response.status === 401) {
        countApi("unauthorized");
        if (unauthorizedArmed) {
          unauthorizedArmed = false;
          opts.onUnauthorized?.();
        }
      }
      throw new ApiError({
        status: response.status,
        problem: await parseProblem(response.clone()),
        retryAfterS: retryAfterSOf(response.headers.get("Retry-After"), now()),
        requestId: response.headers.get("X-Request-Id"),
        sunset,
      });
    },
  };
}
